import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { IS_PUBLIC_KEY } from '../../../../../shared/infrastructure/http/decorators/public.decorator';
import { adminActor, createTestApp, funcionarioActor } from '../../../../../shared/testing';
import {
  GetBrandingUseCase,
  GetCertificadoLaboralConfigUseCase,
  GetCorreoComunicadosUseCase,
  SaveBrandingUseCase,
  SaveCertificadoLaboralConfigUseCase,
  SaveCorreoComunicadosUseCase,
} from '../../../application/use-cases/configuracion.use-cases';
import { GetIdentidadUseCase, SaveIdentidadUseCase } from '../../../application/use-cases/identidad.use-cases';
import { ConfiguracionController } from '../configuracion.controller';
import { IdentidadController } from '../identidad.controller';

function providers() {
  const mock = (value: unknown = {}) => ({ execute: jest.fn().mockResolvedValue(value) });
  const saveIdentidad = mock({ mision: 'M' });
  const saveBranding = mock({});
  const saveCorreo = mock({});
  const saveCert = mock({});
  return {
    saveIdentidad,
    saveBranding,
    saveCorreo,
    saveCert,
    list: [
      { provide: GetIdentidadUseCase, useValue: mock({ mision: 'M', vision: 'V' }) },
      { provide: SaveIdentidadUseCase, useValue: saveIdentidad },
      { provide: GetBrandingUseCase, useValue: mock({ light: { slot: 'light', archivo: null } }) },
      { provide: SaveBrandingUseCase, useValue: saveBranding },
      { provide: GetCorreoComunicadosUseCase, useValue: mock({ modo: 'test' }) },
      { provide: SaveCorreoComunicadosUseCase, useValue: saveCorreo },
      { provide: GetCertificadoLaboralConfigUseCase, useValue: mock({ jefeNombre: 'J' }) },
      { provide: SaveCertificadoLaboralConfigUseCase, useValue: saveCert },
    ],
  };
}

const controllers = [IdentidadController, ConfiguracionController];

describe('Controladores de Identidad y Configuración (HTTP)', () => {
  describe('como administrador', () => {
    let app: INestApplication;
    let p: ReturnType<typeof providers>;
    beforeAll(async () => {
      p = providers();
      app = await createTestApp({ controllers, providers: p.list, actor: adminActor });
    });
    afterAll(() => app.close());

    it('GET y PUT /identidad', async () => {
      await request(app.getHttpServer()).get('/identidad').expect(200, { mision: 'M', vision: 'V' });
      await request(app.getHttpServer())
        .put('/identidad')
        .send({ mision: 'Nueva', himno_url: 'https://x.co' })
        .expect(200);
      expect(p.saveIdentidad.execute).toHaveBeenCalledWith({ mision: 'Nueva', himno_url: 'https://x.co' });
      await request(app.getHttpServer()).put('/identidad').send({ mision: 5 }).expect(400);
    });

    it('PUT /admin/config/branding sube los slots enviados', async () => {
      await request(app.getHttpServer())
        .put('/admin/config/branding')
        .attach('light', Buffer.from('x'), 'logo.png')
        .attach('favicon', Buffer.from('x'), 'fav.ico')
        .expect(200);
      const input = p.saveBranding.execute.mock.calls[0][0];
      expect(Object.keys(input)).toEqual(['light', 'favicon']);
      expect(input.light.originalName).toBe('logo.png');
    });

    it('GET y PUT /admin/config/correo-comunicados con validación', async () => {
      await request(app.getHttpServer()).get('/admin/config/correo-comunicados').expect(200, { modo: 'test' });
      await request(app.getHttpServer())
        .put('/admin/config/correo-comunicados')
        .send({ modo: 'produccion', testTo: 'a@b.co', prodTo: 'c@d.co' })
        .expect(200);
      expect(p.saveCorreo.execute).toHaveBeenCalledWith({ modo: 'produccion', testTo: 'a@b.co', prodTo: 'c@d.co' });
      await request(app.getHttpServer())
        .put('/admin/config/correo-comunicados')
        .send({ modo: 'otro', testTo: 'a@b.co', prodTo: 'c@d.co' })
        .expect(400);
    });

    it('GET y PUT /admin/config/certificado-laboral (multipart con firma opcional)', async () => {
      await request(app.getHttpServer()).get('/admin/config/certificado-laboral').expect(200, { jefeNombre: 'J' });
      await request(app.getHttpServer())
        .put('/admin/config/certificado-laboral')
        .field('jefeNombre', 'María')
        .field('jefeCargo', 'Jefe GH')
        .expect(200);
      expect(p.saveCert.execute).toHaveBeenCalledWith({ jefeNombre: 'María', jefeCargo: 'Jefe GH', firma: null });
      await request(app.getHttpServer())
        .put('/admin/config/certificado-laboral')
        .field('jefeNombre', 'María')
        .field('jefeCargo', 'Jefe GH')
        .attach('firma', Buffer.from('x'), 'firma.png')
        .expect(200);
      expect(p.saveCert.execute.mock.calls[1][0].firma.originalName).toBe('firma.png');
      await request(app.getHttpServer())
        .put('/admin/config/certificado-laboral')
        .field('jefeNombre', '')
        .field('jefeCargo', 'x')
        .expect(400);
    });
  });

  describe('como funcionario', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createTestApp({ controllers, providers: providers().list, actor: funcionarioActor });
    });
    afterAll(() => app.close());

    it('puede leer identidad y branding, pero no escribir ni ver configuración (403)', async () => {
      await request(app.getHttpServer()).get('/identidad').expect(200);
      await request(app.getHttpServer()).get('/config/branding').expect(200);
      await request(app.getHttpServer()).put('/identidad').send({ mision: 'X' }).expect(403);
      await request(app.getHttpServer()).get('/admin/config/correo-comunicados').expect(403);
      await request(app.getHttpServer()).put('/admin/config/branding').expect(403);
    });
  });

  describe('acceso público', () => {
    it('GET /config/branding está marcado con @Public() (lo usa el login sin JWT)', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, ConfiguracionController.prototype.branding)).toBe(true);
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, ConfiguracionController.prototype.correo)).toBeUndefined();
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, IdentidadController.prototype.get)).toBeUndefined();
    });
  });
});
