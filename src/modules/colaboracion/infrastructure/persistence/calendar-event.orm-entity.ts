import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'calendar_events' })
export class CalendarEventOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 255 }) title!: string;
  @Column({ type: 'timestamp' }) start_date!: Date;
  @Column({ type: 'timestamp', nullable: true }) end_date!: Date | null;
  @Column({ type: 'boolean', default: false }) all_day!: boolean;
  @Column({ type: 'varchar', length: 50, default: 'bg-primary' }) class_name!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) location!: string | null;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  /** Evento institucional visible para todos los trabajadores. */
  @Column({ type: 'boolean', default: false }) para_todos!: boolean;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
