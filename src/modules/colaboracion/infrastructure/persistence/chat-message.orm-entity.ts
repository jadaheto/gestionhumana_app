import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'chat_messages' })
export class ChatMessageOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) sender_id!: number;
  @Column({ type: 'int' }) receiver_id!: number;
  @Column({ type: 'text' }) message!: string;
  @Column({ type: 'boolean', default: false }) is_read!: boolean;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
