/** Responsable (líder) de una dependencia. */
export interface ResponsableDependencia {
  userId: number;
  nombre: string;
  cargo: string | null;
  profileImage: string | null;
}

/** Fila plana de `areas` con su responsable y el total de colaboradores activos. */
export interface FilaDependencia {
  id: number;
  nombre: string;
  padreId: number | null;
  orden: number;
  responsable: ResponsableDependencia | null;
  totalColaboradores: number;
}

/** Nodo del organigrama de dependencias (área con sus hijas anidadas). */
export interface NodoDependencia {
  id: number;
  nombre: string;
  /** Profundidad en el árbol (0 = raíz). */
  nivel: number;
  responsable: ResponsableDependencia | null;
  totalColaboradores: number;
  hijas: NodoDependencia[];
}

/**
 * Arma el organigrama: cada área cuelga de su `padreId`; las que no tienen padre
 * (o cuyo padre no está en la lista, p. ej. inactivo) quedan como raíces. Las hermanas
 * se ordenan por `orden` y nombre. Si los datos traen un ciclo, se corta en la primera
 * área del ciclo, que pasa a ser raíz, para que ninguna desaparezca del árbol.
 */
export function construirArbolDependencias(filas: FilaDependencia[]): NodoDependencia[] {
  const nodos = new Map<number, NodoDependencia>();
  for (const f of filas) {
    nodos.set(f.id, {
      id: f.id,
      nombre: f.nombre,
      nivel: 0,
      responsable: f.responsable,
      totalColaboradores: f.totalColaboradores,
      hijas: [],
    });
  }

  const padres = new Map<number, NodoDependencia>();
  const raices: NodoDependencia[] = [];
  for (const f of filas) {
    const nodo = nodos.get(f.id) as NodoDependencia;
    const padre = f.padreId !== null && f.padreId !== f.id ? nodos.get(f.padreId) : undefined;
    if (padre) {
      padre.hijas.push(nodo);
      padres.set(f.id, padre);
    } else raices.push(nodo);
  }

  // Lo que no se alcanza desde una raíz está en un ciclo (o cuelga de uno).
  const alcanzados = new Set<number>();
  const marcar = (n: NodoDependencia): void => {
    alcanzados.add(n.id);
    n.hijas.forEach(marcar);
  };
  raices.forEach(marcar);
  for (const f of filas) {
    if (alcanzados.has(f.id)) continue;
    const nodo = nodos.get(f.id) as NodoDependencia;
    const padre = padres.get(f.id) as NodoDependencia;
    padre.hijas = padre.hijas.filter((h) => h !== nodo);
    raices.push(nodo);
    marcar(nodo);
  }

  const orden = new Map(filas.map((f) => [f.id, f.orden]));
  const ordenar = (lista: NodoDependencia[], nivel: number): void => {
    lista.sort((a, b) => (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0) || a.nombre.localeCompare(b.nombre, 'es'));
    for (const n of lista) {
      n.nivel = nivel;
      ordenar(n.hijas, nivel + 1);
    }
  };
  ordenar(raices, 0);
  return raices;
}
