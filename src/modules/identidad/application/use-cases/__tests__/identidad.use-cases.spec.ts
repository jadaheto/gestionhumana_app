import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../../config/configuration';
import { ValidationError } from '../../../../../shared/domain/domain-error';
import { InMemoryFileStorage } from '../../../../../shared/testing';
import {
  GetBrandingUseCase,
  GetCertificadoLaboralConfigUseCase,
  GetCorreoComunicadosUseCase,
  SaveBrandingUseCase,
  SaveCertificadoLaboralConfigUseCase,
  SaveCorreoComunicadosUseCase,
} from '../configuracion.use-cases';
import { GetIdentidadUseCase, SaveIdentidadUseCase } from '../identidad.use-cases';
import { InMemoryAppSettingsRepository, InMemoryIdentidadRepository } from './in-memory-identidad.repositories';

const config = {
  get: () => ({ mailMode: 'test', testTo: 'pruebas@comfasucre.com.co', prodTo: 'funcionarios@comfasucre.com.co' }),
} as unknown as ConfigService<AppConfig, true>;

const archivo = (originalName: string) => ({ buffer: Buffer.from('x'), originalName, mimeType: 'image/png', size: 1 });

describe('Identidad empresarial', () => {
  it('devuelve los campos indexados y la última fecha de actualización', async () => {
    const repo = new InMemoryIdentidadRepository();
    const dto = await new GetIdentidadUseCase(repo).execute();
    expect(dto.mision).toBe('mision de Comfasucre');
    expect(dto.himno_url).toBe('');
    expect(dto.updatedAt).toBeNull();
  });

  it('guarda sólo los campos enviados y valida la URL del himno', async () => {
    const repo = new InMemoryIdentidadRepository();
    const save = new SaveIdentidadUseCase(repo, new GetIdentidadUseCase(repo));
    const dto = await save.execute({ mision: '  Nueva misión ', himno_url: 'https://www.youtube.com/embed/abc' });
    expect(dto.mision).toBe('Nueva misión');
    expect(dto.vision).toBe('vision de Comfasucre');
    expect(dto.himno_url).toBe('https://www.youtube.com/embed/abc');
    expect(dto.updatedAt).toBe('2026-10-08T10:00:00.000Z');
    await expect(save.execute({ himno_url: 'javascript:alert(1)' })).rejects.toBeInstanceOf(ValidationError);
    expect((await save.execute({ himno_url: '  ' })).himno_url).toBe('');
  });
});

describe('Configuración de la aplicación', () => {
  let settings: InMemoryAppSettingsRepository;
  let storage: InMemoryFileStorage;
  beforeEach(() => {
    settings = new InMemoryAppSettingsRepository();
    storage = new InMemoryFileStorage();
  });

  describe('branding', () => {
    it('devuelve los 5 slots sin personalizar por defecto y normaliza rutas heredadas', async () => {
      settings.values.set('branding_logo_dark', 'uploads/branding/old.png');
      const dto = await new GetBrandingUseCase(settings).execute();
      expect(Object.keys(dto)).toEqual(['light', 'dark', 'sm', 'auth', 'favicon']);
      expect(dto.light).toEqual({ slot: 'light', label: 'Logo claro', archivo: null, personalizado: false });
      expect(dto.dark).toMatchObject({ archivo: 'branding/old.png', personalizado: true });
    });

    it('sube sólo los slots enviados a la carpeta branding y exige al menos uno', async () => {
      const get = new GetBrandingUseCase(settings);
      const save = new SaveBrandingUseCase(settings, storage, get);
      await expect(save.execute({})).rejects.toThrow('No se seleccionaron archivos para actualizar logos.');
      const dto = await save.execute({ light: archivo('logo.svg'), favicon: archivo('fav.ico') });
      expect(dto.light.archivo).toBe('branding/file-1.svg');
      expect(dto.favicon.archivo).toBe('branding/file-2.ico');
      expect(dto.dark.personalizado).toBe(false);
      expect(settings.values.get('branding_logo_light')).toBe('branding/file-1.svg');
    });

    it('rechaza extensiones no permitidas por slot (favicon sólo ico/png)', async () => {
      const save = new SaveBrandingUseCase(settings, storage, new GetBrandingUseCase(settings));
      await expect(save.execute({ favicon: archivo('fav.svg') })).rejects.toThrow(/Extensión no permitida/);
      await expect(save.execute({ sm: archivo('logo.gif') })).rejects.toThrow(/Extensión no permitida/);
    });
  });

  describe('correo de comunicados', () => {
    it('usa la configuración de la app como valor por defecto y persiste cambios', async () => {
      const get = new GetCorreoComunicadosUseCase(settings, config);
      expect(await get.execute()).toEqual({
        modo: 'test',
        testTo: 'pruebas@comfasucre.com.co',
        prodTo: 'funcionarios@comfasucre.com.co',
      });
      const save = new SaveCorreoComunicadosUseCase(settings);
      await save.execute({ modo: 'produccion', testTo: ' qa@x.co ', prodTo: 'todos@x.co' });
      expect(await get.execute()).toEqual({ modo: 'produccion', testTo: 'qa@x.co', prodTo: 'todos@x.co' });
    });

    it('valida los correos', async () => {
      const save = new SaveCorreoComunicadosUseCase(settings);
      await expect(save.execute({ modo: 'test', testTo: 'no-es-correo', prodTo: 'a@b.co' })).rejects.toThrow(
        'Correo de pruebas inválido.',
      );
      await expect(save.execute({ modo: 'test', testTo: 'a@b.co', prodTo: '' })).rejects.toThrow(
        'Correo de producción inválido.',
      );
    });
  });

  describe('certificado laboral', () => {
    it('devuelve los valores por defecto del legado', async () => {
      expect(await new GetCertificadoLaboralConfigUseCase(settings).execute()).toEqual({
        jefeNombre: 'Jefe Departamento Gestión Humana',
        jefeCargo: 'Jefe Departamento Gestión Humana',
        firma: null,
      });
    });

    it('guarda firmante y cargo; la firma PNG es opcional y se conserva si no se envía', async () => {
      const get = new GetCertificadoLaboralConfigUseCase(settings);
      const save = new SaveCertificadoLaboralConfigUseCase(settings, storage, get);
      await expect(save.execute({ jefeNombre: '', jefeCargo: 'X', firma: null })).rejects.toBeInstanceOf(
        ValidationError,
      );
      const r1 = await save.execute({ jefeNombre: 'María Pérez', jefeCargo: 'Jefe GH', firma: archivo('firma.png') });
      expect(r1).toEqual({ jefeNombre: 'María Pérez', jefeCargo: 'Jefe GH', firma: 'branding/file-1.png' });
      const r2 = await save.execute({ jefeNombre: 'María Pérez', jefeCargo: 'Directora GH', firma: null });
      expect(r2.firma).toBe('branding/file-1.png');
      await expect(save.execute({ jefeNombre: 'A', jefeCargo: 'B', firma: archivo('firma.jpg') })).rejects.toThrow(
        /Extensión no permitida/,
      );
    });
  });
});
