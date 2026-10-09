import { AsistenciaPolitica } from '../../../domain/asistencia-politica';
import { Marcacion, MarcacionImportada } from '../../../domain/marcacion';
import {
  AsistenciaMarcacionRepository,
  AsistenciaPoliticaRepository,
  AsistenciaRegistroRepository,
  AsistenciaResumenRepository,
  ColaboradorAsistencia,
  ColaboradoresSedeReader,
  JustificacionReader,
  NuevaImportacion,
  ResumenDiarioData,
  SedeOption,
  SedesReader,
} from '../../../domain/ports';
import { RegistroAsistencia, ResumenConColaborador, ResumenDiario } from '../../../domain/resumen-diario';
import { ArchivoMarcaciones, AsistenciaFileParser } from '../../ports/asistencia-file-parser.port';

export class InMemoryPoliticaRepository extends AsistenciaPoliticaRepository {
  items = new Map<number, AsistenciaPolitica>();
  findBySede(sedeId: number): Promise<AsistenciaPolitica | null> {
    return Promise.resolve(this.items.get(sedeId) ?? null);
  }
  save(politica: AsistenciaPolitica, _updatedAt: Date): Promise<AsistenciaPolitica> {
    this.items.set(politica.sedeId, politica);
    return Promise.resolve(politica);
  }
}

export class InMemoryMarcacionRepository extends AsistenciaMarcacionRepository {
  importaciones: NuevaImportacion[] = [];
  marcaciones: Array<Marcacion & { sedeId: number }> = [];
  private seq = 1;

  saveImportacion(importacion: NuevaImportacion): Promise<number> {
    this.importaciones.push(importacion);
    for (const m of importacion.marcaciones) {
      if (m.userId !== null) {
        this.marcaciones.push({
          id: this.seq++,
          userId: m.userId,
          sedeId: importacion.sedeId,
          fechaHora: m.fechaHora,
          tipoRegistro: m.tipoRegistro,
        });
      }
    }
    return Promise.resolve(this.importaciones.length);
  }
  findBySedeYFecha(sedeId: number, fecha: string): Promise<Marcacion[]> {
    return Promise.resolve(this.marcaciones.filter((m) => m.sedeId === sedeId && m.fechaHora.startsWith(fecha)));
  }
}

export class InMemoryResumenRepository extends AsistenciaResumenRepository {
  items: ResumenConColaborador[] = [];
  colaboradores = new Map<number, ColaboradorAsistencia>();
  private seq = 1;

  upsert(data: ResumenDiarioData): Promise<void> {
    const existente = this.items.find(
      (r) => r.userId === data.userId && r.sedeId === data.sedeId && r.fecha === data.fecha,
    );
    const c = this.colaboradores.get(data.userId);
    const base = {
      ...data,
      firstName: c?.firstName ?? null,
      lastName: c?.lastName ?? null,
      email: c?.email ?? null,
      cedula: null,
    };
    if (existente) {
      Object.assign(existente, base);
    } else {
      this.items.push({ ...base, id: this.seq++, memoEnviado: false, memoEnviadoAt: null, memoError: null });
    }
    return Promise.resolve();
  }
  findByFechaYSede(fecha: string, sedeId: number): Promise<ResumenConColaborador[]> {
    return Promise.resolve(this.items.filter((r) => r.fecha === fecha && r.sedeId === sedeId));
  }
  findTardePendientesMemo(fecha: string, sedeId: number): Promise<ResumenConColaborador[]> {
    return Promise.resolve(
      this.items.filter(
        (r) => r.fecha === fecha && r.sedeId === sedeId && r.minutosTarde > 0 && !r.memoEnviado && !!r.email,
      ),
    );
  }
  markMemo(id: number, ok: boolean, error: string | null, at: Date): Promise<void> {
    const r = this.items.find((x) => x.id === id);
    if (r) {
      r.memoEnviado = ok;
      r.memoEnviadoAt = ok ? at : null;
      r.memoError = ok ? null : error;
    }
    return Promise.resolve();
  }
  findByUsuarioYRango(userId: number, desde: string, hasta: string): Promise<ResumenDiario[]> {
    return Promise.resolve(this.items.filter((r) => r.userId === userId && r.fecha >= desde && r.fecha <= hasta));
  }
}

export class InMemoryRegistroRepository extends AsistenciaRegistroRepository {
  items: RegistroAsistencia[] = [];
  findByUsuarioYRango(userId: number, desde: string, hasta: string): Promise<RegistroAsistencia[]> {
    return Promise.resolve(this.items.filter((r) => r.userId === userId && r.fecha >= desde && r.fecha <= hasta));
  }
}

export class InMemoryColaboradoresReader extends ColaboradoresSedeReader {
  /** { sedeId → colaboradores } */
  porSede = new Map<number, Array<ColaboradorAsistencia & { cedula?: string; codigo?: string }>>();
  findActivosBySede(sedeId: number): Promise<ColaboradorAsistencia[]> {
    return Promise.resolve(this.porSede.get(sedeId) ?? []);
  }
  resolveUserId(identificacion: string, sedeId: number): Promise<number | null> {
    const c = (this.porSede.get(sedeId) ?? []).find((x) => x.cedula === identificacion || x.codigo === identificacion);
    return Promise.resolve(c?.id ?? null);
  }
}

export class InMemoryJustificacionReader extends JustificacionReader {
  justificaciones = new Map<string, string>(); // `${userId}|${fecha}` → texto
  justificacionDia(userId: number, fecha: string): Promise<string> {
    return Promise.resolve(this.justificaciones.get(`${userId}|${fecha}`) ?? '');
  }
}

export class InMemorySedesReader extends SedesReader {
  items: SedeOption[] = [{ id: 1, nombre: 'Principal' }];
  listActivas(): Promise<SedeOption[]> {
    return Promise.resolve(this.items);
  }
}

export class FakeFileParser extends AsistenciaFileParser {
  filas: MarcacionImportada[] = [];
  parse(_archivo: ArchivoMarcaciones): Promise<MarcacionImportada[]> {
    return Promise.resolve(this.filas);
  }
}
