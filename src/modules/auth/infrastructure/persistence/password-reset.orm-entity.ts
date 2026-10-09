import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'password_resets' })
export class PasswordResetOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 255 }) email!: string;
  @Column({ type: 'varchar', length: 255, unique: true }) token!: string;
  @Column({ type: 'timestamp' }) expires_at!: Date;
  @Column({ type: 'timestamp', nullable: true }) used_at!: Date | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
