import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../config/configuration';
import { FileStorage } from '../../../../shared/application/ports/file-storage.port';
import { MailAttachment, Mailer } from '../../../../shared/application/ports/mailer.port';
import { Comunicado } from '../../domain/comunicado';
import { ComunicadosMailConfig } from '../../domain/comunicados-mail-config.port';
import { ResultadoCorreo } from '../dto/comunicados.dto';

/**
 * Envía un comunicado por correo al destinatario configurado (modo test o
 * producción), adjuntando imágenes y PDF y listando los vídeos como enlaces.
 * Replica `AdminComunicados::enviar_comunicado_por_correo`.
 */
@Injectable()
export class ComunicadoMailerService {
  private readonly logger = new Logger(ComunicadoMailerService.name);

  constructor(
    private readonly mailer: Mailer,
    private readonly mailConfig: ComunicadosMailConfig,
    private readonly storage: FileStorage,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async enviar(comunicado: Comunicado): Promise<ResultadoCorreo> {
    const to = await this.mailConfig.destinatario();
    if (to === '') {
      return {
        enviado: false,
        mensaje: 'Destinatario no configurado. Revisa Admin > Configuración > Correo de comunicados.',
      };
    }

    const frontend = this.config.get('frontendUrl', { infer: true }).replace(/\/+$/, '');
    const detalleUrl = `${frontend}/comunicados/ver/${comunicado.id}`;

    const videos: string[] = [];
    const adjuntos: MailAttachment[] = [];
    for (const m of comunicado.medios) {
      if (m.tipo === 'video') {
        if (m.url) videos.push(m.url);
        else if (m.archivo) videos.push(`${frontend}/uploads/${m.archivo}`);
      }
      if ((m.tipo === 'imagen' || m.tipo === 'pdf') && m.archivo && (await this.storage.exists(m.archivo))) {
        adjuntos.push({
          filename: m.archivo.split('/').pop() ?? m.archivo,
          path: this.storage.absolutePath(m.archivo),
        });
      }
    }

    const p = comunicado.props;
    const videosHtml =
      videos.length === 0
        ? ''
        : `<p><strong>Videos:</strong></p><ul>${videos
            .map((v) => `<li><a href="${escapeHtml(v)}" target="_blank">${escapeHtml(v)}</a></li>`)
            .join('')}</ul>`;

    const html = `
      <p>Hola,</p>
      <p>Se ha publicado un nuevo comunicado de la empresa.</p>
      <p><strong>Título:</strong> ${escapeHtml(p.titulo)}</p>
      <p><strong>Resumen:</strong><br>${nl2br(escapeHtml(p.resumen ?? ''))}</p>
      <p><strong>Contenido:</strong><br>${nl2br(escapeHtml(p.contenido))}</p>
      ${videosHtml}
      <p>Puedes ver el comunicado completo aquí:</p>
      <p><a href="${detalleUrl}" target="_blank">${detalleUrl}</a></p>
      <br>
      <p>Este correo fue enviado automáticamente por Comfasucre.</p>`;

    try {
      await this.mailer.send({ to, subject: `Nuevo comunicado: ${p.titulo}`, html, attachments: adjuntos });
      return { enviado: true, mensaje: 'OK' };
    } catch (e) {
      const detalle = (e instanceof Error ? e.message : String(e)).replace(/\s+/g, ' ').trim().slice(0, 300);
      this.logger.error(`Fallo envío comunicado por correo: ${detalle}`);
      return { enviado: false, mensaje: detalle || 'Error SMTP' };
    }
  }
}

export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function nl2br(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '<br>');
}
