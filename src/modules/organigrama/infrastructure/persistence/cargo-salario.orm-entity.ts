import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Salario de referencia por cargo (tabla `cargo_salarios`, una fila por cargo). */
@Entity({ name: 'cargo_salarios' })
export class CargoSalarioOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int', unique: true }) cargo_id!: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true }) salario_2024!: string | null;
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true }) aumento_2025!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) updated_at!: Date;
}
