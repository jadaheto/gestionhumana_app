import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Tabla `contrato_alertas` con índice único (contrato, destinatario, tipo, fecha). */
@Entity({ name: 'contrato_alertas' })
@Index('idx_contrato_alertas_unique', ['contrato_id', 'destinatario_id', 'alerta_tipo', 'alerta_fecha'], {
  unique: true,
})
export class ContratoAlertaOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'int' }) contrato_id!: number;
  @Column({ type: 'int' }) destinatario_id!: number;
  @Column({ type: 'varchar', length: 30 }) alerta_tipo!: string;
  @Column({ type: 'date' }) alerta_fecha!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
