import {
  ColaboradorBasico,
  ColaboradorFinder,
  EndeudamientoRepository,
  SalarioReferenciaReader,
  SolicitudPersistida,
  SolicitudPersistidaConConceptos,
} from '../../../domain/ports';
import { SolicitudEndeudamiento } from '../../../domain/solicitud-endeudamiento';

export class InMemoryEndeudamientoRepository extends EndeudamientoRepository {
  items: SolicitudPersistidaConConceptos[] = [];
  colaboradores = new Map<number, ColaboradorBasico>();
  private seq = 1;

  findAll(): Promise<SolicitudPersistida[]> {
    return Promise.resolve(
      [...this.items].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
    );
  }
  findById(id: number): Promise<SolicitudPersistidaConConceptos | null> {
    return Promise.resolve(this.items.find((s) => s.id === id) ?? null);
  }
  save(s: SolicitudEndeudamiento, createdBy: number, createdAt: Date): Promise<number> {
    const id = this.seq++;
    const p = s.props;
    const c = p.calculo;
    this.items.push({
      id,
      userId: p.userId,
      solicitudNo: p.solicitudNo,
      fecha: p.fecha,
      anio: p.anio,
      libranza: p.libranza,
      salarioMensual: p.salarioMensual,
      otrosDevengados: p.otrosDevengados,
      totalDevengado: c.totalDevengado,
      totalDeducido: c.totalDeducido,
      netoActual: c.netoActual,
      deduccionesLey: p.deduccionesLey,
      deduccionesEndeudamiento: c.deduccionesEndeudamiento,
      porcentajeActual: c.porcentajeActual,
      valorSolicitado: p.valorSolicitado,
      plazoMeses: p.plazoMeses,
      cuotaMensual: p.cuotaMensual,
      valorQuincenal: c.valorQuincenal,
      porcentajeNuevoCredito: c.porcentajeNuevoCredito,
      netoRecibir: c.netoRecibir,
      umbralAprobacion: c.umbralAprobacion,
      opcionCredito: p.opcionCredito,
      conclusion: p.conclusion,
      estado: c.estado,
      createdBy,
      createdAt,
      colaborador: this.colaboradores.get(p.userId) ?? null,
      conceptos: c.conceptos.map((x, i) => ({ ...x, id: i + 1, orden: i + 1 })),
    });
    return Promise.resolve(id);
  }
  countByAnio(anio: number): Promise<number> {
    return Promise.resolve(this.items.filter((s) => s.anio === anio).length);
  }
}

export class InMemoryColaboradorFinder extends ColaboradorFinder {
  items: ColaboradorBasico[] = [];
  search(q: string): Promise<ColaboradorBasico[]> {
    const t = q.toLowerCase();
    return Promise.resolve(
      this.items
        .filter(
          (c) =>
            t === '' ||
            [c.firstName, c.lastName, c.cedula, c.codigoEmpresa].some((v) => (v ?? '').toLowerCase().includes(t)),
        )
        .slice(0, 20),
    );
  }
  findById(id: number): Promise<ColaboradorBasico | null> {
    return Promise.resolve(this.items.find((c) => c.id === id) ?? null);
  }
}

export class InMemorySalarioReferenciaReader extends SalarioReferenciaReader {
  salarios = new Map<number, number>();
  salarioReferencia(userId: number): Promise<number> {
    return Promise.resolve(this.salarios.get(userId) ?? 0);
  }
}
