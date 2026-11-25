# Módulo `colaboracion`

## Propósito
Herramientas de colaboración del legado: tareas (`Tasks.php`), calendario personal (`Calendar.php`), chat interno (`Chat.php`), correo interno (`Email.php`) y claves API (`Apikey.php`).

## Reglas de negocio migradas
### Tareas
- Estados canónicos (valores del legado conservados en BD): `Unassigned`, `To Do`, `Inprogress`, `In Reviews`, `Completed`; `estadoCanonico()` mapea sinónimos (`Done`→`Completed`, `In Progress`→`Inprogress`, vacío/desconocido→`Unassigned`). Prioridades `Alta`/`Media`/`Baja` (default `Media`).
- Título obligatorio; `fechaLimite` `YYYY-MM-DD`. Todos los usuarios ven todas las tareas; **modificar/cambiar estado/eliminar sólo admin o creador** (`creator_id`), si no → 403.
- Asignados en `task_assignees` (se reemplazan en cada guardado). Al asignar usuarios nuevos (distintos del actor) se inserta una notificación `tipo='tarea'` con `link=/tareas/:id` vía `NotificacionesPort`.
- `responsable` conserva el texto libre `assigned_to` del legado. Kanban agrupa por estado; estadísticas = contadores por estado.

### Calendario
- Eventos privados por usuario (`user_id`): editar/eliminar un evento ajeno responde 404.
- Normalización de fechas (`Calendar::normalizeDate`): `YYYY-MM-DD` → `T00:00:00`; `YYYY-MM-DDTHH:mm` → `:00`. Fin no puede ser anterior a inicio. Clase por defecto `bg-primary`.
- Listado por rango `desde/hasta` (solape) e inclusión de eventos de sistema (cumpleaños y aniversarios ≥ 1 año de colaboradores activos, proyectados al año consultado; 29/02 → 28/02) con `esDeSistema: true` (no editables).

### Chat
- Contactos = todos los demás usuarios con último mensaje y no leídos (misma consulta del legado). Abrir la conversación marca como leídos los mensajes del contacto. No se puede enviar a uno mismo ni a usuarios inexistentes; mensaje no vacío (≤ 5000).

### Correo interno
- Sólo a usuarios registrados (por email). Cada envío crea una fila `inbox` (receptor, no leída) y una `sent` (emisor, leída). Se intenta notificación externa por `Mailer`; si falla, el correo interno queda entregado y se devuelve `notificacionExternaEnviada: false`.
- Ver un correo lo marca leído sólo si el actor es el receptor; sólo se pueden ver correos propios.

### API keys
- Claves propias del usuario: nombre obligatorio, clave = 32 hex mayúsculas (`TokenGenerator.random(16)`), estado `Active`/`Inactive` alternable, regenerar, eliminar una o varias (sólo las propias).

## Endpoints (prefijo `/api/v1`, todos autenticados)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/colaboracion/tareas?estado&busqueda` | Listar tareas |
| GET | `/colaboracion/tareas/kanban` | Agrupadas por estado |
| GET | `/colaboracion/tareas/estadisticas` | Contadores |
| GET | `/colaboracion/tareas/:id` | Detalle |
| POST | `/colaboracion/tareas` | Crear (notifica asignados) |
| PUT | `/colaboracion/tareas/:id` | Editar (admin/creador) |
| PATCH | `/colaboracion/tareas/:id/estado` | Cambiar estado (admin/creador) |
| DELETE | `/colaboracion/tareas/:id` | Eliminar (admin/creador) |
| GET | `/colaboracion/calendario/eventos?desde&hasta&sistema` | Eventos propios (+ sistema) |
| POST | `/colaboracion/calendario/eventos` | Crear evento |
| PUT | `/colaboracion/calendario/eventos/:id` | Editar evento propio |
| DELETE | `/colaboracion/calendario/eventos/:id` | Eliminar evento propio |
| GET | `/colaboracion/chat/contactos` | Contactos con último mensaje/no leídos |
| GET | `/colaboracion/chat/conversacion/:contactoId` | Conversación (marca leídos) |
| POST | `/colaboracion/chat/conversacion/:contactoId/leer` | Marcar leídos |
| POST | `/colaboracion/chat/mensajes` | Enviar mensaje |
| GET | `/colaboracion/correo?carpeta=inbox\|sent` | Buzón |
| GET | `/colaboracion/correo/no-leidos` | `{ total }` |
| GET | `/colaboracion/correo/:id` | Ver (marca leído) |
| POST | `/colaboracion/correo` | Redactar |
| GET | `/colaboracion/api-keys` | Mis claves |
| POST | `/colaboracion/api-keys` | Crear |
| PUT | `/colaboracion/api-keys/:id` | Renombrar |
| POST | `/colaboracion/api-keys/:id/regenerar` | Regenerar |
| POST | `/colaboracion/api-keys/:id/alternar-estado` | Activar/desactivar |
| POST | `/colaboracion/api-keys/eliminar-multiples` | Eliminar varias `{ ids }` |
| DELETE | `/colaboracion/api-keys/:id` | Eliminar una |
| GET | `/colaboracion/usuarios` | Directorio (id, nombre, email) para selectores |

## Puertos y adaptadores
- `TareaRepository`, `EventoCalendarioRepository`, `ChatRepository`, `CorreoRepository`, `ApiKeyRepository` → TypeORM (`infrastructure/persistence/typeorm-*.repository.ts`).
- `UsuariosPort`, `EventosSistemaPort` → `SqlUsuariosAdapter` / `SqlEventosSistemaAdapter` (SQL sobre `users`, `areas`, `contratos`).
- `NotificacionesPort` → `SqlNotificacionesAdapter` (INSERT en `notificaciones`).
- Shared: `Clock`, `Mailer`, `TokenGenerator`.

## Tablas
Propias (entidades ORM del módulo): `tasks`, `task_assignees`, `calendar_events`, `chat_messages`, `emails`, `api_keys`. Lectura: `users`, `areas`, `contratos`. Escritura externa: `notificaciones`.

## Fechas
`due_date` como `YYYY-MM-DD`; `created_at`/`updated_at` ISO UTC; `calendar_events.start_date/end_date` como `YYYY-MM-DDTHH:mm:ss` local sin zona (round-trip con el driver pg).

## Tests
- `application/use-cases/__tests__/*.spec.ts` (repos en memoria): permisos de tareas, notificaciones, kanban/estadísticas, normalización de fechas, eventos de sistema, chat, correo (SMTP caído) y API keys.
- `infrastructure/http/__tests__/colaboracion.controllers.spec.ts`: rutas, validación y códigos HTTP de los seis controladores.

## Calendario: eventos para todos los trabajadores
- `calendar_events.para_todos`: evento institucional visible para todos; `users.puede_crear_eventos`: persona designada por
  Gestión Humana (migración `1798000000000-EventosParaTodos`). Los administradores siempre pueden.
- `GET /colaboracion/calendario/eventos` devuelve los eventos propios y los `paraTodos`, con `editable` y `creador`.
- Crear o marcar un evento como `paraTodos` exige ser administrador o designado (403 en otro caso). Lo modifican o eliminan su
  autor (mientras siga designado) o un administrador, que al editarlo no cambia el autor.
- `GET /colaboracion/calendario/eventos/permisos` → `{ puedeCrearGenerales }`.
- La designación se guarda desde el módulo `usuarios` (`puedeCrearEventos`).
