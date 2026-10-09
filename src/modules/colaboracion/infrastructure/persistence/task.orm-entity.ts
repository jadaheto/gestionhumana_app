import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'tasks' })
export class TaskOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 255 }) title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) project_name!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) client_name!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) assigned_to!: string | null;
  @Column({ type: 'int', nullable: true }) creator_id!: number | null;
  @Column({ type: 'date', nullable: true }) due_date!: string | null;
  @Column({ type: 'varchar', length: 30, default: 'To Do' }) status!: string;
  @Column({ type: 'varchar', length: 20, default: 'Media' }) priority!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) updated_at!: Date;
}
