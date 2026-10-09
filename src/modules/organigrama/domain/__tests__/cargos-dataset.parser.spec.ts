import { CargosDatasetParser } from '../cargos-dataset.parser';

describe('CargosDatasetParser (dominio)', () => {
  const parser = new CargosDatasetParser();

  it('interpreta un dataset CARGO/AREA sin salarios y omite el encabezado', () => {
    const raw = 'CARGO\tAREA\nDirector de Gestion Humana\tGestion Humana\nAnalista de Credito Social\tCredito Social\n';
    const r = parser.parse(raw);
    expect(r.omitidas).toBe(0);
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0]).toMatchObject({
      cargo: 'Director de Gestión Humana',
      area: 'Gestión Humana',
      conSalario: false,
      salario2024: null,
    });
    expect(r.filas[1]).toMatchObject({ cargo: 'Analista de Crédito Social', area: 'Crédito Social' });
  });

  it('interpreta un dataset con salarios (4 columnas) y normaliza montos', () => {
    const raw = [
      'CARGO\tSALARIO 2024\tAUMENTO 2025\tAREA',
      'Auxiliar Contable\t$ 1.500.000\t$ 120.000,50\tContabilidad',
      'Jefe de Sistemas\t3,200,000\t-\tTecnología',
      'Coordinador\tn/a\t\tTecnología',
    ].join('\n');
    const r = parser.parse(raw);
    expect(r.omitidas).toBe(0);
    expect(r.filas[0]).toMatchObject({
      cargo: 'Auxiliar Contable',
      area: 'Contabilidad',
      conSalario: true,
      salario2024: 1500000,
      aumento2025: 120000.5,
    });
    expect(r.filas[1]).toMatchObject({ cargo: 'Jefe de Sistemas', salario2024: 3200000, aumento2025: null });
    // Con tabulaciones consecutivas (celdas vacías) la fila queda con 2 columnas: se trata como CARGO/AREA.
    expect(r.filas[2]).toMatchObject({ cargo: 'Coordinador', area: 'Tecnología', conSalario: false });
  });

  it('separa por 2+ espacios cuando no hay tabulaciones y cuenta filas inválidas', () => {
    const raw = 'Analista Senior I    Talento Humano\nSoloUnaColumna\n"   "\tÁrea X\n';
    const r = parser.parse(raw);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]).toMatchObject({
      cargo: 'Analista Senior I',
      area: 'Talento Humano',
      cargoKey: 'analista senior 1',
      areaKey: 'talento humano',
    });
    expect(r.omitidas).toBe(2);
  });

  it('reagrupa líneas partidas dentro de comillas (celdas multilínea)', () => {
    const raw = '"Profesional de\nCartera"\tCredito y Cartera\nAuxiliar\tCaja';
    const r = parser.parse(raw);
    expect(r.filas.map((f) => f.cargo)).toEqual(['Profesional de Cartera', 'Auxiliar']);
    expect(r.filas[0].area).toBe('Crédito y Cartera');
  });

  it('normaliza claves equivalentes para deduplicar (Analista V ≡ Analista 5)', () => {
    expect(parser.normalizarClave('  Analista   V ')).toBe('analista 5');
    expect(parser.normalizarClave('Profesional Senior I')).toBe('profesional senior 1');
  });

  it('normaliza dinero con distintos formatos', () => {
    expect(parser.normalizarDinero('')).toBeNull();
    expect(parser.normalizarDinero('$')).toBeNull();
    expect(parser.normalizarDinero('2.500.000')).toBe(2500000);
    expect(parser.normalizarDinero('2500000.75')).toBe(2500000.75);
    expect(parser.normalizarDinero('1.234,56')).toBe(1234.56);
  });

  it('devuelve vacío para datasets en blanco', () => {
    expect(parser.parse('\n\r\n  ')).toEqual({ filas: [], omitidas: 0 });
  });
});
