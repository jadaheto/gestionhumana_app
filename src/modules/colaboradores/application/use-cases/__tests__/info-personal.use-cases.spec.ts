import { ForbiddenError, NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { adminActor, funcionarioActor, InMemoryFileStorage } from '../../../../../shared/testing';
import {
  DeleteEducacionFormalUseCase,
  DeleteEducacionNoFormalUseCase,
  DeleteFamiliarUseCase,
  GetDatosBasicosUseCase,
  ListEducacionFormalUseCase,
  ListExperienciaLaboralUseCase,
  ListFamiliaresUseCase,
  SaveEducacionFormalUseCase,
  SaveEducacionNoFormalUseCase,
  SaveExperienciaLaboralUseCase,
  SaveFamiliarUseCase,
  UpdateDatosBasicosUseCase,
} from '../info-personal.use-cases';
import {
  InMemoryDatosBasicosRepository,
  InMemoryEducacionFormalRepository,
  InMemoryEducacionNoFormalRepository,
  InMemoryExperienciaLaboralRepository,
  InMemoryFamiliarRepository,
} from './in-memory-colaboradores.repositories';

const otro = { ...funcionarioActor, id: 3, username: 'otro' };

describe('Casos de uso de Información personal', () => {
  describe('Datos básicos', () => {
    let repo: InMemoryDatosBasicosRepository;
    beforeEach(() => {
      repo = new InMemoryDatosBasicosRepository();
      repo.seed(funcionarioActor.id);
    });

    it('devuelve los datos propios y el admin puede consultar a otro usuario', async () => {
      const get = new GetDatosBasicosUseCase(repo);
      expect((await get.execute({ actor: funcionarioActor })).firstName).toBe('Juan');
      expect((await get.execute({ actor: adminActor, userId: funcionarioActor.id })).userId).toBe(funcionarioActor.id);
      await expect(get.execute({ actor: otro, userId: funcionarioActor.id })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(get.execute({ actor: adminActor, userId: 77 })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('actualiza sólo los campos permitidos y valida número de hijos', async () => {
      const update = new UpdateDatosBasicosUseCase(repo);
      const res = await update.execute({
        actor: funcionarioActor,
        datos: { direccion: ' Calle 1 ', eps: 'Sura', numeroHijos: 2 },
      });
      expect(res.direccion).toBe('Calle 1');
      expect(res.eps).toBe('Sura');
      expect(res.numeroHijos).toBe(2);
      expect(res.firstName).toBe('Juan');
      await expect(update.execute({ actor: funcionarioActor, datos: { numeroHijos: -1 } })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });
  });

  describe('Educación formal', () => {
    let repo: InMemoryEducacionFormalRepository;
    beforeEach(() => (repo = new InMemoryEducacionFormalRepository()));

    const data = {
      nivel: 'profesional',
      institucion: 'Unisucre',
      tituloObtenido: 'Ingeniero',
      fechaInicio: '2015-01-01',
      fechaFin: '2020-06-01',
      estadoEstudio: 'finalizado',
      tarjetaProfesional: null,
    };

    it('crea, lista por usuario y actualiza registros propios', async () => {
      const save = new SaveEducacionFormalUseCase(repo);
      const created = await save.execute({ actor: funcionarioActor, data });
      await save.execute({ actor: otro, data: { ...data, institucion: 'Otra' } });
      expect(created.userId).toBe(funcionarioActor.id);
      expect(await new ListEducacionFormalUseCase(repo).execute({ actor: funcionarioActor })).toHaveLength(1);
      const updated = await save.execute({
        actor: funcionarioActor,
        id: created.id,
        data: { ...data, estadoEstudio: 'cursando' },
      });
      expect(updated.estadoEstudio).toBe('cursando');
    });

    it('no permite editar ni eliminar registros de otro usuario (IDOR)', async () => {
      const created = await new SaveEducacionFormalUseCase(repo).execute({ actor: funcionarioActor, data });
      await expect(
        new SaveEducacionFormalUseCase(repo).execute({ actor: otro, id: created.id, data }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        new DeleteEducacionFormalUseCase(repo).execute({ actor: otro, id: created.id }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await new DeleteEducacionFormalUseCase(repo).execute({ actor: funcionarioActor, id: created.id });
      expect(repo.items).toHaveLength(0);
    });

    it('valida nivel, institución y rango de fechas', async () => {
      const save = new SaveEducacionFormalUseCase(repo);
      await expect(
        save.execute({ actor: funcionarioActor, data: { ...data, nivel: 'primaria' } }),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        save.execute({ actor: funcionarioActor, data: { ...data, institucion: '' } }),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        save.execute({ actor: funcionarioActor, data: { ...data, fechaFin: '2010-01-01' } }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('Educación no formal', () => {
    it('guarda el certificado adjunto y lo elimina junto con el registro', async () => {
      const repo = new InMemoryEducacionNoFormalRepository();
      const storage = new InMemoryFileStorage();
      const save = new SaveEducacionNoFormalUseCase(repo, storage);
      const data = { tipo: 'curso', institucion: 'SENA', nombrePrograma: 'Excel', horas: 40, fecha: '2024-03-10' };
      const created = await save.execute({
        actor: funcionarioActor,
        data,
        certificado: { content: Buffer.from('pdf'), originalName: 'cert.pdf', mimeType: 'application/pdf' },
      });
      expect(created.certificado).toBe('certificados/file-1.pdf');
      // Al editar sin archivo se conserva el certificado anterior.
      const edited = await save.execute({ actor: funcionarioActor, id: created.id, data: { ...data, horas: 50 } });
      expect(edited.certificado).toBe('certificados/file-1.pdf');
      expect(edited.horas).toBe(50);
      await new DeleteEducacionNoFormalUseCase(repo, storage).execute({ actor: funcionarioActor, id: created.id });
      expect(storage.files.size).toBe(0);
      await expect(save.execute({ actor: funcionarioActor, data: { ...data, horas: -1 } })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });
  });

  describe('Familiares y experiencia', () => {
    it('gestiona familiares con el indicador de dependiente', async () => {
      const repo = new InMemoryFamiliarRepository();
      const save = new SaveFamiliarUseCase(repo);
      const f = await save.execute({
        actor: funcionarioActor,
        data: {
          nombreCompleto: 'Pedro Pérez',
          parentesco: 'hijo',
          fechaNacimiento: '2015-02-02',
          cedula: null,
          ocupacion: null,
          telefono: null,
          dependiente: true,
        },
      });
      expect(f.dependiente).toBe(true);
      expect(await new ListFamiliaresUseCase(repo).execute({ actor: funcionarioActor })).toHaveLength(1);
      await expect(
        save.execute({
          actor: funcionarioActor,
          data: {
            nombreCompleto: 'X',
            parentesco: 'primo',
            fechaNacimiento: null,
            cedula: null,
            ocupacion: null,
            telefono: null,
            dependiente: false,
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
      await new DeleteFamiliarUseCase(repo).execute({ actor: funcionarioActor, id: f.id });
      expect(repo.items).toHaveLength(0);
    });

    it('gestiona experiencia laboral exigiendo empresa y cargo', async () => {
      const repo = new InMemoryExperienciaLaboralRepository();
      const save = new SaveExperienciaLaboralUseCase(repo);
      const e = await save.execute({
        actor: funcionarioActor,
        data: {
          empresa: 'ACME',
          cargo: 'Analista',
          fechaInicio: '2020-01-01',
          fechaFin: null,
          funciones: null,
          motivoRetiro: null,
          telefonoContacto: null,
          jefeInmediato: null,
        },
      });
      expect(e.empresa).toBe('ACME');
      expect(
        (await new ListExperienciaLaboralUseCase(repo).execute({ actor: adminActor, userId: funcionarioActor.id }))[0]
          .id,
      ).toBe(e.id);
      await expect(
        save.execute({
          actor: funcionarioActor,
          data: {
            empresa: '',
            cargo: 'X',
            fechaInicio: null,
            fechaFin: null,
            funciones: null,
            motivoRetiro: null,
            telefonoContacto: null,
            jefeInmediato: null,
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
