import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EndeudamientoRepository, SolicitudPersistida, SolicitudPersistidaConConceptos } from '../../domain/ports';
import { SolicitudEndeudamiento } from '../../domain/solicitud-endeudamiento';

interface SolicitudRow {
  id: number;
  user_id: number;
  solicitud_no: string;
  fecha: string;
  anio: number | null;
  libranza: string | null;
  salario_mensual: string;
  otros_devengados: string;
  total_devengado: string;
  total_deducido: string;
  neto_actual: string;
  deducciones_ley: string;
  deducciones_endeudamiento: string;
  porcentaje_actual: string;
  valor_solicitado: string;
  plazo_meses: number;
  cuota_mensual: string;
  valor_quincenal: string;
  porcentaje_nuevo_credito: string;
  neto_recibir: string;
  umbral_aprobacion: string;
  opcion_credito: string | null;
  conclusion: string | null;
  estado: string;
  created_by: number | null;
  created_at: Date | null;
  first_name: string | null;
  last_name: string | null;
  cedula: string | null;
  codigo_empresa: string | null;
}

interface ConceptoRow {
  id: number;
  concepto: string;
  devengado: string;
  deducido: string;
  porcentaje: string;
  orden: number;
}

const SELECT = `e.id, e.user_id, e.solicitud_no, to_char(e.fecha, 'YYYY-MM-DD') AS fecha, e.anio, e.libranza,
  e.salario_mensual, e.otros_devengados, e.total_devengado, e.total_deducido, e.neto_actual, e.deducciones_ley,
  e.deducciones_endeudamiento, e.porcentaje_actual, e.valor_solicitado, e.plazo_meses, e.cuota_mensual, e.valor_quincenal,
  e.porcentaje_nuevo_credito, e.neto_recibir, e.umbral_aprobacion, e.opcion_credito, e.conclusion, e.estado, e.created_by,
  e.created_at, u.first_name, u.last_name, u.cedula, u.codigo_empresa`;

const n = (v: string | number | null | undefined) => Number(v ?? 0);

function toSolicitud(r: SolicitudRow): SolicitudPersistida {
  return {
    id: Number(r.id),
    userId: Number(r.user_id),
    solicitudNo: r.solicitud_no,
    fecha: r.fecha,
    anio: r.anio === null ? null : Number(r.anio),
    libranza: r.libranza,
    salarioMensual: n(r.salario_mensual),
    otrosDevengados: n(r.otros_devengados),
    totalDevengado: n(r.total_devengado),
    totalDeducido: n(r.total_deducido),
    netoActual: n(r.neto_actual),
    deduccionesLey: n(r.deducciones_ley),
    deduccionesEndeudamiento: n(r.deducciones_endeudamiento),
    porcentajeActual: n(r.porcentaje_actual),
    valorSolicitado: n(r.valor_solicitado),
    plazoMeses: n(r.plazo_meses),
    cuotaMensual: n(r.cuota_mensual),
    valorQuincenal: n(r.valor_quincenal),
    porcentajeNuevoCredito: n(r.porcentaje_nuevo_credito),
    netoRecibir: n(r.neto_recibir),
    umbralAprobacion: n(r.umbral_aprobacion),
    opcionCredito: r.opcion_credito,
    conclusion: r.conclusion,
    estado: r.estado,
    createdBy: r.created_by === null ? null : Number(r.created_by),
    createdAt: r.created_at ? new Date(r.created_at) : null,
    colaborador:
      r.first_name === null && r.last_name === null && r.cedula === null
        ? null
        : {
            id: Number(r.user_id),
            firstName: r.first_name,
            lastName: r.last_name,
            cedula: r.cedula,
            codigoEmpresa: r.codigo_empresa,
          },
  };
}

@Injectable()
export class TypeOrmEndeudamientoRepository extends EndeudamientoRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async findAll(): Promise<SolicitudPersistida[]> {
    const rows: SolicitudRow[] = await this.dataSource.query(
      `SELECT ${SELECT} FROM endeudamiento_solicitudes e LEFT JOIN users u ON u.id = e.user_id ORDER BY e.created_at DESC, e.id DESC`,
    );
    return rows.map(toSolicitud);
  }

  async findById(id: number): Promise<SolicitudPersistidaConConceptos | null> {
    const rows: SolicitudRow[] = await this.dataSource.query(
      `SELECT ${SELECT} FROM endeudamiento_solicitudes e LEFT JOIN users u ON u.id = e.user_id WHERE e.id = $1`,
      [id],
    );
    if (rows.length === 0) return null;
    const conceptos: ConceptoRow[] = await this.dataSource.query(
      `SELECT id, concepto, devengado, deducido, porcentaje, orden FROM endeudamiento_conceptos WHERE solicitud_id = $1 ORDER BY orden ASC, id ASC`,
      [id],
    );
    return {
      ...toSolicitud(rows[0]),
      conceptos: conceptos.map((c) => ({
        id: Number(c.id),
        concepto: c.concepto,
        devengado: n(c.devengado),
        deducido: n(c.deducido),
        porcentaje: n(c.porcentaje),
        orden: n(c.orden),
      })),
    };
  }

  async save(s: SolicitudEndeudamiento, createdBy: number, createdAt: Date): Promise<number> {
    const p = s.props;
    const c = p.calculo;
    return this.dataSource.transaction(async (em) => {
      const [{ id }]: Array<{ id: number }> = await em.query(
        `INSERT INTO endeudamiento_solicitudes
           (user_id, solicitud_no, fecha, anio, libranza, salario_mensual, otros_devengados, total_devengado, total_deducido,
            neto_actual, deducciones_ley, deducciones_endeudamiento, porcentaje_actual, valor_solicitado, plazo_meses,
            cuota_mensual, valor_quincenal, porcentaje_nuevo_credito, neto_recibir, umbral_aprobacion, opcion_credito,
            conclusion, estado, created_by, created_at, updated_at)
         VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $25)
         RETURNING id`,
        [
          p.userId,
          p.solicitudNo,
          p.fecha,
          p.anio,
          p.libranza,
          p.salarioMensual,
          p.otrosDevengados,
          c.totalDevengado,
          c.totalDeducido,
          c.netoActual,
          p.deduccionesLey,
          c.deduccionesEndeudamiento,
          c.porcentajeActual,
          p.valorSolicitado,
          p.plazoMeses,
          p.cuotaMensual,
          c.valorQuincenal,
          c.porcentajeNuevoCredito,
          c.netoRecibir,
          c.umbralAprobacion,
          p.opcionCredito,
          p.conclusion,
          c.estado,
          createdBy,
          createdAt,
        ],
      );
      let orden = 1;
      for (const con of c.conceptos) {
        await em.query(
          `INSERT INTO endeudamiento_conceptos (solicitud_id, concepto, devengado, deducido, porcentaje, orden, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, con.concepto.slice(0, 150), con.devengado, con.deducido, con.porcentaje, orden++, createdAt],
        );
      }
      return Number(id);
    });
  }

  async countByAnio(anio: number): Promise<number> {
    const rows: Array<{ total: string }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM endeudamiento_solicitudes WHERE anio = $1`,
      [anio],
    );
    return Number(rows[0]?.total ?? 0);
  }
}
