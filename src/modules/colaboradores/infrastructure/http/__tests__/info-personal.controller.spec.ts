import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, funcionarioActor } from '../../../../../shared/testing';
import {
  DeleteEducacionFormalUseCase,
  DeleteEducacionNoFormalUseCase,
  DeleteExperienciaLaboralUseCase,
  DeleteFamiliarUseCase,
  GetDatosBasicosUseCase,
  ListEducacionFormalUseCase,
  ListEducacionNoFormalUseCase,
  ListExperienciaLaboralUseCase,
  ListFamiliaresUseCase,
  SaveEducacionFormalUseCase,
  SaveEducacionNoFormalUseCase,
  SaveExperienciaLaboralUseCase,
  SaveFamiliarUseCase,
  UpdateDatosBasicosUseCase,
} from '../../../application/use-cases/info-personal.use-cases';
import { InfoPersonalController } from '../info-personal.controller';

describe('InfoPersonalController (HTTP)', () => {
  let app: INestApplication;
  const mock = () => ({ execute: jest.fn().mockResolvedValue([]) });
  const getDatos = mock();
  const updateDatos = mock();
  const saveEdFormal = mock();
  const saveEdNoFormal = mock();
  const saveFamiliar = mock();
  const deleteExp = { execute: jest.fn().mockResolvedValue(undefined) };
  const listEdFormal = mock();

  beforeAll(async () => {
    app = await createTestApp({
      controllers: [InfoPersonalController],
      providers: [
        { provide: GetDatosBasicosUseCase, useValue: getDatos },
        { provide: UpdateDatosBasicosUseCase, useValue: updateDatos },
        { provide: ListEducacionFormalUseCase, useValue: listEdFormal },
        { provide: SaveEducacionFormalUseCase, useValue: saveEdFormal },
        { provide: DeleteEducacionFormalUseCase, useValue: mock() },
        { provide: ListEducacionNoFormalUseCase, useValue: mock() },
        { provide: SaveEducacionNoFormalUseCase, useValue: saveEdNoFormal },
        { provide: DeleteEducacionNoFormalUseCase, useValue: mock() },
        { provide: ListFamiliaresUseCase, useValue: mock() },
        { provide: SaveFamiliarUseCase, useValue: saveFamiliar },
        { provide: DeleteFamiliarUseCase, useValue: mock() },
        { provide: ListExperienciaLaboralUseCase, useValue: mock() },
        { provide: SaveExperienciaLaboralUseCase, useValue: mock() },
        { provide: DeleteExperienciaLaboralUseCase, useValue: deleteExp },
      ],
      actor: funcionarioActor,
    });
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('GET /info-personal/datos-basicos usa el actor y el userId opcional', async () => {
    getDatos.execute.mockResolvedValue({ userId: 2 });
    await request(app.getHttpServer()).get('/info-personal/datos-basicos?userId=4').expect(200);
    expect(getDatos.execute).toHaveBeenCalledWith({ actor: funcionarioActor, userId: 4 });
  });

  it('PUT /info-personal/datos-basicos convierte opcionales ausentes en null', async () => {
    updateDatos.execute.mockResolvedValue({});
    await request(app.getHttpServer())
      .put('/info-personal/datos-basicos')
      .send({ direccion: 'Calle 1', numeroHijos: '2', genero: '' })
      .expect(200);
    expect(updateDatos.execute).toHaveBeenCalledWith({
      actor: funcionarioActor,
      datos: expect.objectContaining({ direccion: 'Calle 1', numeroHijos: 2, genero: null }),
    });
    await request(app.getHttpServer()).put('/info-personal/datos-basicos').send({ genero: 'x' }).expect(400);
  });

  it('GET /info-personal/educacion-formal lista', async () => {
    await request(app.getHttpServer()).get('/info-personal/educacion-formal').expect(200, []);
  });

  it('POST /info-personal/educacion-formal valida y crea', async () => {
    await request(app.getHttpServer())
      .post('/info-personal/educacion-formal')
      .send({ nivel: 'primaria', institucion: 'X' })
      .expect(400);
    saveEdFormal.execute.mockResolvedValue({ id: 1 });
    await request(app.getHttpServer())
      .post('/info-personal/educacion-formal')
      .send({ nivel: 'profesional', institucion: 'Unisucre', fechaInicio: '2015-01-01' })
      .expect(201);
    expect(saveEdFormal.execute).toHaveBeenCalledWith({
      actor: funcionarioActor,
      data: expect.objectContaining({ nivel: 'profesional', tituloObtenido: null, fechaInicio: '2015-01-01' }),
    });
  });

  it('PUT /info-personal/educacion-no-formal/:id acepta multipart con certificado', async () => {
    saveEdNoFormal.execute.mockResolvedValue({ id: 3 });
    await request(app.getHttpServer())
      .put('/info-personal/educacion-no-formal/3')
      .field('tipo', 'curso')
      .field('nombrePrograma', 'Excel')
      .field('horas', '40')
      .attach('certificado', Buffer.from('pdf'), 'cert.pdf')
      .expect(200);
    expect(saveEdNoFormal.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 3,
        data: expect.objectContaining({ tipo: 'curso', horas: 40 }),
        certificado: expect.objectContaining({ originalName: 'cert.pdf' }),
      }),
    );
  });

  it('POST /info-personal/familiares interpreta el booleano dependiente', async () => {
    saveFamiliar.execute.mockResolvedValue({ id: 1 });
    await request(app.getHttpServer())
      .post('/info-personal/familiares')
      .send({ nombreCompleto: 'Pedro', parentesco: 'hijo', dependiente: true })
      .expect(201);
    expect(saveFamiliar.execute).toHaveBeenCalledWith({
      actor: funcionarioActor,
      data: expect.objectContaining({ dependiente: true, cedula: null }),
    });
  });

  it('DELETE /info-personal/experiencia/:id responde 204', async () => {
    await request(app.getHttpServer()).delete('/info-personal/experiencia/8').expect(204);
    expect(deleteExp.execute).toHaveBeenCalledWith({ actor: funcionarioActor, id: 8 });
  });
});
