import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'cuentas_bancarias' })
export class CuentaBancariaOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 100 }) banco!: string;
  @Column({ type: 'varchar', length: 30 }) tipo_cuenta!: string;
  @Column({ type: 'varchar', length: 30 }) numero_cuenta!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
