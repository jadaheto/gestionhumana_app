import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { MarcacionImportada } from '../../domain/marcacion';
import { mapearFilaMarcacion } from '../../domain/marcacion-row.mapper';
import { ArchivoMarcaciones, AsistenciaFileParser } from '../../application/ports/asistencia-file-parser.port';

/**
 * Lee el archivo del reloj biométrico desde memoria:
 *  - `.xlsx` con exceljs (primera hoja);
 *  - `.csv`/`.txt` delimitados por tabulador, coma o punto y coma (detectado en la primera línea).
 * La primera fila son las cabeceras; el mapeo a marcaciones es lógica de dominio.
 */
@Injectable()
export class BufferAsistenciaFileParser extends AsistenciaFileParser {
  async parse(archivo: ArchivoMarcaciones): Promise<MarcacionImportada[]> {
    const ext = archivo.originalName.split('.').pop()?.toLowerCase() ?? '';
    const filas = ext === 'xlsx' ? await leerXlsx(archivo.buffer) : leerDelimitado(archivo.buffer);
    if (filas.length <= 1) return [];
    const [cabeceras, ...datos] = filas;
    const resultado: MarcacionImportada[] = [];
    for (const fila of datos) {
      if (fila.every((c) => c.trim() === '')) continue;
      const m = mapearFilaMarcacion(fila, cabeceras);
      if (m) resultado.push(m);
    }
    return resultado;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Convierte el valor de una celda de exceljs a texto (las fechas en `YYYY-MM-DD HH:mm:ss`). */
export function celdaATexto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    return `${valor.getUTCFullYear()}-${pad(valor.getUTCMonth() + 1)}-${pad(valor.getUTCDate())} ${pad(valor.getUTCHours())}:${pad(valor.getUTCMinutes())}:${pad(valor.getUTCSeconds())}`;
  }
  if (typeof valor === 'object') {
    if ('richText' in valor) return valor.richText.map((r) => r.text).join('');
    if ('text' in valor) return String(valor.text ?? '');
    if ('result' in valor) return celdaATexto(valor.result);
    if ('error' in valor) return '';
    return String(valor);
  }
  return String(valor);
}

async function leerXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const hoja = workbook.worksheets[0];
  if (!hoja) return [];
  const filas: string[][] = [];
  hoja.eachRow({ includeEmpty: false }, (row) => {
    const valores = row.values as ExcelJS.CellValue[]; // índice 1-based
    const celdas: string[] = [];
    for (let i = 1; i < valores.length; i++) celdas.push(celdaATexto(valores[i]).trim());
    filas.push(celdas);
  });
  return filas;
}

export function detectarDelimitador(primeraLinea: string): string {
  if (primeraLinea.includes('\t')) return '\t';
  if (!primeraLinea.includes(',') && primeraLinea.includes(';')) return ';';
  return ',';
}

/** Parser CSV mínimo con soporte de comillas dobles (equivalente a `fgetcsv`). */
export function parsearLineaCsv(linea: string, delimitador: string): string[] {
  const celdas: string[] = [];
  let actual = '';
  let enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (enComillas) {
      if (c === '"') {
        if (linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        actual += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === delimitador) {
      celdas.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  celdas.push(actual);
  return celdas;
}

function leerDelimitado(buffer: Buffer): string[][] {
  let texto = buffer.toString('utf8');
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
  const lineas = texto.split(/\r\n|\r|\n/);
  const delimitador = detectarDelimitador(lineas[0] ?? '');
  return lineas.filter((l) => l.trim() !== '').map((l) => parsearLineaCsv(l, delimitador));
}
