import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor, isAdmin } from '../../../../shared/domain/actor';
import { ForbiddenError, NotFoundError } from '../../../../shared/domain/domain-error';
import { CuentaBancaria, TipoCuenta } from '../../domain/cuenta-bancaria';
import { CuentaBancariaRepository } from '../../domain/repositories';
import { CuentaBancariaDto, SaveCuentaInput } from '../dto/nomina.dto';

export function toCuentaDto(c: CuentaBancaria): CuentaBancariaDto {
  return {
    id: c.props.id ?? 0,
    banco: c.props.banco,
    tipoCuenta: c.props.tipoCuenta,
    numeroCuenta: c.props.numeroCuenta,
    createdAt: c.props.createdAt,
  };
}

/**
 * Las cuentas bancarias las registra y modifica Gestión Humana: el colaborador sólo
 * puede consultar las suyas y debe solicitar cualquier cambio por el proceso establecido.
 */
function soloAdministrador(actor: Actor): void {
  if (!isAdmin(actor)) {
    throw new ForbiddenError(
      'Las cuentas bancarias las registra Gestión Humana. Solicita el cambio por el proceso establecido.',
    );
  }
}

/** Cuentas bancarias del propio actor, o de otro colaborador si el actor es administrador. */
@Injectable()
export class ListCuentasBancariasUseCase implements UseCase<{ actor: Actor; userId?: number }, CuentaBancariaDto[]> {
  constructor(private readonly cuentas: CuentaBancariaRepository) {}
  async execute({ actor, userId }: { actor: Actor; userId?: number }): Promise<CuentaBancariaDto[]> {
    if (userId !== undefined && userId !== actor.id && !isAdmin(actor)) {
      throw new ForbiddenError('Sólo puedes consultar tus propias cuentas bancarias.');
    }
    return (await this.cuentas.findByUser(userId ?? actor.id)).map(toCuentaDto);
  }
}

/** Crea o edita la cuenta bancaria de un colaborador (sólo administradores). */
@Injectable()
export class SaveCuentaBancariaUseCase implements UseCase<{ actor: Actor; input: SaveCuentaInput }, CuentaBancariaDto> {
  constructor(private readonly cuentas: CuentaBancariaRepository) {}
  async execute({ actor, input }: { actor: Actor; input: SaveCuentaInput }): Promise<CuentaBancariaDto> {
    soloAdministrador(actor);
    const userId = input.userId ?? actor.id;
    let existente: CuentaBancaria | null = null;
    if (input.id) {
      existente = await this.cuentas.findByIdAndUser(input.id, userId);
      if (!existente) throw new NotFoundError('Cuenta bancaria', input.id);
    }
    const cuenta = CuentaBancaria.create({
      id: existente?.id ?? null,
      userId,
      banco: input.banco,
      tipoCuenta: input.tipoCuenta as TipoCuenta,
      numeroCuenta: input.numeroCuenta,
      createdAt: existente?.props.createdAt ?? null,
    });
    return toCuentaDto(await this.cuentas.save(cuenta));
  }
}

/** Elimina la cuenta bancaria de un colaborador (sólo administradores). */
@Injectable()
export class DeleteCuentaBancariaUseCase implements UseCase<{ actor: Actor; id: number; userId?: number }, void> {
  constructor(private readonly cuentas: CuentaBancariaRepository) {}
  async execute({ actor, id, userId }: { actor: Actor; id: number; userId?: number }): Promise<void> {
    soloAdministrador(actor);
    const cuenta = await this.cuentas.findByIdAndUser(id, userId ?? actor.id);
    if (!cuenta) throw new NotFoundError('Cuenta bancaria', id);
    await this.cuentas.delete(id);
  }
}
