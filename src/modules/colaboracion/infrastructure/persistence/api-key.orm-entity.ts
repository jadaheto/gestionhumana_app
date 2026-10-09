import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'api_keys' })
export class ApiKeyOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 255 }) key_name!: string;
  @Column({ type: 'varchar', length: 255, unique: true }) generated_key!: string;
  @Column({ type: 'varchar', length: 20, default: 'Active' }) status!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
