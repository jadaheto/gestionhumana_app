import { ForbiddenError, NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, funcionarioActor } from '../../../../../shared/testing/fakes';
import { CuentaBancaria } from '../../../domain/cuenta-bancaria';
import {
  DeleteCuentaBancariaUseCase,
  ListCuentasBancariasUseCase,
  SaveCuentaBancariaUseCase,
} from '../cuentas-bancarias.use-cases';
import { InMemoryCuentaBancariaRepository } from './in-memory-nomina.repositories';

describe('Cuentas bancarias (casos de uso)', () => {
  let repo: InMemoryCuentaBancariaRepository;
  beforeEach(() => {
    repo = new InMemoryCuentaBancariaRepository();
  });

  const cuenta = (userId: number, banco: string, numeroCuenta: string) =>
    repo.save(CuentaBancaria.create({ userId, banco, tipoCuenta: 'ahorros', numeroCuenta }));

  it('el colaborador sólo ve sus cuentas; el administrador puede ver las de cualquiera', async () => {
    await cuenta(2, 'Bancolombia', '111111');
    await cuenta(1, 'Davivienda', '222222');
    const list = new ListCuentasBancariasUseCase(repo);
    const propias = await list.execute({ actor: funcionarioActor });
    expect(propias).toHaveLength(1);
    expect(propias[0]).toMatchObject({ banco: 'Bancolombia', tipoCuenta: 'ahorros', numeroCuenta: '111111' });
    await expect(list.execute({ actor: funcionarioActor, userId: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await list.execute({ actor: adminActor, userId: 2 })).toHaveLength(1);
  });

  it('el colaborador no puede crear, editar ni eliminar cuentas', async () => {
    const propia = await cuenta(2, 'Bancolombia', '111111');
    const save = new SaveCuentaBancariaUseCase(repo);
    const input = { banco: 'Nequi', tipoCuenta: 'ahorros', numeroCuenta: '333333' };
    await expect(save.execute({ actor: funcionarioActor, input })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(save.execute({ actor: funcionarioActor, input: { ...input, id: propia.id! } })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      new DeleteCuentaBancariaUseCase(repo).execute({ actor: funcionarioActor, id: propia.id! }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repo.items[0].props.banco).toBe('Bancolombia');
  });

  it('el administrador registra la cuenta de un colaborador validando el dominio', async () => {
    const uc = new SaveCuentaBancariaUseCase(repo);
    const dto = await uc.execute({
      actor: adminActor,
      input: { banco: 'BBVA', tipoCuenta: 'corriente', numeroCuenta: '98765', userId: 2 },
    });
    expect(dto.id).toBe(1);
    expect(repo.items[0].props.userId).toBe(2);
    await expect(
      uc.execute({ actor: adminActor, input: { banco: '', tipoCuenta: 'ahorros', numeroCuenta: '1', userId: 2 } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('el administrador edita y elimina la cuenta del colaborador indicado', async () => {
    const deOtro = await cuenta(5, 'Davivienda', '222222');
    const propia = await cuenta(2, 'Bancolombia', '111111');
    const save = new SaveCuentaBancariaUseCase(repo);
    const dto = await save.execute({
      actor: adminActor,
      input: { id: propia.id!, banco: 'Nequi', tipoCuenta: 'ahorros', numeroCuenta: '333333', userId: 2 },
    });
    expect(dto).toMatchObject({ id: propia.id, banco: 'Nequi' });
    // La cuenta debe pertenecer al colaborador indicado.
    await expect(
      save.execute({
        actor: adminActor,
        input: { id: deOtro.id!, banco: 'X', tipoCuenta: 'ahorros', numeroCuenta: '444444', userId: 2 },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const del = new DeleteCuentaBancariaUseCase(repo);
    await expect(del.execute({ actor: adminActor, id: deOtro.id!, userId: 2 })).rejects.toBeInstanceOf(NotFoundError);
    await del.execute({ actor: adminActor, id: propia.id!, userId: 2 });
    expect(repo.items).toHaveLength(1);
  });
});
