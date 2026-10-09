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
