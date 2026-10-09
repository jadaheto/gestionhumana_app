import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock.port';
import { UseCase } from '../../../../shared/application/use-case';
import { isAdmin } from '../../../../shared/domain/actor';
import { ForbiddenError, NotFoundError } from '../../../../shared/domain/domain-error';
import { ColaboradorRepository } from '../../domain/colaborador.repository';
import { BrandingReader } from '../../domain/ports';
import { CarnetDto, GetCarnetInput } from '../dto/carnet.dto';

/** Datos del carnet digital; replica `Carnet::ver` (un funcionario sólo ve el suyo). */
@Injectable()
export class GetCarnetUseCase implements UseCase<GetCarnetInput, CarnetDto> {
  constructor(
    private readonly colaboradores: ColaboradorRepository,
    private readonly branding: BrandingReader,
    private readonly clock: Clock,
  ) {}

  async execute(input: GetCarnetInput): Promise<CarnetDto> {
    const userId = input.userId ?? input.actor.id;
    if (userId !== input.actor.id && !isAdmin(input.actor)) {
      throw new ForbiddenError('No tienes permisos para ver este carnet.');
    }
    const row = await this.colaboradores.findDetalle(userId);
    if (!row) throw new NotFoundError('Colaborador', userId);
    const c = row.colaborador;
    const cargo = row.cargoNombre ?? c.props.designation ?? '';
    return {
      userId,
      nombreCompleto: c.fullName,
      cargo: cargo || 'Sin cargo',
      area: row.areaNombre ?? 'Sin área',
      sede: row.sedeNombre ?? 'N/A',
      cedula: c.props.cedula || 'N/A',
      codigoEmpresa: c.props.codigoEmpresa ?? 'N/A',
      profileImage: c.props.profileImage,
      logo: await this.branding.logoPath(),
      anio: this.clock.now().getFullYear(),
      qrData: JSON.stringify({
        nombre: c.fullName,
        cedula: c.props.cedula,
        cargo,
        area: row.areaNombre ?? '',
        codigo: c.props.codigoEmpresa ?? '',
      }),
    };
  }
}
