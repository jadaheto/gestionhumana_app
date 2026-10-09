/** Fila plana de `organigrama` unida a cargo/área y titulares activos (como `Organigrama_model::get_jerarquia`). */
export interface FilaOrganigrama {
  id: number;
  cargoId: number;
  cargoPadreId: number | null;
  orden: number;
  cargoNombre: string;
  nivelJerarquico: number;
  areaNombre: string | null;
  titular: TitularCargo | null;
}

export interface TitularCargo {
  userId: number;
  firstName: string;
  lastName: string;
  profileImage: string | null;
}

/** Nodo del árbol jerárquico (equivale al `datos_json` consumido por el orgchart del legado). */
export interface NodoOrganigrama {
  cargoId: number;
  cargoNombre: string;
  nivelJerarquico: number;
  areaNombre: string | null;
  /** Colaboradores activos con ese cargo; vacío = "(Vacante)". */
  titulares: TitularCargo[];
  hijos: NodoOrganigrama[];
}

export const RAIZ_SINTETICA_ID = 0;

/**
 * Construye el árbol a partir de las filas planas (misma lógica que `buildTree`
 * de `jerarquia.php`): un nodo sin padre válido es raíz; si hay varias
 * raíces se agrupan bajo un nodo sintético "Comfasucre". Las filas repetidas
 * por cargo (varios titulares) se consolidan en `titulares`.
 */
export function construirArbol(filas: FilaOrganigrama[], nombreEmpresa = 'Comfasucre'): NodoOrganigrama | null {
  if (filas.length === 0) return null;

  const nodos = new Map<number, NodoOrganigrama>();
  const padres = new Map<number, number | null>();
  const orden = new Map<number, number>();

  for (const f of filas) {
    let nodo = nodos.get(f.cargoId);
    if (!nodo) {
      nodo = {
        cargoId: f.cargoId,
        cargoNombre: f.cargoNombre,
        nivelJerarquico: f.nivelJerarquico,
        areaNombre: f.areaNombre,
        titulares: [],
        hijos: [],
      };
      nodos.set(f.cargoId, nodo);
      padres.set(f.cargoId, f.cargoPadreId);
      orden.set(f.cargoId, f.orden);
    }
    if (f.titular && !nodo.titulares.some((t) => t.userId === f.titular?.userId)) nodo.titulares.push(f.titular);
  }

  const raices: NodoOrganigrama[] = [];
  for (const nodo of nodos.values()) {
    const padreId = padres.get(nodo.cargoId) ?? null;
    const padre = padreId !== null && padreId !== nodo.cargoId ? nodos.get(padreId) : undefined;
    if (padre) padre.hijos.push(nodo);
    else raices.push(nodo);
  }

  const ordenar = (lista: NodoOrganigrama[]): void => {
    lista.sort(
      (a, b) =>
        a.nivelJerarquico - b.nivelJerarquico ||
        (orden.get(a.cargoId) ?? 0) - (orden.get(b.cargoId) ?? 0) ||
        a.cargoNombre.localeCompare(b.cargoNombre),
    );
    lista.forEach((n) => ordenar(n.hijos));
  };
  ordenar(raices);

  if (raices.length === 1) return raices[0];
  return {
    cargoId: RAIZ_SINTETICA_ID,
    cargoNombre: nombreEmpresa,
    nivelJerarquico: 0,
    areaNombre: 'Organización',
    titulares: [],
    hijos: raices,
  };
}
