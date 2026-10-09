/**
 * Parser puro del dataset pegado en "Importar cargos y áreas".
 * Replica `AdminUsuarios::import_cargos_areas_from_text` del legado:
 *  - Reagrupa líneas partidas por comillas sin cerrar (celdas con saltos de línea).
 *  - Separa columnas por tabulaciones o, si no hay, por 2+ espacios.
 *  - 2-3 columnas: CARGO … AREA (la última columna es el área).
 *  - 4+ columnas: CARGO, SALARIO 2024, AUMENTO 2025, AREA.
 *  - Limpia etiquetas (comillas, espacios, tildes frecuentes) y normaliza claves
 *    para deduplicar ("Senior I" ≡ "Senior 1", "Analista V" ≡ "Analista 5").
 */
export interface FilaCargoDataset {
  cargo: string;
  area: string;
  /** Clave normalizada del área (para deduplicar). */
  areaKey: string;
  /** Clave normalizada del cargo (para deduplicar dentro del área). */
  cargoKey: string;
  conSalario: boolean;
  salario2024: number | null;
  aumento2025: number | null;
}

export interface ResultadoParseoDataset {
  filas: FilaCargoDataset[];
  /** Filas que no pudieron interpretarse (sin 2 columnas, cargo o área vacíos). */
  omitidas: number;
}

export class CargosDatasetParser {
  parse(raw: string): ResultadoParseoDataset {
    const filas: FilaCargoDataset[] = [];
    let omitidas = 0;

    for (const linea of this.lineasLogicas(raw)) {
      if (this.esEncabezado(linea)) continue;

      let partes = linea.split(/\t+/);
      if (partes.length < 2) partes = linea.split(/\s{2,}/);
      if (partes.length < 2) {
        omitidas++;
        continue;
      }
      partes = partes.map((p) => p.trim());

      const conSalario = partes.length >= 4;
      const cargo = this.limpiarEtiqueta(partes[0]);
      const area = this.limpiarEtiqueta(conSalario ? partes[3] : partes[partes.length - 1]);
      if (cargo === '' || area === '') {
        omitidas++;
        continue;
      }

      filas.push({
        cargo,
        area,
        areaKey: this.normalizarClave(area),
        cargoKey: this.normalizarClave(cargo),
        conSalario,
        salario2024: conSalario ? this.normalizarDinero(partes[1]) : null,
        aumento2025: conSalario ? this.normalizarDinero(partes[2]) : null,
      });
    }
    return { filas, omitidas };
  }

  /** Une líneas físicas mientras haya una comilla sin cerrar (celdas multilínea). */
  lineasLogicas(raw: string): string[] {
    const texto = raw.replace(/\r/g, '\n').replace(/\n+/g, '\n');
    const resultado: string[] = [];
    let buffer = '';
    const comillas = (s: string) => (s.match(/"/g) ?? []).length;

    for (const original of texto.split('\n')) {
      const linea = original.trim();
      if (linea === '') continue;
      if (buffer !== '') {
        buffer += ' ' + linea;
        if (comillas(buffer) % 2 === 0) {
          resultado.push(buffer);
          buffer = '';
        }
        continue;
      }
      if (comillas(linea) % 2 !== 0) {
        buffer = linea;
        continue;
      }
      resultado.push(linea);
    }
    if (buffer !== '') resultado.push(buffer);
    return resultado;
  }

  /** Encabezado: primera columna CARGO y última AREA (p. ej. "CARGO<tab>AREA" o "CARGO<tab>SALARIO 2024<tab>AUMENTO 2025<tab>AREA"). */
  esEncabezado(linea: string): boolean {
    const columnas = linea
      .toUpperCase()
      .split(/\t+|\s{2,}/)
      .map((c) => c.trim())
      .filter((c) => c !== '');
    if (columnas.length === 1) return columnas[0] === 'CARGO AREA';
    return columnas.length >= 2 && columnas[0] === 'CARGO' && columnas[columnas.length - 1] === 'AREA';
  }

  limpiarEtiqueta(valor: string): string {
    // eslint-disable-next-line no-control-regex
    let v = (valor ?? '').replace(/^[\s"\0\x0B]+|[\s"\0\x0B]+$/g, '');
    v = v.replace(/\s+/g, ' ');
    v = v.split('Credito Social').join('Crédito Social').split('Credito y Cartera').join('Crédito y Cartera');
    v = v.split('Gestion ').join('Gestión ').split('Direccion ').join('Dirección ');
    return v.trim();
  }

  normalizarClave(valor: string): string {
    // Se antepone un espacio para que los patrones (" senior i", " analista v") apliquen también al inicio del texto.
    let v = ' ' + (valor ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
    v = v
      .split(' senior i')
      .join(' senior 1')
      .split(' analista v')
      .join(' analista 5')
      .split(' profesional senior i')
      .join(' profesional senior 1');
    return v.trim();
  }

  /** "$ 2.500.000,50" → 2500000.5; "3.200.000" → 3200000; vacío o no numérico → null. */
  normalizarDinero(valor: string): number | null {
    let v = (valor ?? '').trim();
    if (v === '') return null;
    v = v.replace(/[^0-9,.]/g, '');
    if (v === '') return null;

    if (v.includes(',') && v.includes('.')) {
      v = v.split('.').join('').replace(',', '.');
    } else if ((v.match(/\./g) ?? []).length > 1) {
      v = v.split('.').join('');
    } else if ((v.match(/,/g) ?? []).length > 1) {
      v = v.split(',').join('');
    }
    if (!/^\d+(\.\d+)?$/.test(v)) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
}
