# Módulo `organizacion` — sedes, áreas y cargos

**Legado:** `controllers/AdminUsuarios.php` (métodos `sedes`, `areas`, `cargos` y sus `guardar_*`/`eliminar_*`), `models/Colaborador_model.php` (lookups).

## Reglas de negocio migradas
- Nombre obligatorio en los tres catálogos; estado `activo|inactivo` (por defecto activo).
- Cargo: `nivel_jerarquico` entre 1 (Director) y 5 (Auxiliar), por defecto 5; se expone `nivelNombre`.
- Al guardar un área se valida que la sede exista; al guardar un cargo, que el área exista (404 en caso contrario).
- Los listados incluyen el nombre de la sede (áreas) y del área (cargos); `?activas=true` / `?activos=true` filtra para los selects.

## Endpoints (`/api/v1/organizacion`)
| Método | Ruta | Acceso |
|---|---|---|
| GET | `/sedes`, `/areas`, `/cargos` | autenticado |
| POST / PUT / DELETE | `/sedes[/:id]`, `/areas[/:id]`, `/cargos[/:id]` | admin |

## Tablas
`sedes`, `areas`, `cargos` (ORM central en `shared/infrastructure/persistence/orm`). El importador masivo de cargos/áreas vive en el módulo `organigrama`.
