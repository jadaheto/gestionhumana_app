import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Relación jerárquica entre cargos (tabla `organigrama`). */
@Entity({ name: 'organigrama' })
export class OrganigramaOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) cargo_id!: number;
  @Column({ type: 'int', nullable: true }) cargo_padre_id!: number | null;
  @Column({ type: 'int', default: 0 }) orden!: number;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
