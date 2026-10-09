# Módulo `puntos` (Puntos y recompensas)

Migra `controllers/Puntos.php`, `models/Punto_model.php` y las vistas `views/puntos/*` del sistema CodeIgniter.

## Propósito
Programa de reconocimiento: los administradores asignan puntos a los colaboradores, quienes los canjean por recompensas del catálogo (horas libres, medio día, teletrabajo, día libre). Los canjes quedan pendientes hasta que un administrador los aprueba o rechaza.

## Estructura
```
modules/puntos/
├── domain/        Balance, Transaccion, Recompensa, Canje (reglas), puertos (repositorios, PuntosUnitOfWork, ColaboradorDirectory, NotificacionPublisher)
├── application/   casos de uso + DTOs + mappers
├── infrastructure/
│   ├── http/          PuntosController + DTOs class-validator/Swagger
│   └── persistence/   entidades ORM, repositorios TypeORM, unidad de trabajo (DataSource.transaction), adaptadores SQL
└── puntos.module.ts
```

## Reglas de negocio migradas
| Regla | Origen legado | Implementación |
|---|---|---|
| El balance se crea en cero la primera vez que se consulta | `Punto_model::get_balance` | `ensureBalance()` (`INSERT … ON CONFLICT DO NOTHING`) |
| Sólo se listan recompensas `activo`, de menor a mayor costo | `get_recompensas` | `RecompensaRepository.findActivas` |
| Historial propio, más reciente primero, con límite opcional (10 en "Mi balance") | `get_transacciones` | `ListMisTransaccionesUseCase` |
| Canjear exige recompensa activa y saldo suficiente | `canjear` | `NotFoundError` / `InvalidOperationError` (422) con el mismo mensaje: «No tienes suficientes puntos. Necesitas N pts.» |
| Asignar puntos: cantidad > 0, concepto obligatorio, movimiento `ganado` y actualización atómica del saldo | `agregar_puntos` | `AsignarPuntosUseCase` dentro de `PuntosUnitOfWork` |
| Asignar puntos sólo a colaboradores (no admin) | `Colaborador_model::get_all` (`role != 'admin'`) | `SqlColaboradorDirectory` (`role <> 'admin' AND estado_colaborador = 'activo'`) |
| Un canje sólo se procesa una vez | `resolver_canje` → `ya_procesado` | `Canje.aprobar/rechazar` lanzan `InvalidOperationError` (422) «Este canje ya había sido procesado.» |
| Listado de canjes pendientes con nombre del colaborador y recompensa, más antiguos primero | `get_canjes_pendientes` | `CanjeRepository.findConDetalle` (join con `users` y `recompensas`) |

### Diferencia deliberada respecto al legado: momento del descuento
El legado **no descontaba** puntos al solicitar el canje; los descontaba al **aprobar** (y rechazar no tocaba el saldo), por lo que un colaborador podía solicitar varios canjes por encima de su saldo. Según la especificación de la migración, aquí:
- **Canjear** descuenta los puntos de inmediato (`descontar` condicional a `puntos_actuales >= N`), registra un movimiento `canjeado` y crea el canje `pendiente`; todo en una transacción (`DataSource.transaction`).
- **Aprobar** sólo cambia el estado y guarda `aprobado_por`.
- **Rechazar** reintegra los puntos (`reintegrar`: suma a `puntos_actuales`, resta de `puntos_totales_canjeados`) y registra un movimiento de tipo **`reintegro`** (nuevo valor de `puntos_transacciones.tipo`; la columna es `VARCHAR(20)` sin restricción, no requiere migración).

### Añadidos respecto al legado
- Al asignar puntos y al resolver un canje se crea una **notificación** (`tipo = 'puntos'`, `link = '/puntos/mi-balance'`) mediante el puerto `NotificacionPublisher` (inserción SQL en `notificaciones`).
- `GET /puntos/mis-canjes` para que el colaborador vea el estado de sus solicitudes.
- `GET /puntos/canjes?estado=…` permite ver aprobados/rechazados/todos, no sólo pendientes.

## Endpoints (`/api/v1/puntos`)
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/puntos/mi-balance` | autenticado | Balance propio (se crea si no existe) |
| GET | `/puntos/historial?limit=` | autenticado | Movimientos propios, más recientes primero |
| GET | `/puntos/recompensas` | autenticado | Catálogo de recompensas activas |
| POST | `/puntos/recompensas/:id/canjear` | autenticado | Canjear (201 → `CanjeDto`; 422 si no alcanza; 404 si no existe/inactiva) |
| GET | `/puntos/mis-canjes` | autenticado | Canjes propios |
| GET | `/puntos/colaboradores` | admin | Colaboradores activos (id, nombre, cédula, cargo) |
| POST | `/puntos/asignar` | admin | `{ userId, cantidad, concepto }` → balance actualizado (201) |
| GET | `/puntos/canjes?estado=pendiente\|aprobado\|rechazado\|usado\|todos` | admin | Canjes con nombre de colaborador y recompensa (pendiente por defecto) |
| POST | `/puntos/canjes/:id/aprobar` | admin | Aprobar canje pendiente |
| POST | `/puntos/canjes/:id/rechazar` | admin | Rechazar canje pendiente (reintegra puntos) |

## Tablas
`puntos` (saldo por `user_id`, único), `puntos_transacciones` (`tipo`: ganado | canjeado | reintegro), `recompensas`, `canjes` (`estado`: pendiente | aprobado | rechazado | usado). Lectura de `users` y `cargos` (centrales) y escritura en `notificaciones` mediante SQL parametrizado desde los adaptadores del módulo. No se añadieron migraciones.

## Tests
- `application/use-cases/__tests__/puntos.use-cases.spec.ts`: reglas de negocio con repositorios en memoria y `InMemoryPuntosUnitOfWork`.
- `infrastructure/http/__tests__/puntos.controller.spec.ts`: rutas, validación y roles con `createTestApp`.

## No migrado
- Estado `usado` / `fecha_uso` de los canjes: el legado no tenía ninguna pantalla ni acción que lo gestionara (sólo existe en el esquema). Se expone en el DTO pero no hay endpoint para marcarlo.
- Administración del catálogo de recompensas (crear/editar): no existía en el legado; el catálogo se gestiona por datos.
