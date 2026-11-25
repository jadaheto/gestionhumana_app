import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Tabla `users`. Es la tabla central del sistema (usuarios = colaboradores),
 * por eso su entidad ORM vive en el núcleo compartido y la reutilizan los
 * módulos (auth, colaboradores, contratos, etc.).
 */
@Entity({ name: 'users' })
export class UserOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 100, unique: true }) username!: string;
  @Column({ type: 'varchar', length: 255, unique: true }) email!: string;
  @Column({ type: 'varchar', length: 255 }) password!: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) first_name!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) last_name!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) phone_number!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) designation!: string | null;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) profile_image!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) cover_image!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) city!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) country!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) zip_code!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) website!: string | null;
  @Column({ type: 'text', nullable: true }) skills!: string | null;
  @Column({ type: 'date', nullable: true }) joining_date!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'funcionario' }) role!: string;
  /** Un administrador que además es empleado: aparece en colaboradores, organigrama, conteos, etc. */
  @Column({ type: 'boolean', default: false }) es_colaborador!: boolean;
  /** Designado por Gestión Humana para crear eventos para todos los trabajadores. */
  @Column({ type: 'boolean', default: false }) puede_crear_eventos!: boolean;
  @Column({ type: 'jsonb', default: () => `'{"language":"es","theme":"light"}'` })
  ui_preferences!: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => `'{}'` }) privacy_settings!: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => `'[]'` }) experience!: unknown[];
  @Column({ type: 'varchar', length: 100, nullable: true }) github_username!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) dribbble_username!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) pinterest_username!: string | null;
  // Campos de Gestión Humana
  @Column({ type: 'varchar', length: 20, nullable: true }) cedula!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) codigo_empresa!: string | null;
  @Column({ type: 'int', nullable: true }) sede_id!: number | null;
  @Column({ type: 'int', nullable: true }) area_id!: number | null;
  @Column({ type: 'int', nullable: true }) cargo_id!: number | null;
  @Column({ type: 'varchar', length: 20, default: 'activo' }) estado_colaborador!: string;
  @Column({ type: 'date', nullable: true }) fecha_nacimiento!: string | null;
  @Column({ type: 'date', nullable: true }) fecha_ingreso!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) genero!: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) estado_civil!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) direccion!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) telefono!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) celular!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) eps!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) arl!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) fondo_pension!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) caja_compensacion!: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) tipo_sangre!: string | null;
  @Column({ type: 'int', default: 0 }) numero_hijos!: number;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) updated_at!: Date;
}
