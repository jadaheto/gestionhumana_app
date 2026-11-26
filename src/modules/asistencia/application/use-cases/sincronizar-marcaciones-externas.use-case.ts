import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import {
  AsistenciaMarcacionRepository,
  claveMarcacion,
  ColaboradoresSedeReader,
  MarcacionesExternasReader,
} from '../../domain/ports';
import { SincronizacionExternaDto } from '../dto/asistencia.dto';

export interface SincronizarMarcacionesInput {
  sedeId: number;
  /** `YYYY-MM-DD` */
  fecha: string;
}

/**
 * Trae de la base externa del reloj las marcaciones de un día y guarda las que
 * aún no están en la sede. Sólo se guardan las de colaboradores de esa sede
 * (la base externa trae todas las sedes juntas), así que repetirla es inofensivo.
 * Nunca lanza: si la base externa no responde, lo informa en `error` y la
 * asistencia sigue funcionando con lo ya cargado.
 */
@Injectable()
export class SincronizarMarcacionesExternasUseCase implements UseCase<
  SincronizarMarcacionesInput,
  SincronizacionExternaDto
> {
  private readonly logger = new Logger(SincronizarMarcacionesExternasUseCase.name);

  constructor(
    private readonly externas: MarcacionesExternasReader,
    private readonly marcaciones: AsistenciaMarcacionRepository,
    private readonly colaboradores: ColaboradoresSedeReader,
    private readonly clock: Clock,
  ) {}

  async execute(input: SincronizarMarcacionesInput): Promise<SincronizacionExternaDto> {
    if (!this.externas.habilitado()) return { activa: false, leidas: 0, nuevas: 0, sinColaborador: 0, error: null };
    try {
      const filas = await this.externas.leerDia(input.fecha);
      const existentes = await this.marcaciones.findClavesBySedeYFecha(input.sedeId, input.fecha);
      const usuarios = new Map<string, number | null>();
      const sinColaborador = new Set<string>();
      const nuevas = [];
      for (const fila of filas) {
        let userId = usuarios.get(fila.identificacion);
        if (userId === undefined) {
          userId = await this.colaboradores.resolveUserId(fila.identificacion, input.sedeId);
          usuarios.set(fila.identificacion, userId);
        }
        if (userId === null) {
          sinColaborador.add(fila.identificacion);
          continue;
        }
        const clave = claveMarcacion(fila.identificacion, fila.fechaHora);
        if (existentes.has(clave)) continue;
        existentes.add(clave);
        nuevas.push({ ...fila, userId });
      }
      if (nuevas.length > 0) {
        await this.marcaciones.saveImportacion({
          sedeId: input.sedeId,
          archivo: `Base de datos del reloj (${input.fecha})`,
          importadoPor: null,
          createdAt: this.clock.now(),
          marcaciones: nuevas,
        });
      }
      return {
        activa: true,
        leidas: filas.length,
        nuevas: nuevas.length,
        sinColaborador: sinColaborador.size,
        error: null,
      };
    } catch (e) {
      const mensaje = (e as Error).message;
      this.logger.warn(`No se pudieron leer las marcaciones externas del ${input.fecha}: ${mensaje}`);
      return {
        activa: true,
        leidas: 0,
        nuevas: 0,
        sinColaborador: 0,
        error: 'No se pudo consultar la base de datos del reloj.',
      };
    }
  }
}
