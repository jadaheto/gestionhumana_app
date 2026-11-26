import { construirArbolDependencias, FilaDependencia } from '../dependencias';

const fila = (id: number, nombre: string, padreId: number | null, orden = 0): FilaDependencia => ({
  id,
  nombre,
  padreId,
  orden,
  tipo: 'linea',
  responsable: null,
  totalColaboradores: 0,
});

describe('construirArbolDependencias', () => {
  it('devuelve una lista vacía sin áreas', () => {
    expect(construirArbolDependencias([])).toEqual([]);
  });

  it('anida las hijas, calcula el nivel y ordena por orden y nombre', () => {
    const raices = construirArbolDependencias([
      fila(3, 'Tesoreria', 2, 1),
      fila(2, 'Financiera', 1, 0),
      fila(4, 'Contabilidad', 2, 0),
      fila(1, 'Dirección', null, 0),
      fila(5, 'Bienestar', null, 1),
      fila(6, 'Archivo', null, 1),
    ]);
    expect(raices.map((r) => r.nombre)).toEqual(['Dirección', 'Archivo', 'Bienestar']);
    const financiera = raices[0].hijas[0];
    expect(financiera).toMatchObject({ nombre: 'Financiera', nivel: 1 });
    expect(financiera.hijas.map((h) => [h.nombre, h.nivel])).toEqual([
      ['Contabilidad', 2],
      ['Tesoreria', 2],
    ]);
  });

  it('deja como raíz al área cuyo padre no está en la lista o es ella misma', () => {
    const raices = construirArbolDependencias([fila(1, 'Huérfana', 99), fila(2, 'Propia', 2)]);
    expect(raices.map((r) => r.nombre)).toEqual(['Huérfana', 'Propia']);
  });

  it('corta un ciclo sin perder áreas', () => {
    const raices = construirArbolDependencias([fila(1, 'A', 3), fila(2, 'B', 1), fila(3, 'C', 2), fila(4, 'D', 3)]);
    expect(raices.map((r) => r.nombre)).toEqual(['A']);
    expect(raices[0].hijas[0].nombre).toBe('B');
    expect(raices[0].hijas[0].hijas[0].nombre).toBe('C');
    expect(raices[0].hijas[0].hijas[0].hijas.map((h) => h.nombre)).toEqual(['D']);
  });

  it('conserva el responsable y el total de colaboradores', () => {
    const responsable = { userId: 7, nombre: 'Ana Ruiz', cargo: 'Jefe', profileImage: null };
    const [raiz] = construirArbolDependencias([{ ...fila(1, 'TIC', null), responsable, totalColaboradores: 4 }]);
    expect(raiz).toMatchObject({ responsable, totalColaboradores: 4 });
  });
});
