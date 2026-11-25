import { ValidationError } from '../../../../../shared/domain/domain-error';
import {
  BuscarDirectorioUseCase,
  GetJerarquiaUseCase,
  GetOrganigramaDependenciasUseCase,
  ImportarCargosUseCase,
} from '../organigrama.use-cases';
import {
  InMemoryDependenciasRepository,
  InMemoryDirectorioRepository,
  InMemoryImportacionCargosRepository,
  InMemoryOrganigramaRepository,
} from './in-memory-organigrama.repositories';

describe('Casos de uso de Organigrama', () => {
  describe('GetJerarquiaUseCase', () => {
    it('informa "no configurado" cuando la tabla está vacía', async () => {
      const r = await new GetJerarquiaUseCase(new InMemoryOrganigramaRepository()).execute();
      expect(r).toEqual({ configurado: false, totalCargos: 0, raiz: null });
    });

    it('construye el árbol y cuenta cargos únicos', async () => {
      const repo = new InMemoryOrganigramaRepository();
      repo.filas = [
        {
          id: 1,
          cargoId: 1,
          cargoPadreId: null,
          orden: 0,
          cargoNombre: 'Director',
          nivelJerarquico: 1,
          areaNombre: 'Dirección',
          titular: { userId: 1, firstName: 'Ana', lastName: 'Ruiz', profileImage: null },
        },
        {
          id: 2,
          cargoId: 2,
          cargoPadreId: 1,
          orden: 0,
          cargoNombre: 'Jefe',
          nivelJerarquico: 2,
          areaNombre: null,
          titular: null,
        },
      ];
      const r = await new GetJerarquiaUseCase(repo).execute();
      expect(r.configurado).toBe(true);
      expect(r.totalCargos).toBe(2);
      expect(r.raiz?.hijos[0].cargoNombre).toBe('Jefe');
    });
  });

  describe('GetOrganigramaDependenciasUseCase', () => {
    it('informa "no configurado" cuando no hay áreas activas', async () => {
      const r = await new GetOrganigramaDependenciasUseCase(new InMemoryDependenciasRepository()).execute();
      expect(r).toEqual({ configurado: false, totalDependencias: 0, raices: [] });
    });

    it('devuelve el árbol de dependencias y el total', async () => {
      const repo = new InMemoryDependenciasRepository();
      repo.filas = [
        { id: 1, nombre: 'Dirección', padreId: null, orden: 0, responsable: null, totalColaboradores: 2 },
        { id: 2, nombre: 'TIC', padreId: 1, orden: 0, responsable: null, totalColaboradores: 5 },
      ];
      const r = await new GetOrganigramaDependenciasUseCase(repo).execute();
      expect(r.configurado).toBe(true);
      expect(r.totalDependencias).toBe(2);
      expect(r.raices).toHaveLength(1);
      expect(r.raices[0].hijas[0]).toMatchObject({ nombre: 'TIC', nivel: 1, totalColaboradores: 5 });
    });
  });

  describe('BuscarDirectorioUseCase', () => {
    it('normaliza los filtros antes de consultar', async () => {
      const repo = new InMemoryDirectorioRepository();
      repo.items = [
        {
          id: 1,
          firstName: 'Ana',
          lastName: 'Ruiz',
          nombreCompleto: 'Ana Ruiz',
          email: 'ana@x.com',
          telefono: null,
          cargo: 'Analista',
          areaId: 1,
          area: 'TI',
          sedeId: 2,
          sede: 'Norte',
          profileImage: null,
        },
        {
          id: 2,
          firstName: 'Luis',
          lastName: 'Mora',
          nombreCompleto: 'Luis Mora',
          email: 'luis@x.com',
          telefono: null,
          cargo: 'Jefe',
          areaId: 3,
          area: 'RH',
          sedeId: 2,
          sede: 'Norte',
          profileImage: null,
        },
      ];
      const uc = new BuscarDirectorioUseCase(repo);
      const r = await uc.execute({ q: '  ana ', areaId: undefined, sedeId: 2 });
      expect(repo.ultimosFiltros).toEqual({ q: 'ana', areaId: null, sedeId: 2 });
      expect(r.map((c) => c.id)).toEqual([1]);
    });
  });

  describe('ImportarCargosUseCase', () => {
    let repo: InMemoryImportacionCargosRepository;
    let uc: ImportarCargosUseCase;
    beforeEach(() => {
      repo = new InMemoryImportacionCargosRepository();
      uc = new ImportarCargosUseCase(repo);
    });

    it('rechaza datasets vacíos o sin filas válidas', async () => {
      await expect(uc.execute({ dataset: '   ' })).rejects.toBeInstanceOf(ValidationError);
      await expect(uc.execute({ dataset: 'CARGO\tAREA\nsolo-una-columna' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('crea áreas y cargos faltantes deduplicando y reutiliza los existentes', async () => {
      repo.areas.push({ id: 100, nombre: 'Tecnología' });
      repo.cargos.push({ id: 200, nombre: 'Jefe de Sistemas', areaId: 100, nivel: 5 });
      const dataset = [
        'CARGO\tAREA',
        'Jefe de Sistemas\tTecnologia',
        'Jefe de Sistemas\tTECNOLOGÍA',
        'Analista V\tTecnología',
        'Analista 5\tTecnología',
        'Auxiliar\tCaja',
        'fila inválida',
      ].join('\n');
      const r = await uc.execute({ dataset });
      // "Tecnologia" (sin tilde) no coincide con "Tecnología": se crea como área nueva (igual que el legado).
      expect(r.areasCreadas).toBe(2);
      expect(repo.areas.map((a) => a.nombre)).toEqual(['Tecnología', 'Tecnologia', 'Caja']);
      // Jefe de Sistemas en "Tecnologia" (nueva) + Analista V (dedupe con Analista 5) + Auxiliar
      expect(r.cargosCreados).toBe(3);
      expect(r.salariosGuardados).toBe(0);
      expect(r.filasOmitidas).toBe(1);
      expect(r.filasProcesadas).toBe(5);
      expect(r.message).toContain('Áreas creadas: 2');
      expect(repo.transacciones).toBe(1);
    });

    it('hace upsert de salarios cuando hay 4 columnas', async () => {
      const dataset = [
        'CARGO\tSALARIO 2024\tAUMENTO 2025\tAREA',
        'Auxiliar Contable\t1.500.000\t100.000\tContabilidad',
        'Auxiliar Contable\t1.600.000\t-\tContabilidad',
        'Sin salario\t\t\tContabilidad',
      ].join('\n');
      const r = await uc.execute({ dataset });
      expect(r.cargosCreados).toBe(2);
      expect(r.salariosGuardados).toBe(2);
      expect(repo.salarios).toEqual([{ cargoId: 2, salario2024: 1600000, aumento2025: null }]);
    });

    it('revierte todo si falla una escritura (transacción)', async () => {
      repo.fallarEn = 2;
      await expect(uc.execute({ dataset: 'A\tX\nB\tY' })).rejects.toThrow('fallo simulado');
      expect(repo.areas).toEqual([]);
      expect(repo.cargos).toEqual([]);
    });
  });
});
