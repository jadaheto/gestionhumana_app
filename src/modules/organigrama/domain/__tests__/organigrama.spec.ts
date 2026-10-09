import { construirArbol, FilaOrganigrama, RAIZ_SINTETICA_ID } from '../organigrama';

const fila = (p: Partial<FilaOrganigrama> & { cargoId: number }): FilaOrganigrama => ({
  id: p.cargoId,
  cargoPadreId: null,
  orden: 0,
  cargoNombre: `Cargo ${p.cargoId}`,
  nivelJerarquico: 5,
  areaNombre: null,
  titular: null,
  ...p,
});

describe('construirArbol (organigrama)', () => {
  it('devuelve null si no hay filas', () => {
    expect(construirArbol([])).toBeNull();
  });

  it('construye el árbol con una raíz y ordena hijos por nivel y orden', () => {
    const arbol = construirArbol([
      fila({ cargoId: 1, cargoNombre: 'Director', nivelJerarquico: 1 }),
      fila({ cargoId: 3, cargoNombre: 'Coordinador', nivelJerarquico: 3, cargoPadreId: 1, orden: 2 }),
      fila({ cargoId: 2, cargoNombre: 'Jefe', nivelJerarquico: 2, cargoPadreId: 1, orden: 1 }),
      fila({ cargoId: 4, cargoNombre: 'Auxiliar', nivelJerarquico: 5, cargoPadreId: 2 }),
    ]);
    expect(arbol?.cargoNombre).toBe('Director');
    expect(arbol?.hijos.map((h) => h.cargoNombre)).toEqual(['Jefe', 'Coordinador']);
    expect(arbol?.hijos[0].hijos[0].cargoNombre).toBe('Auxiliar');
  });

  it('consolida varios titulares de un mismo cargo y deja vacantes sin titulares', () => {
    const arbol = construirArbol([
      fila({ cargoId: 1, titular: { userId: 10, firstName: 'Ana', lastName: 'Ruiz', profileImage: null } }),
      fila({ cargoId: 1, titular: { userId: 11, firstName: 'Luis', lastName: 'Mora', profileImage: 'x.png' } }),
      fila({ cargoId: 2, cargoPadreId: 1 }),
    ]);
    expect(arbol?.titulares.map((t) => t.firstName)).toEqual(['Ana', 'Luis']);
    expect(arbol?.hijos[0].titulares).toEqual([]);
  });

  it('agrupa varias raíces bajo un nodo sintético de la empresa', () => {
    const arbol = construirArbol([fila({ cargoId: 1 }), fila({ cargoId: 2, cargoPadreId: 99 })]);
    expect(arbol?.cargoId).toBe(RAIZ_SINTETICA_ID);
    expect(arbol?.cargoNombre).toBe('Comfasucre');
    expect(arbol?.hijos).toHaveLength(2);
  });
});
