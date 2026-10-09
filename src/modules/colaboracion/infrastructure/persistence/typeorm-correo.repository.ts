import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CarpetaCorreo, CorreoInterno, NuevoCorreo } from '../../domain/correo-interno';
import { CorreoRepository } from '../../domain/repositories';
import { EmailOrmEntity } from './email.orm-entity';
import { toIso } from './fechas';

type Row = Record<string, unknown>;
const SELECT = `
  SELECT e.id, e.sender_id, e.receiver_id, e.subject, e.body, e.folder, e.is_read, e.created_at,
         su.email AS from_email, TRIM(CONCAT(su.first_name, ' ', su.last_name)) AS from_name,
         COALESCE(ru.email, e.to_email) AS to_email, TRIM(CONCAT(ru.first_name, ' ', ru.last_name)) AS to_name
    FROM emails e
    LEFT JOIN users su ON su.id = e.sender_id
    LEFT JOIN users ru ON ru.id = e.receiver_id`;

const toCorreo = (r: Row): CorreoInterno => ({
  id: Number(r['id']),
  emisorId: r['sender_id'] === null ? null : Number(r['sender_id']),
  receptorId: r['receiver_id'] === null ? null : Number(r['receiver_id']),
  deNombre: ((r['from_name'] as string) || null) ?? null,
  deEmail: (r['from_email'] as string | null) ?? null,
  paraNombre: ((r['to_name'] as string) || null) ?? null,
  paraEmail: (r['to_email'] as string | null) ?? null,
  asunto: (r['subject'] as string | null) ?? null,
  cuerpo: (r['body'] as string | null) ?? null,
  carpeta: r['folder'] === 'sent' ? 'sent' : 'inbox',
  leido: Boolean(r['is_read']),
  createdAt: toIso(r['created_at'] as Date) ?? '',
});

@Injectable()
export class TypeOrmCorreoRepository extends CorreoRepository {
  constructor(
    @InjectRepository(EmailOrmEntity) private readonly repo: Repository<EmailOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super();
  }

  async buzon(userId: number, carpeta: CarpetaCorreo): Promise<CorreoInterno[]> {
    const where =
      carpeta === 'sent' ? `e.sender_id = $1 AND e.folder = 'sent'` : `e.receiver_id = $1 AND e.folder = 'inbox'`;
    const rows: Row[] = await this.dataSource.query(`${SELECT} WHERE ${where} ORDER BY e.created_at DESC, e.id DESC`, [
      userId,
    ]);
    return rows.map(toCorreo);
  }

  async findById(id: number, userId: number): Promise<CorreoInterno | null> {
    const rows: Row[] = await this.dataSource.query(
      `${SELECT} WHERE e.id = $1 AND (e.sender_id = $2 OR e.receiver_id = $2)`,
      [id, userId],
    );
    return rows[0] ? toCorreo(rows[0]) : null;
  }

  async guardar(correo: NuevoCorreo): Promise<number> {
    const saved = await this.repo.save(
      this.repo.create({
        sender_id: correo.emisorId,
        receiver_id: correo.receptorId,
        subject: correo.asunto,
        body: correo.cuerpo,
        folder: correo.carpeta,
        is_read: correo.leido,
        sent_at: new Date(correo.createdAt),
        created_at: new Date(correo.createdAt),
      }),
    );
    return saved.id;
  }

  async marcarLeido(id: number, receptorId: number): Promise<void> {
    await this.repo.update({ id, receiver_id: receptorId, folder: 'inbox' }, { is_read: true });
  }

  contarNoLeidos(userId: number): Promise<number> {
    return this.repo.count({ where: { receiver_id: userId, folder: 'inbox', is_read: false } });
  }
}
