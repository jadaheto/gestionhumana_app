import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Configuración global clave/valor (`app_settings`). */
@Entity({ name: 'app_settings' })
export class AppSettingOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 }) setting_key!: string;
  @Column({ type: 'text', nullable: true }) value!: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) updated_at!: Date;
}
