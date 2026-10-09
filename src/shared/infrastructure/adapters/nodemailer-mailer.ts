import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AppConfig } from '../../../config/configuration';
import { Mailer, MailMessage } from '../../application/ports/mailer.port';

@Injectable()
export class NodemailerMailer extends Mailer {
  private readonly logger = new Logger(NodemailerMailer.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    super();
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;
    const mail = this.config.get('mail', { infer: true });
    if (!mail.host) {
      return null;
    }
    this.transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
    });
    return this.transporter;
  }

  async send(message: MailMessage): Promise<void> {
    const mail = this.config.get('mail', { infer: true });
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.warn(`SMTP no configurado. Correo omitido: "${message.subject}" → ${String(message.to)}`);
      return;
    }
    await transporter.sendMail({
      from: `"${mail.fromName}" <${mail.fromEmail}>`,
      to: message.to,
      subject: message.subject,
      html: message.html,
      attachments: message.attachments,
    });
  }
}
