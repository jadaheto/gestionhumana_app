import { DefinicionHerramienta } from './ports';

const colaboradorId = {
  colaborador_id: { type: 'integer', description: 'ID del colaborador (obtenido con buscar_colaborador).' },
};

/** Herramientas de dominio del asistente de Gestión Humana (todas de solo lectura). */
export const HERRAMIENTAS_ASISTENTE: readonly DefinicionHerramienta[] = [
  {
    name: 'buscar_colaborador',
    description:
      'Busca colaboradores por cédula, código de empresa, nombre, apellido o correo. Úsala siempre primero para obtener el colaborador_id. Devuelve hasta 10 coincidencias.',
    parameters: {
      type: 'object',
      properties: { texto: { type: 'string', description: 'Cédula, código o parte del nombre.' } },
      required: ['texto'],
    },
  },
  {
    name: 'ficha_colaborador',
    description:
      'Ficha completa de un colaborador: cargo, área, sede, estado, fechas de ingreso y nacimiento, contacto, seguridad social, contrato vigente y saldo de puntos.',
    parameters: { type: 'object', properties: { ...colaboradorId }, required: ['colaborador_id'] },
  },
  {
    name: 'ausencias_colaborador',
    description:
      'Permisos, vacaciones (saldo por periodo y disfrutes) e incapacidades de un colaborador, con fechas, días y estado. Últimos 20 de cada tipo.',
    parameters: { type: 'object', properties: { ...colaboradorId }, required: ['colaborador_id'] },
  },
  {
    name: 'asistencia_colaborador',
    description:
      'Resumen diario de asistencia de un colaborador (entrada, salida, minutos de tardanza, estado) en un rango de fechas. Por defecto los últimos 30 días; máximo 50 días.',
    parameters: {
      type: 'object',
      properties: {
        ...colaboradorId,
        desde: { type: 'string', description: 'Fecha inicial YYYY-MM-DD (opcional).' },
        hasta: { type: 'string', description: 'Fecha final YYYY-MM-DD (opcional).' },
      },
      required: ['colaborador_id'],
    },
  },
  {
    name: 'contratos_por_vencer',
    description:
      'Contratos activos con fecha de fin dentro de los próximos N días (por defecto 30, máximo 365), con colaborador, cargo, área y días restantes. Máximo 50.',
    parameters: {
      type: 'object',
      properties: { dias: { type: 'integer', description: 'Ventana en días desde hoy (por defecto 30).' } },
    },
  },
  {
    name: 'consulta_sql',
    description:
      'Ejecuta UN SELECT de solo lectura (PostgreSQL) sobre las tablas permitidas cuando las otras herramientas no alcanzan (conteos, rankings, agregados por área/sede/cargo, cumpleaños, listados filtrados). Máximo 200 filas. Usa el esquema descrito en el sistema. Prohibido: escritura, varias sentencias, tablas fuera de la lista.',
    parameters: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'Sentencia SELECT completa.' },
        proposito: { type: 'string', description: 'Qué se quiere responder con esta consulta (una frase).' },
      },
      required: ['sql', 'proposito'],
    },
  },
];
