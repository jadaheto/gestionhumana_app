import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Vista previa temporal de una importación de nómina (fase 1 → fase 2).
 * Sustituye el `uploads/nomina/preview_<token>.json` del legado.
 * Tabla creada por la migración `NominaImportPreviews`.
 */
@Entity({ name: 'nomina_import_previews' })
export class NominaImportPreviewOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 }) token!: string;
  @Column({ type: 'int', nullable: true }) lote_id!: number | null;
  @Column({ type: 'varchar', length: 255 }) archivo!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) archivo_original!: string | null;
  @Column({ type: 'jsonb' }) parsed!: Record<string, unknown>;
  @Column({ type: 'int', default: 0 }) nuevos!: number;
  @Column({ type: 'int', default: 0 }) existentes!: number;
  @Column({ type: 'jsonb', nullable: true }) lote_previo!: Record<string, unknown> | null;
  @Column({ type: 'int', default: 0 }) procesados!: number;
  @Column({ type: 'int', nullable: true }) created_by!: number | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
