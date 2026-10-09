export interface MailAttachment {
  filename: string;
  /** Ruta absoluta en disco o contenido en memoria. */
  path?: string;
  content?: Buffer;
  contentType?: string;
}

export interface MailMessage {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}

export abstract class Mailer {
  abstract send(message: MailMessage): Promise<void>;
}
