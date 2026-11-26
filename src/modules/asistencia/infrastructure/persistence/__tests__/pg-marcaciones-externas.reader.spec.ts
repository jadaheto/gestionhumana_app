import { celdaATexto, filasAMarcaciones, identificadorSql } from '../pg-marcaciones-externas.reader';

describe('lector de la base externa del reloj', () => {
  it('escapa los identificadores SQL', () => {
    expect(identificadorSql('fecha_hora')).toBe('"fecha_hora"');
    expect(identificadorSql('Fecha/Hora')).toBe('"Fecha/Hora"');
    expect(identificadorSql('a"b')).toBe('"a""b"');
  });

  it('convierte fechas a texto local y nulos a vacío', () => {
    expect(celdaATexto(new Date(2026, 10, 25, 7, 34, 13))).toBe('2026-11-25 07:34:13');
    expect(celdaATexto(null)).toBe('');
    expect(celdaATexto(3839033)).toBe('3839033');
  });

  it('mapea filas con columnas en snake_case o con los títulos del reporte', () => {
    const filas = [
      {
        nro_de_serie: 1,
        departamento: 'SEDE PRINCIPAL',
        id_de_usuario: '3839033',
        nombre: 'Contreras Peña Adolfo',
        fecha_hora: new Date(2026, 10, 25, 17, 2, 9),
        tipo_de_registro: 'In',
        operacion: 'Out',
        descripcion_de_la_exepcion: 'Tipo de registro inc',
        identificacion: 'Cara',
        dispositivo_nro: 3,
      },
      {
        'ID de usuario': '10776632',
        Nombre: 'Rodriguez Mestra Eliecer David',
        'Fecha/Hora': '2026-11-25 07:55:01',
        'Tipo de registro': 'In',
        Operación: null,
        'Descripción de la exepción': 'Registro normal',
      },
      { id_de_usuario: '1', nombre: 'Anulado', fecha_hora: '2026-11-25 09:00:00', operacion: 'Eliminar' },
    ];
    expect(filasAMarcaciones(filas)).toEqual([
      expect.objectContaining({ identificacion: '3839033', fechaHora: '2026-11-25 17:02:09', tipoRegistro: 'Out' }),
      expect.objectContaining({ identificacion: '10776632', fechaHora: '2026-11-25 07:55:01', tipoRegistro: 'In' }),
    ]);
  });
});
