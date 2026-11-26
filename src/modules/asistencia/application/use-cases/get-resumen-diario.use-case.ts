import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { AsistenciaPolitica } from '../../domain/asistencia-politica';
import { AsistenciaPoliticaRepository, AsistenciaResumenRepository } from '../../domain/ports';
import { ResumenConColaborador } from '../../domain/resumen-diario';
import { PoliticaAsistenciaDto, ResumenAsistenciaDto, ResumenDiarioDto } from '../dto/asistencia.dto';
import { ConsolidarResumenDiarioUseCase, validarFecha } from './consolidar-resumen-diario.use-case';
import { SincronizarMarcacionesExternasUseCase } from './sincronizar-marcaciones-externas.use-case';

export interface GetResumenInput {
  sedeId: number;
  /** Si se omite, hoy. */
  fecha?: string;
}

/** Pantalla principal de asistencia: lee la base del reloj, reconsolida y devuelve el resumen del día con la política aplicada. */
@Injectable()
export class GetResumenDiarioUseCase implements UseCase<GetResumenInput, ResumenAsistenciaDto> {
  constructor(
    private readonly consolidar: ConsolidarResumenDiarioUseCase,
    private readonly resumenes: AsistenciaResumenRepository,
    private readonly politicas: AsistenciaPoliticaRepository,
    private readonly clock: Clock,
    private readonly sincronizar: SincronizarMarcacionesExternasUseCase,
  ) {}

  async execute(input: GetResumenInput): Promise<ResumenAsistenciaDto> {
    const fecha = validarFecha(input.fecha?.trim() || this.clock.today());
    // Primero se traen las marcaciones nuevas de la base del reloj (si está configurada).
    const sincronizacion =
      Number.isInteger(input.sedeId) && input.sedeId > 0
        ? await this.sincronizar.execute({ sedeId: input.sedeId, fecha })
        : { activa: false, leidas: 0, nuevas: 0, sinColaborador: 0, error: null };
    const politica = await this.consolidar.execute({ fecha, sedeId: input.sedeId });
    const configurada = (await this.politicas.findBySede(input.sedeId)) !== null;
    const filas = await this.resumenes.findByFechaYSede(fecha, input.sedeId);
    return {
      fecha,
      sedeId: input.sedeId,
      politica: toPoliticaDto(politica, configurada),
      resumen: filas.map(toResumenDto),
      sincronizacion,
    };
  }
}

export function toPoliticaDto(p: AsistenciaPolitica, configurada: boolean): PoliticaAsistenciaDto {
  return { ...p.props, configurada };
}

export function toResumenDto(r: ResumenConColaborador): ResumenDiarioDto {
  const colaborador = `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim();
  return {
    id: r.id ?? 0,
    userId: r.userId,
    colaborador: colaborador || `Usuario ${r.userId}`,
    cedula: r.cedula,
    email: r.email,
    fecha: r.fecha,
    horaEntrada: r.horaEntrada,
    horaSalida: r.horaSalida,
    minutosTarde: r.minutosTarde,
    minutosSalidaTemprana: r.minutosSalidaTemprana,
    estado: r.estado,
    detalle: r.detalle ?? r.justificacion ?? '',
    justificacion: r.justificacion,
    memoEnviado: r.memoEnviado,
    memoEnviadoAt: r.memoEnviadoAt ? r.memoEnviadoAt.toISOString() : null,
    memoError: r.memoError,
  };
}
