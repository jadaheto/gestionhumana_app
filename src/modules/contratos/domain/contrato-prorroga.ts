/** Registro histórico de una prórroga (`contrato_prorrogas`). */
export interface ContratoProrroga {
  id: number | null;
  contratoId: number;
  userId: number;
  fechaFinAnterior: string;
  mesesProrroga: number;
  fechaInicioProrroga: string;
  fechaFinNueva: string;
  observacion: string | null;
  creadoPor: number;
  createdAt: Date | null;
}

/** Alerta enviada a un destinatario (`contrato_alertas`). Única por (contrato, destinatario, tipo, fecha). */
export interface ContratoAlerta {
  contratoId: number;
  destinatarioId: number;
  alertaTipo: 'vencimiento';
  alertaFecha: string;
}
