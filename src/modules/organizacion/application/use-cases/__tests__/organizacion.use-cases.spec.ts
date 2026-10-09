import { NotFoundError, ValidationError } from '../../../../../shared/domain/domain-error';
import { DeleteAreaUseCase, SaveAreaUseCase } from '../areas.use-cases';
import { ListCargosUseCase, SaveCargoUseCase } from '../cargos.use-cases';
import { DeleteSedeUseCase, ListSedesUseCase, SaveSedeUseCase } from '../sedes.use-cases';
import {
  InMemoryAreaRepository,
  InMemoryCargoRepository,
  InMemorySedeRepository,
} from './in-memory-organizacion.repositories';

describe('Casos de uso de Organización', () => {
  let sedes: InMemorySedeRepository;
  let areas: InMemoryAreaRepository;
  let cargos: InMemoryCargoRepository;

  beforeEach(() => {
    sedes = new InMemorySedeRepository();
    areas = new InMemoryAreaRepository();
    cargos = new InMemoryCargoRepository();
  });

  describe('Sedes', () => {
    it('crea, lista y filtra por activas', async () => {
      const save = new SaveSedeUseCase(sedes);
      await save.execute({ nombre: 'Principal', direccion: 'Cra 1', ciudad: 'Sincelejo', telefono: null });
      await save.execute({ nombre: 'Norte', direccion: null, ciudad: null, telefono: null, estado: 'inactivo' });

      expect(await new ListSedesUseCase(sedes).execute({})).toHaveLength(2);
      const activas = await new ListSedesUseCase(sedes).execute({ soloActivas: true });
      expect(activas.map((s) => s.nombre)).toEqual(['Principal']);
    });

    it('actualiza una sede existente y falla con una inexistente', async () => {
      const save = new SaveSedeUseCase(sedes);
      const created = await save.execute({ nombre: 'Principal', direccion: null, ciudad: null, telefono: null });
      const updated = await save.execute({
        id: created.id,
        nombre: 'Principal Renombrada',
        direccion: null,
        ciudad: null,
        telefono: null,
      });
      expect(updated.nombre).toBe('Principal Renombrada');
      await expect(
        save.execute({ id: 99, nombre: 'X', direccion: null, ciudad: null, telefono: null }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('rechaza nombres vacíos', async () => {
      await expect(
        new SaveSedeUseCase(sedes).execute({ nombre: ' ', direccion: null, ciudad: null, telefono: null }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('elimina sólo sedes existentes', async () => {
      const created = await new SaveSedeUseCase(sedes).execute({
        nombre: 'Principal',
        direccion: null,
        ciudad: null,
        telefono: null,
      });
      await new DeleteSedeUseCase(sedes).execute(created.id);
      expect(sedes.items).toHaveLength(0);
      await expect(new DeleteSedeUseCase(sedes).execute(created.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('Áreas', () => {
    it('valida que la sede referenciada exista', async () => {
      const save = new SaveAreaUseCase(areas, sedes);
      await expect(
        save.execute({ nombre: 'TI', descripcion: null, sedeId: 7, responsableId: null }),
      ).rejects.toBeInstanceOf(NotFoundError);
      const sede = await new SaveSedeUseCase(sedes).execute({
        nombre: 'Principal',
        direccion: null,
        ciudad: null,
        telefono: null,
      });
      const area = await save.execute({ nombre: 'TI', descripcion: null, sedeId: sede.id, responsableId: null });
      expect(area.sedeId).toBe(sede.id);
    });

    it('elimina áreas', async () => {
      const area = await new SaveAreaUseCase(areas, sedes).execute({
        nombre: 'TI',
        descripcion: null,
        sedeId: null,
        responsableId: null,
      });
      await new DeleteAreaUseCase(areas).execute(area.id);
      expect(areas.items).toHaveLength(0);
    });
  });

  describe('Cargos', () => {
    it('crea un cargo con nivel jerárquico y nombre de nivel', async () => {
      const cargo = await new SaveCargoUseCase(cargos, areas).execute({
        nombre: 'Coordinador TI',
        descripcion: null,
        areaId: null,
        nivelJerarquico: 3,
        funciones: 'Coordinar',
      });
      expect(cargo.nivelNombre).toBe('Coordinador');
      expect((await new ListCargosUseCase(cargos).execute({}))[0].funciones).toBe('Coordinar');
    });

    it('valida el área referenciada', async () => {
      await expect(
        new SaveCargoUseCase(cargos, areas).execute({
          nombre: 'X',
          descripcion: null,
          areaId: 5,
          nivelJerarquico: 4,
          funciones: null,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
