# Módulo `organigrama` (jerarquía, directorio e importador de cargos/áreas)

Migra `controllers/Organigrama.php` + `models/Organigrama_model.php` (vistas `organigrama/jerarquia.php`,
`organigrama/directorio.php`) y, de `AdminUsuarios.php`, los métodos `importar_cargos`,
`procesar_importar_cargos`, `ensure_cargo_salary_table` e `import_cargos_areas_from_text`
(vista `admin/importar_cargos.php`).

## Estructura
```
organigrama/
├── domain/
│   ├── organigrama.ts             FilaOrganigrama, NodoOrganigrama, construirArbol() (lógica del `buildTree` del legado)
│   ├── directorio.ts              ColaboradorDirectorio, FiltrosDirectorio
│   ├── cargos-dataset.parser.ts   CargosDatasetParser (servicio de dominio puro, sin dependencias)
│   └── repositories.ts            OrganigramaRepository, DirectorioRepository, ImportacionCargosRepository (transaccional)
├── application/                   GetJerarquia, BuscarDirectorio, ImportarCargos + DTOs
├── infrastructure/
│   ├── http/                      OrganigramaController + DTOs
│   └── persistence/               organigrama.orm-entity, cargo-salario.orm-entity, repositorios TypeORM (SQL parametrizado)
└── organigrama.module.ts
```

## Reglas de negocio migradas
### Jerarquía (`GET /organigrama/jerarquia`)
- Misma consulta que `Organigrama_model::get_jerarquia` (`organigrama` ⋈ `cargos` ⟕ `areas` ⟕ `users` activos por cargo), ordenada por `nivel_jerarquico`, `orden`.
- `construirArbol` replica `buildTree` de `jerarquia.php`: cada cargo es un nodo; el `cargo_padre_id` inexistente lo convierte en raíz. Mejoras: varias raíces se agrupan bajo un nodo sintético "Comfasucre" (el legado perdía todas menos la última) y varios titulares del mismo cargo se consolidan en `titulares` (el legado dejaba sólo el último). Sin titulares = "(Vacante)".
- Tabla vacía → `{ configurado: false, raiz: null }` ("Organigrama no configurado").

### Directorio (`GET /organigrama/directorio`)
- Misma consulta que `get_directorio`: colaboradores con `estado_colaborador = 'activo'` y `role <> 'admin'`, ordenados por nombre; `cargo = cargo_nombre ?? designation`, `telefono = celular ?? phone_number`.
- Filtros nuevos (el legado filtraba en cliente con DataTables): `q` (nombre, correo, cargo, `ILIKE`), `areaId`, `sedeId`.

### Importador (`POST /organigrama/importar-cargos`)
`CargosDatasetParser` replica `import_cargos_areas_from_text`:
1. Normaliza saltos de línea y reagrupa líneas partidas mientras haya comillas sin cerrar (celdas multilínea de Excel).
2. Omite la fila de encabezado (`CARGO … AREA`). *Corrección:* el legado comparaba con la cadena literal `'CARGO\tAREA'` (PHP con comillas simples), por lo que un encabezado real tabulado se importaba como un cargo "CARGO" en un área "AREA".
3. Separa columnas por tabulaciones o, si no hay, por 2+ espacios. Menos de 2 columnas → fila omitida.
4. 2–3 columnas: `CARGO … AREA` (última columna = área). 4+ columnas: `CARGO, SALARIO 2024, AUMENTO 2025, AREA`.
5. `limpiarEtiqueta`: quita comillas/espacios, colapsa espacios y restaura tildes frecuentes (Crédito, Gestión, Dirección).
6. `normalizarClave` para deduplicar (`senior i`→`senior 1`, `analista v`→`analista 5`), aplicado también al inicio del texto (el legado exigía un espacio previo).
7. `normalizarDinero`: `$ 1.500.000,50` → `1500000.5`; además admite `3,200,000` (el legado devolvía null).

`ImportarCargosUseCase` ejecuta en **una transacción** (`ImportacionCargosRepository.enTransaccion`): busca el área por nombre (`LOWER(TRIM(nombre))`), la crea si falta (`estado = activo`); busca el cargo por `area_id` + nombre, lo crea si falta (`nivel_jerarquico = 5`, activo); si la fila trae salarios hace upsert en `cargo_salarios` (`ON CONFLICT (cargo_id)`). Devuelve contadores: `areasCreadas`, `cargosCreados`, `salariosGuardados`, `filasOmitidas`, `filasProcesadas` y `message`.
- Dataset vacío o sin filas válidas → `ValidationError` (400).
- `ensure_cargo_salary_table` no se migra como código: la tabla la crea la migración base (`002_schema_runtime.sql`).

## Endpoints (prefijo `api/v1`)
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/organigrama/jerarquia` | autenticado | `{ configurado, totalCargos, raiz: NodoOrganigrama | null }` |
| GET | `/organigrama/directorio?q=&areaId=&sedeId=` | autenticado | `ColaboradorDirectorioDto[]` |
| POST | `/organigrama/importar-cargos` `{ dataset }` | admin | `ImportacionCargosResultadoDto` |

## Tablas
- Propias del módulo: `organigrama` (`OrganigramaOrmEntity`), `cargo_salarios` (`CargoSalarioOrmEntity`).
- Lectura/escritura mediante SQL parametrizado: `areas`, `cargos` (creación en el importador), `users`, `sedes` (lectura).

No requiere migraciones nuevas (ambas tablas existen en la migración base).

## Tests
- `domain/__tests__/cargos-dataset.parser.spec.ts`: datasets con y sin salarios, filas inválidas, líneas partidas, normalización.
- `domain/__tests__/organigrama.spec.ts`: construcción del árbol (raíz única, varias raíces, titulares múltiples).
- `application/use-cases/__tests__/organigrama.use-cases.spec.ts`: deduplicación, reutilización de existentes, upsert de salarios, rollback.
- `infrastructure/http/__tests__/organigrama.controller.spec.ts`: rutas, filtros, validación y roles.
