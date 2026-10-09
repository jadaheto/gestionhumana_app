import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'login_history' })
export class LoginHistoryOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int', nullable: true }) user_id!: number | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) device!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) location!: string | null;
  @Column({ type: 'varchar', length: 45, nullable: true }) ip_address!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) login_time!: Date;
}
