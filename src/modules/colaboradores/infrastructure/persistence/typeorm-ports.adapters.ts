import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BrandingReader,
  ContratoActivo,
  ContratoActivoReader,
  LoginHistoryItem,
  LoginHistoryReader,
  PuntosInitializer,
} from '../../domain/ports';

/** Igual que `Colaborador_model::get_contrato_activo`. */
@Injectable()
export class SqlContratoActivoReader extends ContratoActivoReader {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }
  async findActivo(userId: number): Promise<ContratoActivo | null> {
    const rows: Array<{
      id: number;
      tipo_contrato: string;
      numero_contrato: string;
      fecha_inicio: string;
      fecha_fin: string | null;
      salario_base: string;
      estado: string;
    }> = await this.dataSource.query(
      `SELECT id, tipo_contrato, numero_contrato, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
                to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin, salario_base, estado
           FROM contratos WHERE user_id = $1 AND estado = 'activo'
          ORDER BY fecha_inicio DESC LIMIT 1`,
      [userId],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      tipoContrato: r.tipo_contrato,
      numeroContrato: r.numero_contrato,
      fechaInicio: r.fecha_inicio,
      fechaFin: r.fecha_fin,
      salarioBase: Number(r.salario_base),
      estado: r.estado,
    };
  }
}

/** Crea la fila de `puntos` del nuevo colaborador (idempotente). */
@Injectable()
export class SqlPuntosInitializer extends PuntosInitializer {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }
  async initialize(userId: number): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO puntos (user_id, puntos_actuales, puntos_totales_ganados) VALUES ($1, 0, 0) ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
  }
}

/** Igual que `User_model::get_login_history`. */
@Injectable()
export class SqlLoginHistoryReader extends LoginHistoryReader {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }
  async findRecent(userId: number, limit: number): Promise<LoginHistoryItem[]> {
    const rows: Array<{
      id: number;
      device: string | null;
      location: string | null;
      ip_address: string | null;
      login_time: Date;
    }> = await this.dataSource.query(
      `SELECT id, device, location, ip_address, login_time FROM login_history WHERE user_id = $1 ORDER BY login_time DESC LIMIT $2`,
      [userId, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      device: r.device ?? '',
      location: r.location ?? '',
      ipAddress: r.ip_address ?? '',
      loginTime: r.login_time,
    }));
  }
}

/** Lee `branding_logo_light` de `app_settings`; sólo se expone si es un archivo de `uploads`. */
@Injectable()
export class SqlBrandingReader extends BrandingReader {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }
  async logoPath(): Promise<string | null> {
    const rows: Array<{ value: string | null }> = await this.dataSource.query(
      `SELECT value FROM app_settings WHERE setting_key = 'branding_logo_light' LIMIT 1`,
    );
    const value = (rows[0]?.value ?? '').trim();
    if (value === '') return null;
    return value.startsWith('uploads/') ? value.slice('uploads/'.length) : null;
  }
}
