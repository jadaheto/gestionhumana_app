import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor, actorFullName } from '../../../../shared/domain/actor';
import { NotFoundError } from '../../../../shared/domain/domain-error';
import { anioDesprendible, Desprendible } from '../../domain/desprendible';
import { CertificadoConfigReader, PerfilColaboradorReader } from '../../domain/ports';
import { CertificadoRepository, CuentaBancariaRepository, DesprendibleRepository } from '../../domain/repositories';
import { ArchivoPdfDto, DesprendibleDetalleDto, DesprendibleResumenDto, ReportesResumenDto } from '../dto/nomina.dto';
import { fechaCorta, fechaDesdeDate, pesos, pesosConSimbolo } from '../formato';
import { PdfBlock, PdfDocumentSpec, PdfRenderer } from '../ports/pdf-renderer.port';

export function toDesprendibleResumen(d: Desprendible): DesprendibleResumenDto {
  return {
    id: d.id,
    periodo: d.periodo,
    fechaInicio: d.fechaInicio,
    fechaFin: d.fechaFin,
    fechaLiquidacion: d.fechaLiquidacion,
    nroComprobante: d.nroComprobante || `NOM-${d.id}`,
    salarioBasico: d.salarioBasico,
    totalDevengado: d.totalDevengado,
    totalDeducido: d.totalDeducido,
    netoPagar: d.netoPagar,
  };
}

export function toDesprendibleDetalle(d: Desprendible): DesprendibleDetalleDto {
  return {
    ...toDesprendibleResumen(d),
    devengados: d.devengados,
    deducciones: d.deducciones,
    banco: d.banco,
    numeroCuenta: d.numeroCuenta,
  };
}

@Injectable()
export class ListDesprendiblesUseCase implements UseCase<Actor, DesprendibleResumenDto[]> {
  constructor(private readonly desprendibles: DesprendibleRepository) {}
  async execute(actor: Actor): Promise<DesprendibleResumenDto[]> {
    return (await this.desprendibles.findByUser(actor.id)).map(toDesprendibleResumen);
  }
}

@Injectable()
export class GetDesprendibleUseCase implements UseCase<{ actor: Actor; id: number }, DesprendibleDetalleDto> {
  constructor(private readonly desprendibles: DesprendibleRepository) {}
  async execute({ actor, id }: { actor: Actor; id: number }): Promise<DesprendibleDetalleDto> {
    const d = await this.desprendibles.findByIdAndUser(id, actor.id);
    if (!d) throw new NotFoundError('Desprendible', id);
    return toDesprendibleDetalle(d);
  }
}

/**
 * Genera el "COMPROBANTE DE PAGO" en PDF (port de `MiPuesto::descargar_desprendible`).
 *
 * Nota: el PDF se genera siempre a partir de los datos del desprendible. El
 * campo `archivo_pdf` guarda el PDF de la liquidación completa importada (con
 * todos los empleados), por lo que no se entrega al funcionario.
 */
@Injectable()
export class DescargarDesprendiblePdfUseCase implements UseCase<{ actor: Actor; id: number }, ArchivoPdfDto> {
  constructor(
    private readonly desprendibles: DesprendibleRepository,
    private readonly perfiles: PerfilColaboradorReader,
    private readonly config: CertificadoConfigReader,
    private readonly pdf: PdfRenderer,
    private readonly clock: Clock,
  ) {}

  async execute({ actor, id }: { actor: Actor; id: number }): Promise<ArchivoPdfDto> {
    const d = await this.desprendibles.findByIdAndUser(id, actor.id);
    if (!d) throw new NotFoundError('Desprendible', id);
    const perfil = await this.perfiles.getPerfil(actor.id);
    const cfg = await this.config.get();

    const nombre = perfil ? `${perfil.firstName} ${perfil.lastName}`.trim() : actorFullName(actor);
    const filas: string[][] = [];
    for (const [k, v] of Object.entries(d.devengados)) filas.push([k, pesos(v), '0']);
    for (const [k, v] of Object.entries(d.deducciones)) filas.push([k, '0', pesos(v)]);
    if (filas.length === 0) filas.push(['Salario', pesos(d.totalDevengado), pesos(d.totalDeducido)]);

    const blocks: PdfBlock[] = [];
    if (cfg.logoPath) blocks.push({ type: 'image', path: cfg.logoPath, height: 38, align: 'left' });
    blocks.push(
      { type: 'heading', text: 'COMPROBANTE DE PAGO', level: 2, align: 'center' },
      { type: 'paragraph', text: 'CAJA DE COMPENSACIÓN FAMILIAR DE SUCRE', align: 'center' },
      {
        type: 'keyValue',
        columns: 2,
        rows: [
          ['No. Comprobante', d.nroComprobante || String(d.id)],
          ['Fecha liquidación', d.fechaLiquidacion ? fechaCorta(d.fechaLiquidacion) : fechaDesdeDate(this.clock.now())],
        ],
      },
      { type: 'rule' },
      {
        type: 'keyValue',
        columns: 2,
        rows: [
          ['Periodo', `${fechaCorta(d.fechaInicio)} a ${fechaCorta(d.fechaFin)}`],
          ['Empleado', nombre],
          ['ID', perfil?.cedula || '-'],
          ['Cargo', perfil?.cargoNombre || '-'],
          ['Departamento', perfil?.areaNombre || '-'],
          ['Banco/Cuenta', `${d.banco ?? ''} ${d.numeroCuenta ?? ''}`.trim()],
        ],
      },
      { type: 'spacer' },
      {
        type: 'table',
        columns: [
          { header: 'CONCEPTO', width: 50 },
          { header: 'DEVENGOS', width: 25, align: 'right' },
          { header: 'DESCUENTOS', width: 25, align: 'right' },
        ],
        rows: filas,
      },
      { type: 'spacer' },
      {
        type: 'keyValue',
        columns: 1,
        rows: [
          ['TOTAL DEVENGADO', pesosConSimbolo(d.totalDevengado)],
          ['TOTAL DEDUCCIONES', pesosConSimbolo(d.totalDeducido)],
          ['NETO A PAGAR', pesosConSimbolo(d.netoPagar)],
        ],
      },
    );
    const spec: PdfDocumentSpec = { title: 'Desprendible de Nómina', author: 'Gestión Humana', margin: 30, blocks };
    return { filename: `Desprendible_${d.id}.pdf`, content: await this.pdf.render(spec) };
  }
}

/** Resumen para la pantalla "Mis reportes" (el legado sólo mostraba un marcador de posición). */
@Injectable()
export class GetReportesResumenUseCase implements UseCase<Actor, ReportesResumenDto> {
  constructor(
    private readonly desprendibles: DesprendibleRepository,
    private readonly certificados: CertificadoRepository,
    private readonly cuentas: CuentaBancariaRepository,
    private readonly clock: Clock,
  ) {}

  async execute(actor: Actor): Promise<ReportesResumenDto> {
    const [lista, certs, cuentas] = await Promise.all([
      this.desprendibles.findByUser(actor.id),
      this.certificados.findByUser(actor.id),
      this.cuentas.findByUser(actor.id),
    ]);
    const anio = this.clock.now().getFullYear();
    const ultimo = lista[0] ?? null;
    return {
      desprendibles: lista.length,
      ultimoPeriodo: ultimo
        ? { fechaInicio: ultimo.fechaInicio, fechaFin: ultimo.fechaFin, netoPagar: ultimo.netoPagar }
        : null,
      totalNetoAnioActual: lista.filter((d) => anioDesprendible(d) === anio).reduce((acc, d) => acc + d.netoPagar, 0),
      certificados: certs.length,
      cuentasBancarias: cuentas.length,
    };
  }
}
