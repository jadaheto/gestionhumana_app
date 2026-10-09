import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor, isAdmin } from '../../../../shared/domain/actor';
import { ForbiddenError, NotFoundError } from '../../../../shared/domain/domain-error';
import { Contrato } from '../../domain/contrato';
import { UsuariosPort } from '../../domain/ports';
import { ContratoProrrogaRepository, ContratoRepository } from '../../domain/repositories';
import {
  ColaboradorDto,
  ContratoDto,
  GuardarContratoInput,
  ProrrogaDto,
  ProrrogaRegistradaDto,
  RegistrarProrrogaInput,
} from '../dto/contratos.dto';
import { toContratoDto, toProrrogaDto } from './mappers';
import { NotificarContratosPorVencerUseCase } from './notificar-contratos-por-vencer.use-case';
import { SincronizarContratosVencidosUseCase } from './sincronizar-contratos-vencidos.use-case';

/**
 * `Contratos::index`: sincroniza vencidos (una vez al día), y para el admin
 * genera las alertas de vencimiento y devuelve todos los contratos; el
 * funcionario solo ve los suyos.
 */
@Injectable()
export class ListarContratosUseCase implements UseCase<{ actor: Actor }, ContratoDto[]> {
  constructor(
    private readonly contratos: ContratoRepository,
    private readonly sincronizar: SincronizarContratosVencidosUseCase,
    private readonly notificar: NotificarContratosPorVencerUseCase,
    private readonly clock: Clock,
  ) {}

  async execute({ actor }: { actor: Actor }): Promise<ContratoDto[]> {
    await this.sincronizar.execute({ forzar: false });
    const hoy = this.clock.today();
    if (isAdmin(actor)) {
      await this.notificar.execute();
      return (await this.contratos.findAll()).map((r) => toContratoDto(r, hoy));
    }
    return (await this.contratos.findByUser(actor.id)).map((r) => toContratoDto(r, hoy));
  }
}

/** Detalle de un contrato. El funcionario solo puede ver los propios. */
@Injectable()
export class ObtenerContratoUseCase implements UseCase<{ actor: Actor; id: number }, ContratoDto> {
  constructor(
    private readonly contratos: ContratoRepository,
    private readonly clock: Clock,
  ) {}

  async execute({ actor, id }: { actor: Actor; id: number }): Promise<ContratoDto> {
    const row = await this.contratos.findByIdConColaborador(id);
    if (!row) throw new NotFoundError('Contrato', id);
    if (!isAdmin(actor) && row.contrato.props.userId !== actor.id) throw new ForbiddenError();
    return toContratoDto(row, this.clock.today());
  }
}

/** `Contratos::guardar` (crear o actualizar). Tras guardar sincroniza vencidos como el legado. */
@Injectable()
export class GuardarContratoUseCase implements UseCase<GuardarContratoInput, ContratoDto> {
  constructor(
    private readonly contratos: ContratoRepository,
    private readonly usuarios: UsuariosPort,
    private readonly sincronizar: SincronizarContratosVencidosUseCase,
    private readonly clock: Clock,
  ) {}

  async execute(input: GuardarContratoInput): Promise<ContratoDto> {
    let existente: Contrato | null = null;
    if (input.id) {
      existente = await this.contratos.findById(input.id);
      if (!existente) throw new NotFoundError('Contrato', input.id);
    }
    // En edición el legado no permite cambiar el colaborador (campo oculto).
    const userId = existente ? existente.props.userId : input.userId;
    if (!existente && !(await this.usuarios.existeUsuario(userId))) throw new NotFoundError('Colaborador', userId);

    const contrato = Contrato.create({
      id: existente?.props.id ?? null,
      userId,
      tipoContrato: input.tipoContrato,
      numeroContrato: input.numeroContrato,
      fechaInicio: input.fechaInicio,
      fechaFin: input.fechaFin,
      salarioBase: input.salarioBase,
      estado: input.estado ?? 'activo',
      observaciones: input.observaciones,
      createdAt: existente?.props.createdAt ?? null,
    });
    const saved = await this.contratos.save(contrato);
    await this.sincronizar.execute({ forzar: true });
    const row = await this.contratos.findByIdConColaborador(saved.props.id!);
    if (!row) throw new NotFoundError('Contrato', saved.props.id!);
    return toContratoDto(row, this.clock.today());
  }
}

/** `Contratos::eliminar`. */
@Injectable()
export class EliminarContratoUseCase implements UseCase<number, void> {
  constructor(
    private readonly contratos: ContratoRepository,
    private readonly sincronizar: SincronizarContratosVencidosUseCase,
  ) {}

  async execute(id: number): Promise<void> {
    if (!(await this.contratos.findById(id))) throw new NotFoundError('Contrato', id);
    await this.contratos.delete(id);
    await this.sincronizar.execute({ forzar: true });
  }
}

/** `Contratos::prorrogar` + `Contrato_model::registrar_prorroga`. */
@Injectable()
export class RegistrarProrrogaUseCase implements UseCase<RegistrarProrrogaInput, ProrrogaRegistradaDto> {
  constructor(
    private readonly contratos: ContratoRepository,
    private readonly prorrogas: ContratoProrrogaRepository,
    private readonly usuarios: UsuariosPort,
    private readonly clock: Clock,
  ) {}

  async execute(input: RegistrarProrrogaInput): Promise<ProrrogaRegistradaDto> {
    if (!isAdmin(input.actor)) throw new ForbiddenError();
    const contrato = await this.contratos.findById(input.contratoId);
    if (!contrato) throw new NotFoundError('Contrato', input.contratoId);

    const resultado = contrato.prorrogar(input.meses);
    await this.prorrogas.registrar(
      {
        id: null,
        contratoId: contrato.props.id!,
        userId: contrato.props.userId,
        fechaFinAnterior: resultado.fechaFinAnterior,
        mesesProrroga: resultado.meses,
        fechaInicioProrroga: resultado.fechaInicioProrroga,
        fechaFinNueva: resultado.fechaFinNueva,
        observacion: input.observacion.trim() || null,
        creadoPor: input.actor.id,
        createdAt: this.clock.now(),
      },
      resultado.contrato,
    );
    await this.usuarios.sincronizarEstadoPorContratos(this.clock.today());
    return {
      contratoId: contrato.props.id!,
      fechaFinAnterior: resultado.fechaFinAnterior,
      fechaFinNueva: resultado.fechaFinNueva,
      meses: resultado.meses,
    };
  }
}

/** Historial de prórrogas de un contrato (admin o dueño). */
@Injectable()
export class ListarProrrogasUseCase implements UseCase<{ actor: Actor; contratoId: number }, ProrrogaDto[]> {
  constructor(
    private readonly contratos: ContratoRepository,
    private readonly prorrogas: ContratoProrrogaRepository,
  ) {}

  async execute({ actor, contratoId }: { actor: Actor; contratoId: number }): Promise<ProrrogaDto[]> {
    const contrato = await this.contratos.findById(contratoId);
    if (!contrato) throw new NotFoundError('Contrato', contratoId);
    if (!isAdmin(actor) && contrato.props.userId !== actor.id) throw new ForbiddenError();
    return (await this.prorrogas.findByContrato(contratoId)).map(toProrrogaDto);
  }
}

/** Colaboradores para el select del formulario (solo lectura). */
@Injectable()
export class ListarColaboradoresUseCase implements UseCase<void, ColaboradorDto[]> {
  constructor(private readonly usuarios: UsuariosPort) {}
  execute(): Promise<ColaboradorDto[]> {
    return this.usuarios.listarColaboradores();
  }
}
