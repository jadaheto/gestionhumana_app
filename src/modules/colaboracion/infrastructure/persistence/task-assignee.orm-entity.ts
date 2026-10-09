import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'task_assignees' })
export class TaskAssigneeOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) task_id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) assigned_at!: Date;
}
