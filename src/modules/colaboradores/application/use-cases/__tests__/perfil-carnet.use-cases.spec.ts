import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../../../shared/domain/domain-error';
import {
  adminActor,
  FakeClock,
  FakePasswordHasher,
  funcionarioActor,
  InMemoryFileStorage,
} from '../../../../../shared/testing';
import { GetCarnetUseCase } from '../carnet.use-cases';
import {
  ChangePasswordUseCase,
  GetPerfilUseCase,
  UpdateExperienceUseCase,
  UpdatePerfilUseCase,
  UpdatePortafolioUseCase,
  UpdatePrivacySettingsUseCase,
  UploadPerfilImageUseCase,
} from '../perfil.use-cases';
import {
  colaboradorBase,
  FakeBrandingReader,
  FakeLoginHistoryReader,
  InMemoryColaboradorRepository,
  InMemoryPerfilRepository,
  perfilBase,
} from './in-memory-colaboradores.repositories';

describe('Casos de uso de Perfil', () => {
  let perfiles: InMemoryPerfilRepository;
  let colaboradores: InMemoryColaboradorRepository;
  beforeEach(() => {
    perfiles = new InMemoryPerfilRepository();
    perfiles.seed(perfilBase());
    colaboradores = new InMemoryColaboradorRepository();
    colaboradores.seed(colaboradorBase({ id: funcionarioActor.id }));
  });

  it('devuelve el perfil con avance e historial de login reciente', async () => {
    const history = new FakeLoginHistoryReader();
    history.items = Array.from({ length: 7 }, (_, i) => ({
      id: i + 1,
      device: 'Chrome',
      location: 'Sincelejo',
      ipAddress: '10.0.0.1',
      loginTime: new Date(),
    }));
    const res = await new GetPerfilUseCase(perfiles, history).execute(funcionarioActor);
    expect(res.loginHistory).toHaveLength(5);
    // first_name, last_name y email completos → 3 de 11 campos
    expect(res.completionPct).toBe(27);
    await expect(
      new GetPerfilUseCase(perfiles, history).execute({ ...funcionarioActor, id: 99 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('actualiza datos personales, guarda habilidades y rechaza correos de otros usuarios', async () => {
    colaboradores.seed(
      colaboradorBase({ id: 5, username: 'x', email: 'ocupado@x.com', cedula: '9', codigoEmpresa: null }),
    );
    const update = new UpdatePerfilUseCase(perfiles, colaboradores);
    const datos = {
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'jperez@comfasucre.com.co',
      phoneNumber: '300',
      designation: 'Analista',
      website: null,
      city: 'Sincelejo',
      country: null,
      zipCode: null,
      description: 'Hola',
      skills: ['Excel', ' SQL '],
      joiningDate: '2024-01-15',
    };
    const res = await update.execute({ actor: funcionarioActor, datos });
    expect(res.skills).toEqual(['Excel', 'SQL']);
    expect(res.completionPct).toBe(73);
    await expect(
      update.execute({ actor: funcionarioActor, datos: { ...datos, email: 'ocupado@x.com' } }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      update.execute({ actor: funcionarioActor, datos: { ...datos, firstName: '' } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('actualiza el portafolio', async () => {
    const res = await new UpdatePortafolioUseCase(perfiles).execute({
      actor: funcionarioActor,
      portafolio: { githubUsername: 'jp', website: '', dribbbleUsername: null, pinterestUsername: 'insta' },
    });
    expect(res.githubUsername).toBe('jp');
    expect(res.website).toBeNull();
    expect(res.pinterestUsername).toBe('insta');
  });

  it('sube las imágenes de perfil y portada a la carpeta profile', async () => {
    const storage = new InMemoryFileStorage();
    const upload = new UploadPerfilImageUseCase(perfiles, storage);
    const a = await upload.execute({
      actor: funcionarioActor,
      kind: 'profile',
      content: Buffer.from('a'),
      originalName: 'yo.jpg',
      mimeType: 'image/jpeg',
    });
    expect(a.profileImage).toBe('profile/file-1.jpg');
    const b = await upload.execute({
      actor: funcionarioActor,
      kind: 'cover',
      content: Buffer.from('b'),
      originalName: 'fondo.png',
      mimeType: 'image/png',
    });
    expect(b.coverImage).toBe('profile/file-2.png');
    await expect(
      upload.execute({
        actor: funcionarioActor,
        kind: 'profile',
        content: Buffer.from('c'),
        originalName: 'x.svg',
        mimeType: 'image/svg+xml',
      }),
    ).rejects.toThrow();
  });

  it('cambia la contraseña verificando la actual, la confirmación y la longitud', async () => {
    const change = new ChangePasswordUseCase(perfiles, new FakePasswordHasher());
    await expect(
      change.execute({
        actor: funcionarioActor,
        oldPassword: 'mala',
        newPassword: 'nueva1234',
        confirmPassword: 'nueva1234',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(
      change.execute({
        actor: funcionarioActor,
        oldPassword: 'actual123',
        newPassword: 'nueva1234',
        confirmPassword: 'otra',
      }),
    ).rejects.toThrow('Las nuevas contraseñas no coinciden.');
    await expect(
      change.execute({
        actor: funcionarioActor,
        oldPassword: 'actual123',
        newPassword: 'corta',
        confirmPassword: 'corta',
      }),
    ).rejects.toThrow('al menos 8 caracteres');
    await change.execute({
      actor: funcionarioActor,
      oldPassword: 'actual123',
      newPassword: 'nueva1234',
      confirmPassword: 'nueva1234',
    });
    expect(perfiles.hashes.get(funcionarioActor.id)).toBe('hashed:nueva1234');
  });

  it('guarda privacidad (sólo claves conocidas) y experiencia (descarta filas sin cargo)', async () => {
    const privacy = await new UpdatePrivacySettingsUseCase(perfiles).execute({
      actor: funcionarioActor,
      settings: { email_notifications: true, desconocida: true },
    });
    expect(privacy).toEqual({
      direct_messages: false,
      desktop_notifications: false,
      email_notifications: true,
      chat_notifications: false,
      comunicados_notifications: false,
    });
    const exp = await new UpdateExperienceUseCase(perfiles).execute({
      actor: funcionarioActor,
      experience: [
        { job_title: 'Analista', company_name: 'ACME', year_from: '2020', year_to: 'Present' },
        { job_title: '  ', company_name: 'Vacía' },
      ],
    });
    expect(exp).toEqual([
      { job_title: 'Analista', company_name: 'ACME', year_from: '2020', year_to: 'Present', description: '' },
    ]);
    expect(perfiles.items.get(funcionarioActor.id)?.props.experience).toHaveLength(1);
  });
});

describe('Carnet digital', () => {
  it('arma el carnet propio con los nombres y el QR, y el admin puede ver el de otros', async () => {
    const repo = new InMemoryColaboradorRepository();
    const c = repo.seed(colaboradorBase({ id: funcionarioActor.id }));
    repo.nombres[c.id as number] = { sedeNombre: 'Principal', areaNombre: 'TIC', cargoNombre: 'Analista' };
    const useCase = new GetCarnetUseCase(
      repo,
      new FakeBrandingReader('branding/logo.png'),
      new FakeClock(new Date('2026-10-08T10:00:00Z')),
    );
    const carnet = await useCase.execute({ actor: funcionarioActor });
    expect(carnet).toMatchObject({
      nombreCompleto: 'Juan Pérez',
      cargo: 'Analista',
      area: 'TIC',
      sede: 'Principal',
      cedula: '1001',
      codigoEmpresa: 'COMF-001',
      logo: 'branding/logo.png',
      anio: 2026,
    });
    expect(JSON.parse(carnet.qrData)).toEqual({
      nombre: 'Juan Pérez',
      cedula: '1001',
      cargo: 'Analista',
      area: 'TIC',
      codigo: 'COMF-001',
    });
    expect((await useCase.execute({ actor: adminActor, userId: funcionarioActor.id })).userId).toBe(
      funcionarioActor.id,
    );
    await expect(useCase.execute({ actor: funcionarioActor, userId: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(useCase.execute({ actor: adminActor, userId: 404 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('usa valores por defecto cuando faltan cargo, área o sede', async () => {
    const repo = new InMemoryColaboradorRepository();
    repo.seed(colaboradorBase({ id: funcionarioActor.id, codigoEmpresa: null }));
    const carnet = await new GetCarnetUseCase(repo, new FakeBrandingReader(), new FakeClock()).execute({
      actor: funcionarioActor,
    });
    expect(carnet).toMatchObject({
      cargo: 'Sin cargo',
      area: 'Sin área',
      sede: 'N/A',
      codigoEmpresa: 'N/A',
      logo: null,
    });
  });
});
