import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../../config/configuration';
import { JwtPayload, JwtStrategy, ROL_ACTIVO_HEADER } from '../jwt.strategy';

describe('JwtStrategy', () => {
  const config = { get: () => ({ secret: 'secreto-de-prueba' }) } as unknown as ConfigService<AppConfig, true>;
  const strategy = new JwtStrategy(config);
  const payload = (role: string): JwtPayload => ({
    sub: 7,
    username: 'ana',
    role,
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@comfasucre.com.co',
  });
  const req = (rol?: string) => ({ headers: rol ? { [ROL_ACTIVO_HEADER]: rol } : {} });

  it('conserva el rol del token cuando no se pide otro', () => {
    expect(strategy.validate(req(), payload('admin')).role).toBe('admin');
    expect(strategy.validate(req(), payload('funcionario')).role).toBe('funcionario');
  });

  it('un administrador en modo colaborador actúa como funcionario', () => {
    const actor = strategy.validate(req('funcionario'), payload('admin'));
    expect(actor).toMatchObject({ id: 7, username: 'ana', role: 'funcionario' });
  });

  it('la cabecera nunca sube de rol a un funcionario', () => {
    expect(strategy.validate(req('admin'), payload('funcionario')).role).toBe('funcionario');
  });

  it('rechaza roles desconocidos', () => {
    expect(() => strategy.validate(req(), payload('otro'))).toThrow();
  });
});
