import { Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Actor } from '../../../../shared/domain/actor';
import { NotFoundError } from '../../../../shared/domain/domain-error';
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

/** Cuentas bancarias del propio actor. */
@Injectable()
export class ListCuentasBancariasUseCase implements UseCase<Actor, CuentaBancariaDto[]> {
  constructor(private readonly cuentas: CuentaBancariaRepository) {}
  async execute(actor: Actor): Promise<CuentaBancariaDto[]> {
    return (await this.cuentas.findByUser(actor.id)).map(toCuentaDto);
  }
}

/** Crea o edita una cuenta bancaria del propio actor (el legado sólo permitía editar las propias). */
@Injectable()
export class SaveCuentaBancariaUseCase implements UseCase<{ actor: Actor; input: SaveCuentaInput }, CuentaBancariaDto> {
  constructor(private readonly cuentas: CuentaBancariaRepository) {}
  async execute({ actor, input }: { actor: Actor; input: SaveCuentaInput }): Promise<CuentaBancariaDto> {
    let existente: CuentaBancaria | null = null;
    if (input.id) {
      existente = await this.cuentas.findByIdAndUser(input.id, actor.id);
      if (!existente) throw new NotFoundError('Cuenta bancaria', input.id);
    }
    const cuenta = CuentaBancaria.create({
      id: existente?.id ?? null,
      userId: actor.id,
      banco: input.banco,
      tipoCuenta: input.tipoCuenta as TipoCuenta,
      numeroCuenta: input.numeroCuenta,
      createdAt: existente?.props.createdAt ?? null,
    });
    return toCuentaDto(await this.cuentas.save(cuenta));
  }
}

@Injectable()
export class DeleteCuentaBancariaUseCase implements UseCase<{ actor: Actor; id: number }, void> {
  constructor(private readonly cuentas: CuentaBancariaRepository) {}
  async execute({ actor, id }: { actor: Actor; id: number }): Promise<void> {
    const cuenta = await this.cuentas.findByIdAndUser(id, actor.id);
    if (!cuenta) throw new NotFoundError('Cuenta bancaria', id);
    await this.cuentas.delete(id);
  }
}
