import { mapearFilaMarcacion, normalizarCabecera, parsearFechaHora } from '../marcacion-row.mapper';

describe('normalizarCabecera', () => {
  it('quita tildes, puntos y símbolos y usa guion bajo', () => {
    expect(normalizarCabecera('ID de Usuario')).toBe('id_de_usuario');
    expect(normalizarCabecera('Fecha/Hora')).toBe('fecha_hora');
    expect(normalizarCabecera('Dispositivo Nro.')).toBe('dispositivo_nro');
    expect(normalizarCabecera('Identificación ')).toBe('identificacion');
  });
});

describe('parsearFechaHora', () => {
  it('acepta d/m/y y d/m/Y con hora', () => {
    expect(parsearFechaHora('8/10/26 7:05:09')).toBe('2026-10-08 07:05:09');
    expect(parsearFechaHora('08/10/2026 17:30:00')).toBe('2026-10-08 17:30:00');
  });
  it('acepta Y-m-d H:i:s y fecha + hora en columnas separadas', () => {
    expect(parsearFechaHora('2026-10-08 08:00:00')).toBe('2026-10-08 08:00:00');
    expect(parsearFechaHora('08/10/2026', '08:15')).toBe('2026-10-08 08:15:00');
  });
  it('ignora la segunda columna cuando la fecha ya trae hora o la columna no es una hora', () => {
    expect(parsearFechaHora('2026-10-08 08:00:00', 'Entrada')).toBe('2026-10-08 08:00:00');
  });
  it('devuelve null para valores no interpretables o fechas inválidas', () => {
    expect(parsearFechaHora('')).toBeNull();
    expect(parsearFechaHora('hola')).toBeNull();
    expect(parsearFechaHora('31/02/2026 08:00:00')).toBeNull();
  });
});

describe('mapearFilaMarcacion', () => {
  const cabeceras = ['ID de Usuario', 'Nombre', 'Tipo de registro', 'Departamento', 'Dispositivo Nro', 'Fecha', 'Hora'];

  it('mapea una fila completa del reloj biométrico', () => {
    const fila = mapearFilaMarcacion(
      ['10 234 567', 'Ana Pérez', 'in', 'Sistemas', 'D1', '08/10/2026', '07:55:02'],
      cabeceras,
    );
    expect(fila).toEqual({
      identificacion: '10234567',
      nombre: 'Ana Pérez',
      fechaHora: '2026-10-08 07:55:02',
      tipoRegistro: 'in',
      departamento: 'Sistemas',
      dispositivoNo: 'D1',
      fechaRaw: '08/10/2026',
      horaRaw: '07:55:02',
    });
  });

  it('usa la columna Identificación cuando no hay ID de usuario y no es "0"', () => {
    const fila = mapearFilaMarcacion(
      ['123', 'Luis', '2026-10-08 08:00:00'],
      ['Identificación', 'Nombre', 'Fecha/Hora'],
    );
    expect(fila?.identificacion).toBe('123');
    expect(
      mapearFilaMarcacion(['0', 'Luis', '2026-10-08 08:00:00'], ['Identificación', 'Nombre', 'Fecha/Hora']),
    ).toBeNull();
  });

  it('descarta filas sin nombre, sin identificación o sin fecha válida', () => {
    expect(mapearFilaMarcacion(['', 'Ana', 'in', '', '', '08/10/2026', '07:55:02'], cabeceras)).toBeNull();
    expect(mapearFilaMarcacion(['1', '', 'in', '', '', '08/10/2026', '07:55:02'], cabeceras)).toBeNull();
    expect(mapearFilaMarcacion(['1', 'Ana', 'in', '', '', 'ayer', ''], cabeceras)).toBeNull();
  });
});

describe('reporte "Asistencia Diaria" del reloj', () => {
  const cabeceras = [
    'Nro. de serie',
    'Departamento',
    'Nro. de usuario',
    'ID de usuario',
    'Nombre',
    'Fecha/Hora',
    'Tipo de registro',
    'Operación',
    'Descripción de la exepción',
    'Turno',
    'Código de identificación',
    'Identificación',
    'Código de tarea',
    'Dispositivo Nro.',
    'Marcado',
  ];
  const celdas = (hora: string, operacion: string, excepcion: string) => [
    '1',
    'SEDE PRINCIPAL',
    '1211',
    '3839033',
    'Contreras Peña Adolfo',
    `2026-11-25 ${hora}`,
    'In',
    operacion,
    excepcion,
    '',
    '16',
    'Cara',
    '0',
    '3',
    'False',
  ];

  it('usa la cédula de "ID de usuario" y conserva el tipo cuando no hay operación', () => {
    expect(mapearFilaMarcacion(celdas('07:46:12', '', 'Registro normal'), cabeceras)).toMatchObject({
      identificacion: '3839033',
      nombre: 'Contreras Peña Adolfo',
      fechaHora: '2026-11-25 07:46:12',
      tipoRegistro: 'In',
      departamento: 'SEDE PRINCIPAL',
      dispositivoNo: '3',
    });
  });
  it('toma el sentido corregido de "Operación" (Out) y deja el original en otros códigos', () => {
    expect(mapearFilaMarcacion(celdas('17:02:09', 'Out', 'Tipo de registro inc'), cabeceras)?.tipoRegistro).toBe('Out');
    expect(mapearFilaMarcacion(celdas('17:02:09', '3', 'Tipo de registro inc'), cabeceras)?.tipoRegistro).toBe('In');
  });
  it('descarta las marcaciones eliminadas o inválidas', () => {
    expect(mapearFilaMarcacion(celdas('12:00:00', 'Eliminar', 'Registro inválido'), cabeceras)).toBeNull();
    expect(mapearFilaMarcacion(celdas('12:00:00', '', 'Registro inválido'), cabeceras)).toBeNull();
  });
});
