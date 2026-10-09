/**
 * Parser del reporte "LIQUIDACIÓN DE NOMINA" de Comfasucre.
 *
 * Port íntegro de `application/libraries/Nomina_parser.php` del sistema legado.
 * Recibe el texto plano producido por `pdftotext -layout` (preferido) o
 * `pdftotext` sin flags y devuelve metadatos, empleados, totales de control
 * y advertencias. Es un servicio de dominio puro: sin dependencias de Nest,
 * TypeORM ni del sistema de archivos.
 */

export interface NominaMeta {
  fechaLiquidacion: string | null;
  diasLiquidados: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  /** p. ej. '06' */
  tipoNomina: string;
  /** p. ej. 'COLEGIO' */
  fuente: string;
}

export interface NominaEmpleado {
  nombre: string;
  /** Cédula limpia, sin dígito de verificación ("1102879310-2" → "1102879310"). */
  cedula: string;
  /** Código tal como aparece en el PDF (puede incluir el dígito de verificación). */
  cedulaRaw: string;
  /** "Documento N°" del PDF: número de comprobante del período. */
  documentoNomina: string;
  cargo: string;
  area: string;
  sueldoBase: number;
  neto: number;
  dias: number | null;
  devengados: Record<string, number>;
  deducciones: Record<string, number>;
  rawBlock: string;
}

export interface NominaTotales {
  /** TOTAL LIQUIDADO del PDF. */
  totalLiquidadoPdf: number | null;
  /** TOTAL EMPLEADOS LIQUIDADOS del PDF. */
  totalEmpleadosPdf: number | null;
  /** Suma calculada de netos. */
  sumaNetos: number;
  empleadosDetectados: number;
}

export interface NominaParseResult {
  meta: NominaMeta;
  empleados: NominaEmpleado[];
  totales: NominaTotales;
  warnings: string[];
}

const RE_EMPLEADO = /Codigo Empleado:\s*([0-9][0-9.-]*)\s+Empleado:\s*(.+?)\s+Documento\s+N[°ºo]\.?\s*:\s*([0-9]+)/u;
const RE_CARGO = /Cargo Empleado\s*:\s*(.+?)\s+Sueldo Base\s*:\s*\$?\s*([0-9.,]+)/u;
const RE_NETO = /NETO A PAGAR\s*-*>\s*([0-9.,]+)/u;
const RE_CONCEPTO = /^(.*?)\s+([0-9]+(?:[.,][0-9]+)?)\s+(\(?[0-9.,]+\)?)\s+([0-9]+(?:[.,][0-9]+)?)\s+(Si|No)\s*$/u;
const RE_CODIGO_CONCEPTO = /^(.+?)\s*-\s*(\d{3})\b\s*(.*)$/u;
const RE_AREA = /^(.+?)\s+Centro-/u;

const PAGE_CHROME: RegExp[] = [
  /^LIQUIDACI[OÓ]N DE NOMINA/iu,
  /^CAJA DE COMPENSACION FAMILIAR/iu,
  /^Fecha de Impresi[oó]n:/iu,
  /^Fecha Liquidaci[oó]n:/iu,
  /^CONCEPTO\s+DIV\./iu,
  /^Pagina\s+\d+\s+de\s+\d+/iu,
  /^CALLE\s+\d+/iu,
  /Pagina\s+\d+\s+de\s+\d+\s*$/iu,
];

export class NominaParser {
  parse(input: string): NominaParseResult {
    const text = String(input ?? '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    const meta = this.parseMeta(text);
    const totalesPdf = this.parseTotales(text);

    const empleados = new Map<string, NominaEmpleado>(); // código → bloque acumulado
    const orden: string[] = []; // orden de aparición de códigos
    const warnings: string[] = [];
    let current: string | null = null; // código del bloque abierto

    for (const rawLine of text.split('\n')) {
      const trimmed = rawLine.trim();
      if (trimmed === '') continue;

      // Cabeceras/pies de página: ignorar.
      if (this.isPageChrome(trimmed)) continue;

      // Totales finales: cierran cualquier bloque.
      const upper = trimmed.toUpperCase();
      if (upper.startsWith('TOTAL LIQUIDADO') || upper.startsWith('TOTAL EMPLEADOS')) {
        current = null;
        continue;
      }

      // Inicio (o continuación tras salto de página) de un empleado.
      const mEmp = RE_EMPLEADO.exec(trimmed);
      if (mEmp) {
        const codigo = mEmp[1].trim();
        const nombre = this.cleanSpaces(mEmp[2]);
        const documento = mEmp[3].trim();
        const existente = empleados.get(codigo);
        if (!existente) {
          empleados.set(codigo, {
            nombre,
            cedula: codigo.replace(/-\d+$/, ''),
            cedulaRaw: codigo,
            documentoNomina: documento,
            cargo: '',
            area: '',
            sueldoBase: 0,
            neto: 0,
            dias: null,
            devengados: {},
            deducciones: {},
            rawBlock: trimmed,
          });
          orden.push(codigo);
        } else {
          // Bloque partido por salto de página: se fusiona.
          existente.rawBlock += '\n' + trimmed;
        }
        current = codigo;
        continue;
      }

      if (current === null) continue;

      const emp = empleados.get(current)!;
      emp.rawBlock += '\n' + trimmed;

      // Línea de cargo + sueldo base.
      const mCargo = RE_CARGO.exec(trimmed);
      if (mCargo) {
        if (emp.cargo === '') emp.cargo = this.cleanSpaces(mCargo[1]);
        if (emp.sueldoBase <= 0) emp.sueldoBase = this.parseMoney(mCargo[2]);
        continue;
      }

      // Neto a pagar: cierra el bloque.
      const mNeto = RE_NETO.exec(trimmed);
      if (mNeto) {
        emp.neto = this.parseMoney(mNeto[1]);
        current = null;
        continue;
      }

      // Línea de concepto: termina en CANTIDAD VALOR FACTOR Si|No.
      const mConc = RE_CONCEPTO.exec(trimmed);
      if (mConc) {
        const left = mConc[1].trim();
        const cantidad = this.parseMoney(mConc[2]);
        const valorRaw = mConc[3];
        const esNegativo = valorRaw.includes('(');
        const valor = this.parseMoney(valorRaw.replace(/^\(+|\)+$/g, ''));

        // Nombre y código del concepto: "Salario - 001", "Descuento Pensión Colpensiones   - 416"
        let concepto = left;
        let codigoConc = '';
        const mCod = RE_CODIGO_CONCEPTO.exec(left);
        if (mCod) {
          concepto = this.cleanSpaces(mCod[1]);
          codigoConc = mCod[2];
          const rest = mCod[3].trim();
          const mArea = RE_AREA.exec(rest);
          if (emp.area === '' && mArea) emp.area = this.cleanSpaces(mArea[1]);
        } else {
          // Sin código: quitar columnas DIV/CC si se colaron en el nombre.
          concepto = this.cleanSpaces(left.replace(/\s{2,}[\s\S]*$/u, ''));
        }

        if (concepto === '') continue;

        const key = concepto + (codigoConc !== '' ? ' - ' + codigoConc : '');
        const esDeduccion = esNegativo || concepto.toLowerCase().startsWith('descuento');

        if (esDeduccion) {
          emp.deducciones[key] = (emp.deducciones[key] ?? 0) + Math.abs(valor);
        } else {
          emp.devengados[key] = (emp.devengados[key] ?? 0) + Math.abs(valor);
          if (codigoConc === '001' && emp.dias === null) emp.dias = cantidad;
        }
      }
    }

    // Post-proceso y advertencias por empleado.
    const lista: NominaEmpleado[] = [];
    for (const codigo of orden) {
      const emp = empleados.get(codigo)!;
      if (emp.nombre === '') {
        warnings.push(`Bloque con código ${codigo} sin nombre; descartado.`);
        continue;
      }
      const calcNeto = round2(sum(emp.devengados) - sum(emp.deducciones));
      if (Math.abs(calcNeto - emp.neto) > 1) {
        warnings.push(
          `${emp.nombre} (${codigo}): neto del PDF ${formatNumber(emp.neto)} no cuadra con conceptos ${formatNumber(calcNeto)}.`,
        );
      }
      lista.push(emp);
    }

    let sumaNetos = 0;
    for (const emp of lista) sumaNetos += emp.neto;

    if (totalesPdf.totalEmpleados !== null && lista.length !== totalesPdf.totalEmpleados) {
      warnings.push(`Empleados detectados (${lista.length}) difiere del total del PDF (${totalesPdf.totalEmpleados}).`);
    }
    if (totalesPdf.totalLiquidado !== null && Math.abs(sumaNetos - totalesPdf.totalLiquidado) > 1) {
      warnings.push(
        `Suma de netos (${formatNumber(sumaNetos)}) difiere del TOTAL LIQUIDADO del PDF (${formatNumber(totalesPdf.totalLiquidado)}).`,
      );
    }

    return {
      meta,
      empleados: lista,
      totales: {
        totalLiquidadoPdf: totalesPdf.totalLiquidado,
        totalEmpleadosPdf: totalesPdf.totalEmpleados,
        sumaNetos: round2(sumaNetos),
        empleadosDetectados: lista.length,
      },
      warnings,
    };
  }

  // ------------------------------------------------------------------
  // Metadatos y totales
  // ------------------------------------------------------------------

  private parseMeta(text: string): NominaMeta {
    const meta: NominaMeta = {
      fechaLiquidacion: null,
      diasLiquidados: null,
      fechaInicio: null,
      fechaFin: null,
      tipoNomina: '',
      fuente: '',
    };
    let m = /Fecha Liquidaci[oó]n:\s*([0-9/-]+)/u.exec(text);
    if (m) meta.fechaLiquidacion = this.normalizeDate(m[1]);
    m = /Dias Liquidados:\s*([0-9]+)/u.exec(text);
    if (m) meta.diasLiquidados = parseInt(m[1], 10);
    m = /Periodo:\s*([0-9/-]+)\s+A\s+([0-9/-]+)/u.exec(text);
    if (m) {
      meta.fechaInicio = this.normalizeDate(m[1]);
      meta.fechaFin = this.normalizeDate(m[2]);
    }
    m = /Tipo de Nomina:\s*([0-9]+)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ ]+)/u.exec(text);
    if (m) {
      meta.tipoNomina = m[1].trim();
      meta.fuente = this.cleanSpaces(m[2]).toUpperCase();
    }
    return meta;
  }

  private parseTotales(text: string): { totalLiquidado: number | null; totalEmpleados: number | null } {
    const out: { totalLiquidado: number | null; totalEmpleados: number | null } = {
      totalLiquidado: null,
      totalEmpleados: null,
    };
    let m = /TOTAL LIQUIDADO\s*-*>\s*([0-9.,]+)/u.exec(text);
    if (m) out.totalLiquidado = this.parseMoney(m[1]);
    m = /TOTAL EMPLEADOS LIQUIDADOS\s*:\s*([0-9]+)/u.exec(text);
    if (m) out.totalEmpleados = parseInt(m[1], 10);
    return out;
  }

  private isPageChrome(line: string): boolean {
    return PAGE_CHROME.some((p) => p.test(line));
  }

  // ------------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------------

  /** Convierte montos en formato US (1,232,414.00) o CO (1.232.414,00) a número. */
  parseMoney(input: string | number | null | undefined): number {
    let raw = String(input ?? '')
      .replace(/[$ ]/g, '')
      .trim();
    if (raw === '') return 0;
    const hasDot = raw.includes('.');
    const hasComma = raw.includes(',');

    if (hasDot && hasComma) {
      // El separador que aparece de último es el decimal.
      if (raw.lastIndexOf('.') > raw.lastIndexOf(',')) {
        raw = raw.replace(/,/g, ''); // US: 1,234.56
      } else {
        raw = raw.replace(/\./g, '').replace(/,/g, '.'); // CO: 1.234,56
      }
    } else if (hasComma) {
      // Solo comas: miles US (1,232,414) salvo que parezca decimal (12,50).
      if (/,\d{1,2}$/.test(raw) && count(raw, ',') === 1) {
        raw = raw.replace(',', '.');
      } else {
        raw = raw.replace(/,/g, '');
      }
    } else if (hasDot) {
      // Solo puntos: decimal (15.00) si hay 1-2 dígitos tras el último punto; si no, miles CO.
      if (!/\.\d{1,2}$/.test(raw) || count(raw, '.') > 1) {
        if (/^\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, '');
      }
    }
    return toFloat(raw);
  }

  /**
   * Normaliza fechas a YYYY-MM-DD. El reporte usa m/d/Y; si el primer número
   * no puede ser mes (>12) se interpreta como d/m/Y.
   */
  normalizeDate(input: string | null | undefined): string | null {
    const raw = String(input ?? '').trim();
    if (raw === '') return null;
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
    if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
    m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const y = parseInt(m[3], 10);
      let mes: number;
      let dia: number;
      if (a > 12 && b <= 12) {
        // d/m/Y
        mes = b;
        dia = a;
      } else {
        // m/d/Y (formato del reporte)
        mes = a;
        dia = b;
      }
      if (!checkDate(mes, dia, y)) return null;
      return `${y}-${pad2(mes)}-${pad2(dia)}`;
    }
    const ts = new Date(raw);
    if (Number.isNaN(ts.getTime())) return null;
    return `${ts.getFullYear()}-${pad2(ts.getMonth() + 1)}-${pad2(ts.getDate())}`;
  }

  private cleanSpaces(s: string): string {
    return String(s ?? '')
      .replace(/\s+/gu, ' ')
      .trim();
  }
}

function count(s: string, ch: string): number {
  return s.split(ch).length - 1;
}

/** Equivalente al cast `(float)` de PHP: toma el prefijo numérico o 0. */
function toFloat(raw: string): number {
  const m = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(raw);
  if (!m) return 0;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : 0;
}

function pad2(v: string | number): string {
  return String(v).padStart(2, '0');
}

function checkDate(mes: number, dia: number, anio: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1 || anio < 1) return false;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

function sum(values: Record<string, number>): number {
  return Object.values(values).reduce((a, b) => a + b, 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Equivalente a `number_format($n, 0)` de PHP: miles con coma, sin decimales. */
export function formatNumber(n: number): string {
  const rounded = Math.round(Math.abs(n));
  const str = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-' : '') + str;
}
