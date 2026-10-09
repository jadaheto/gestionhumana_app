# Módulo `comunicados`

Comunicados internos de la empresa con medios (imágenes, vídeos, PDF y URLs de vídeo), su publicación
(notificaciones + correo) y el feed de **Conexiones** (cumpleaños y aniversarios laborales del día).

Migra: `controllers/AdminComunicados.php`, `controllers/Comunicados.php`, `controllers/Conexiones.php`,
`models/Comunicado_model.php`, `models/Conexion_model.php`.

## Reglas de negocio migradas
- Título y contenido son obligatorios (título ≤ 200). Estado `borrador` o `publicado`.
- Medios: archivos con extensión `gif|jpg|jpeg|png|webp|mp4|webm|ogg|pdf`, máximo 50 MB cada uno, hasta 10 por petición.
  El tipo se deduce por extensión: `mp4/webm/ogg` → `video`, `pdf` → `pdf`, resto → `imagen`.
  Se guardan en la carpeta `comunicados` del almacenamiento (`/uploads/comunicados/...`). Las rutas heredadas
  `uploads/comunicados/x` se normalizan a `comunicados/x` al leer, de modo que el frontend siempre usa `UPLOADS_URL + '/' + archivo`.
- URLs de vídeo: una por línea; sólo se aceptan URLs http(s) válidas (equivale a `FILTER_VALIDATE_URL`).
- El orden de los medios se renumera 1..n (archivos primero, luego URLs, como el legado).
- **Publicar** (al crear con `estado=publicado` o con `POST :id/publicar`): fija `publicado_at`, crea una notificación
  (`tipo=comunicado`, `link=/comunicados/ver/:id`) para **todos** los usuarios con `estado_colaborador='activo'` y envía el
  correo si `email_enviado_at` es nulo. Si el correo falla el comunicado queda publicado igualmente y la respuesta lo indica
  (`correo.enviado=false`, `mensaje` con el motivo). Si ya se había enviado: `correo=null` y mensaje "ya había sido enviado".
- **Correo**: destinatario según `app_settings` (`comunicados_mail_mode`, `comunicados_mail_test_to`, `comunicados_mail_prod_to`)
  con respaldo en `COMUNICADOS_MAIL_MODE/TEST_TO/PROD_TO`. Asunto `Nuevo comunicado: <título>`, cuerpo HTML con título,
  resumen, contenido, lista de vídeos (URL o `<FRONTEND_URL>/uploads/<archivo>`) y enlace `<FRONTEND_URL>/comunicados/ver/:id`;
  adjunta imágenes y PDF existentes en disco. Sin destinatario → mensaje "Destinatario no configurado…".
- **Reenviar correo**: sólo para publicados (422 en caso contrario); vuelve a marcar `email_enviado_at`.
- **Eliminar**: borra el comunicado, sus medios (cascada) y los archivos del almacenamiento.
- **Editar** (no existía en el legado, se añade): textos, añadir archivos/URLs y quitar medios existentes (borra el archivo).
- **Feed**: sólo publicados, orden `publicado_at DESC, id DESC`, paginación `?page=&size=` (size 1..15, por defecto 9).
  Cada ítem incluye vista previa del primer medio (`previewType`: `imagen|video_archivo|video_url|pdf`).
- **Detalle**: los borradores sólo son visibles para administradores (404 para funcionarios, como el legado).
- **Conexiones**: cumpleañeros de hoy (activos) y aniversarios de hoy (≥ 1 año, activos, no admin), fecha de referencia
  = mínima `contratos.fecha_inicio` o `users.fecha_ingreso` (misma SQL que `Conexion_model`).

## Endpoints (prefijo `api/v1`)
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/comunicados?page=&size=` | autenticado | Feed paginado (`Page<ComunicadoFeedItemDto>`) |
| GET | `/comunicados/:id` | autenticado | Detalle con medios (borradores sólo admin) |
| GET | `/conexiones/feed` | autenticado | `{ fecha, cumpleaneros[], aniversarios[] }` |
| GET | `/admin/comunicados` | admin | Listado completo con `creadoPor` |
| GET | `/admin/comunicados/:id` | admin | Detalle para edición |
| POST | `/admin/comunicados` (multipart: `titulo, resumen, contenido, estado, videoUrls, archivos[]`) | admin | Crear (publica si `estado=publicado`) |
| PUT | `/admin/comunicados/:id` (multipart + `eliminarMedios="3,7"`) | admin | Editar |
| POST | `/admin/comunicados/:id/publicar` | admin | Publicar + notificar + correo |
| POST | `/admin/comunicados/:id/reenviar-correo` | admin | Reenviar correo |
| DELETE | `/admin/comunicados/:id` | admin | Eliminar (204) |

Respuesta de crear/publicar/reenviar: `{ comunicado, correo: { enviado, mensaje } | null, mensaje }`.

## Puertos y adaptadores
- `ComunicadoRepository` → `TypeOrmComunicadoRepository` (tablas `comunicados`, `comunicado_medios`; autor desde `users`).
- `NotificacionesPort` → `TypeOrmNotificacionesAdapter` (`INSERT … SELECT` en `notificaciones`).
- `ComunicadosMailConfig` → `AppSettingsMailConfig` (`app_settings` + `ConfigService`).
- `ConexionesRepository` → `TypeOrmConexionesRepository` (SQL parametrizado sobre `users/cargos/areas/contratos`).
- Transversales: `Mailer`, `FileStorage`, `Clock`.

## Tablas
`comunicados`, `comunicado_medios` (propias); lectura de `users`, `cargos`, `areas`, `contratos`, `app_settings`; escritura en `notificaciones`.
No requiere migraciones nuevas (las tablas existen en `001_schema_base.sql`).

## No migrado
- Paginación por cursor (`cursor_date/cursor_id`) del legado: se sustituye por `page/size` según la convención del proyecto.
- Mensajes de límite de subida de PHP (`upload_max_filesize`): no aplican; el límite es el de `FileStorage` (50 MB).
