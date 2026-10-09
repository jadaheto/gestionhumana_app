import { NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
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

  it('lista sólo las cuentas del actor', async () => {
    await repo.save(
      CuentaBancaria.create({ userId: 2, banco: 'Bancolombia', tipoCuenta: 'ahorros', numeroCuenta: '111111' }),
    );
    await repo.save(
      CuentaBancaria.create({ userId: 1, banco: 'Davivienda', tipoCuenta: 'corriente', numeroCuenta: '222222' }),
    );
    const lista = await new ListCuentasBancariasUseCase(repo).execute(funcionarioActor);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ banco: 'Bancolombia', tipoCuenta: 'ahorros', numeroCuenta: '111111' });
  });

  it('crea una cuenta asignándola al actor y validando el dominio', async () => {
    const uc = new SaveCuentaBancariaUseCase(repo);
    const dto = await uc.execute({
      actor: funcionarioActor,
      input: { banco: 'BBVA', tipoCuenta: 'corriente', numeroCuenta: '98765' },
    });
    expect(dto.id).toBe(1);
    expect(repo.items[0].props.userId).toBe(2);
    await expect(
      uc.execute({ actor: funcionarioActor, input: { banco: '', tipoCuenta: 'ahorros', numeroCuenta: '1' } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('edita una cuenta propia y rechaza editar la de otro usuario', async () => {
    const ajena = await repo.save(
      CuentaBancaria.create({ userId: 1, banco: 'Davivienda', tipoCuenta: 'corriente', numeroCuenta: '222222' }),
    );
    const propia = await repo.save(
      CuentaBancaria.create({ userId: 2, banco: 'Bancolombia', tipoCuenta: 'ahorros', numeroCuenta: '111111' }),
    );
    const uc = new SaveCuentaBancariaUseCase(repo);
    const dto = await uc.execute({
      actor: funcionarioActor,
      input: { id: propia.id!, banco: 'Nequi', tipoCuenta: 'ahorros', numeroCuenta: '333333' },
    });
    expect(dto).toMatchObject({ id: propia.id, banco: 'Nequi' });
    await expect(
      uc.execute({
        actor: funcionarioActor,
        input: { id: ajena.id!, banco: 'X', tipoCuenta: 'ahorros', numeroCuenta: '444444' },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('elimina sólo cuentas propias', async () => {
    const propia = await repo.save(
      CuentaBancaria.create({ userId: 2, banco: 'B', tipoCuenta: 'ahorros', numeroCuenta: '111111' }),
    );
    const uc = new DeleteCuentaBancariaUseCase(repo);
    await expect(uc.execute({ actor: adminActor, id: propia.id! })).rejects.toBeInstanceOf(NotFoundError);
    await uc.execute({ actor: funcionarioActor, id: propia.id! });
    expect(repo.items).toHaveLength(0);
  });
});
