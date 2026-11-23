import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapE2E, loginAsAdmin } from './setup-e2e';

/**
 * Prueba de humo: un endpoint de lectura por módulo, autenticado como admin,
 * contra la base de datos real. Detecta errores de wiring (providers,
 * entidades ORM, SQL) que los tests unitarios no cubren.
 */
const ENDPOINTS = [
  '/dashboard',
  '/usuarios',
  '/colaboradores',
  '/info-personal/datos-basicos',
  '/carnet',
  '/perfil',
  '/contratos',
  '/solicitudes/admin',
  '/beneficios/vacaciones/saldo',
  '/notificaciones?limit=5',
  '/comunicados?page=1&size=3',
  '/conexiones/feed',
  '/identidad',
  '/config/branding',
  '/admin/config/correo-comunicados',
  '/admin/config/certificado-laboral',
  '/mi-puesto/cuentas',
  '/mi-puesto/desprendibles',
  '/admin/nomina/importaciones',
  '/asistencia/sedes',
  '/asistencia/mi-historial?desde=2026-10-01&hasta=2026-10-31',
  '/endeudamiento',
  '/organigrama/jerarquia',
  '/organigrama/directorio',
  '/organizacion/cargos',
  '/colaboracion/tareas/kanban',
  '/colaboracion/calendario/eventos?desde=2026-10-01&hasta=2026-10-31',
  '/colaboracion/chat/contactos',
  '/colaboracion/correo?carpeta=inbox',
  '/colaboracion/api-keys',
];

describe('Humo por módulo (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    ({ app } = await bootstrapE2E());
    token = await loginAsAdmin(app);
  });
  afterAll(() => app.close());

  it.each(ENDPOINTS)('GET %s responde 200', async (path) => {
    await request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('un endpoint de administración rechaza peticiones sin token', async () => {
    await request(app.getHttpServer()).get('/api/v1/usuarios').expect(401);
  });
});
