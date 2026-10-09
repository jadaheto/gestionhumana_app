import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ContactoChat, MensajeChat } from '../../domain/mensaje-chat';
import { ChatRepository } from '../../domain/repositories';
import { ChatMessageOrmEntity } from './chat-message.orm-entity';
import { toIso } from './fechas';

const toMensaje = (r: ChatMessageOrmEntity): MensajeChat => ({
  id: r.id,
  emisorId: r.sender_id,
  receptorId: r.receiver_id,
  mensaje: r.message,
  leido: r.is_read,
  createdAt: toIso(r.created_at) ?? '',
});

@Injectable()
export class TypeOrmChatRepository extends ChatRepository {
  constructor(
    @InjectRepository(ChatMessageOrmEntity) private readonly repo: Repository<ChatMessageOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super();
  }

  /** Misma consulta que `Chat_model::get_contacts` (todos los demás usuarios con su último mensaje y no leídos). */
  async contactos(userId: number): Promise<ContactoChat[]> {
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.profile_image, u.designation,
              cm.message AS last_message, cm.created_at AS last_message_time,
              (SELECT COUNT(*) FROM chat_messages WHERE sender_id = u.id AND receiver_id = $1 AND is_read = FALSE) AS unread_count
         FROM users u
         LEFT JOIN chat_messages cm ON cm.id = (
              SELECT id FROM chat_messages
               WHERE (sender_id = u.id AND receiver_id = $1) OR (sender_id = $1 AND receiver_id = u.id)
               ORDER BY created_at DESC, id DESC LIMIT 1)
        WHERE u.id <> $1
        ORDER BY cm.created_at DESC NULLS LAST, u.first_name ASC, u.last_name ASC`,
      [userId],
    );
    return rows.map((r) => ({
      id: Number(r['id']),
      nombre: `${r['first_name'] ?? ''} ${r['last_name'] ?? ''}`.trim(),
      profileImage: (r['profile_image'] as string | null) ?? null,
      designation: (r['designation'] as string | null) ?? null,
      ultimoMensaje: (r['last_message'] as string | null) ?? null,
      ultimoMensajeAt: toIso(r['last_message_time'] as Date | null),
      noLeidos: Number(r['unread_count'] ?? 0),
    }));
  }

  async conversacion(userId: number, contactoId: number): Promise<MensajeChat[]> {
    const rows = await this.repo
      .createQueryBuilder('m')
      .where('(m.sender_id = :u AND m.receiver_id = :c) OR (m.sender_id = :c AND m.receiver_id = :u)', {
        u: userId,
        c: contactoId,
      })
      .orderBy('m.created_at', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .getMany();
    return rows.map(toMensaje);
  }

  async guardar(emisorId: number, receptorId: number, mensaje: string, now: string): Promise<MensajeChat> {
    const saved = await this.repo.save(
      this.repo.create({
        sender_id: emisorId,
        receiver_id: receptorId,
        message: mensaje,
        is_read: false,
        created_at: new Date(now),
      }),
    );
    return toMensaje(saved);
  }

  async marcarLeidos(emisorId: number, receptorId: number): Promise<void> {
    await this.repo.update({ sender_id: emisorId, receiver_id: receptorId, is_read: false }, { is_read: true });
  }

  contarNoLeidos(userId: number): Promise<number> {
    return this.repo.count({ where: { receiver_id: userId, is_read: false } });
  }
}
