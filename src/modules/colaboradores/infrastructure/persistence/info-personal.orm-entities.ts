import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'educacion_formal' })
export class EducacionFormalOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 50 }) nivel!: string;
  @Column({ type: 'varchar', length: 200 }) institucion!: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) titulo_obtenido!: string | null;
  @Column({ type: 'date', nullable: true }) fecha_inicio!: string | null;
  @Column({ type: 'date', nullable: true }) fecha_fin!: string | null;
  @Column({ type: 'varchar', length: 30, default: 'finalizado' }) estado_estudio!: string;
  @Column({ type: 'varchar', length: 50, nullable: true }) tarjeta_profesional!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}

@Entity({ name: 'educacion_no_formal' })
export class EducacionNoFormalOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 50 }) tipo!: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) institucion!: string | null;
  @Column({ type: 'varchar', length: 200 }) nombre_programa!: string;
  @Column({ type: 'int', nullable: true }) horas!: number | null;
  @Column({ type: 'date', nullable: true }) fecha!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) certificado!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}

@Entity({ name: 'familiares' })
export class FamiliarOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 200 }) nombre_completo!: string;
  @Column({ type: 'varchar', length: 50 }) parentesco!: string;
  @Column({ type: 'date', nullable: true }) fecha_nacimiento!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) cedula!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) ocupacion!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) telefono!: string | null;
  @Column({ type: 'boolean', default: false }) dependiente!: boolean;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}

@Entity({ name: 'experiencia_laboral' })
export class ExperienciaLaboralOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) user_id!: number;
  @Column({ type: 'varchar', length: 200 }) empresa!: string;
  @Column({ type: 'varchar', length: 150 }) cargo!: string;
  @Column({ type: 'date', nullable: true }) fecha_inicio!: string | null;
  @Column({ type: 'date', nullable: true }) fecha_fin!: string | null;
  @Column({ type: 'text', nullable: true }) funciones!: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) motivo_retiro!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) telefono_contacto!: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) jefe_inmediato!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
