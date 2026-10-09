import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { Comunicado } from '../../domain/comunicado';
import { ComunicadoRepository } from '../../domain/comunicado.repository';
import { NotificacionesPort } from '../../domain/notificaciones.port';
import { ResultadoCorreo } from '../dto/comunicados.dto';
import { ComunicadoMailerService } from './comunicado-mailer.service';

/** Enlace (relativo al frontend) al detalle de un comunicado. */
export const linkComunicado = (id: number): string => `/comunicados/ver/${id}`;

/**
 * Pasos comunes tras publicar un comunicado: notificar a todos los
 * colaboradores activos y enviar el correo (si no se había enviado antes).
 */
@Injectable()
export class PublicacionComunicadoService {
  constructor(
    private readonly comunicados: ComunicadoRepository,
    private readonly notificaciones: NotificacionesPort,
    private readonly mailer: ComunicadoMailerService,
    private readonly clock: Clock,
  ) {}

  /** Devuelve el comunicado actualizado y el resultado del correo (null si ya estaba enviado). */
  async notificarYEnviar(comunicado: Comunicado): Promise<{ comunicado: Comunicado; correo: ResultadoCorreo | null }> {
    const id = comunicado.id ?? 0;
    await this.notificaciones.notificarUsuariosActivos({
      titulo: 'Nuevo comunicado',
      mensaje: comunicado.titulo,
      tipo: 'comunicado',
      link: linkComunicado(id),
    });

    if (comunicado.correoEnviado) return { comunicado, correo: null };
    return this.enviarCorreo(comunicado);
  }

  async enviarCorreo(comunicado: Comunicado): Promise<{ comunicado: Comunicado; correo: ResultadoCorreo }> {
    const correo = await this.mailer.enviar(comunicado);
    if (!correo.enviado) return { comunicado, correo };
    const actualizado = await this.comunicados.save(comunicado.marcarCorreoEnviado(this.clock.now()));
    return { comunicado: actualizado, correo };
  }
}
