import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Buzón interno (`emails`): cada envío genera una fila `inbox` para el receptor y una `sent` para el emisor. */
@Entity({ name: 'emails' })
export class EmailOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int', nullable: true }) sender_id!: number | null;
  @Column({ type: 'int', nullable: true }) receiver_id!: number | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) to_email!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) subject!: string | null;
  @Column({ type: 'text', nullable: true }) body!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'inbox' }) folder!: string;
  @Column({ type: 'boolean', default: false }) is_read!: boolean;
  @Column({ type: 'timestamp', nullable: true }) sent_at!: Date | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
