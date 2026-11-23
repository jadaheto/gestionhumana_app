# Módulo `notificaciones`

Migra `controllers/Notificaciones.php`, `models/Notificacion_model.php` y el consumo desde `views/partials/topbar.php` + `public/assets/js/pages/topbar-notifications.init.js`.

## Propósito
Bandeja de notificaciones internas del usuario: la campana del topbar (contador + últimas pendientes) y la página de lista. Otros contextos (solicitudes, comunicados, contratos) **insertan** notificaciones; este módulo sólo las consulta y actualiza.

## Reglas de negocio migradas
| Regla | Origen legado | Implementación |
|---|---|---|
| Sólo se ven/modifican notificaciones propias (`user_id` = usuario autenticado) | `mark_read($id, $user_id)` | Todos los casos de uso usan `actor.id`; marcar/eliminar ajena → 404 |
| Lista con contador de no leídas | `lista_json` → `{count, items}` | `GET /notificaciones` → `{ noLeidas, items }`; `soloNoLeidas=true` replica `get_unread` |
| Marcar una / marcar todas | `marcar_leida`, `marcar_todas` | `PATCH /notificaciones/:id/leida`, `PATCH /notificaciones/marcar-todas` |
| Sondeo periódico del contador (30 s en el legado) | `setInterval(fetchNotifications, 30000)` | `GET /notificaciones/no-leidas` (ligero); el frontend sondea cada 60 s |

### Añadidos
- `DELETE /notificaciones/:id` (eliminar propia).
- `CrearNotificacionUseCase` y `NotificacionRepository` se **exportan** del módulo por si otro contexto prefiere inyectarlos en lugar de insertar por SQL (no es obligatorio).

## Endpoints (`/api/v1/notificaciones`, todos para el usuario autenticado)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/notificaciones?limit=20&soloNoLeidas=false` | Últimas N (1–100) + `noLeidas` global |
| GET | `/notificaciones/no-leidas` | `{ noLeidas }` |
| PATCH | `/notificaciones/marcar-todas` | `{ marcadas }` |
| PATCH | `/notificaciones/:id/leida` | 204; 404 si no es propia |
| DELETE | `/notificaciones/:id` | 204; 404 si no es propia |

## Tablas
`notificaciones` (`user_id`, `titulo`, `mensaje`, `tipo`, `leida`, `link`, `created_at`). Sin migraciones nuevas.

## Tests
- `application/use-cases/__tests__/notificaciones.use-cases.spec.ts` (repositorio en memoria).
- `infrastructure/http/__tests__/notificaciones.controller.spec.ts` (`createTestApp` + supertest).
