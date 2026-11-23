# Módulo `colaboradores`

Bounded context de **Colaboradores**: administración de colaboradores (admin), información personal del propio usuario, carnet digital y perfil de la cuenta. Migra `controllers/Colaboradores.php`, `InfoPersonal.php`, `Carnet.php` y `Profile.php` (más `Colaborador_model`, `InfoPersonal_model` y la parte de perfil de `User_model`).

Ubicación: `backend/src/modules/colaboradores/` (`ColaboradoresModule`, cuatro controladores).

## Reglas de negocio migradas

### Colaboradores (sólo `admin`)
- El listado excluye a los usuarios con rol `admin`, incluye nombres de sede/área/cargo y admite filtros `estado`, `areaId`, `sedeId` (`Colaborador_model::get_all`).
- Crear/editar valida: nombres, apellidos, correo (obligatorio y con formato), cédula obligatoria, estado ∈ {activo, inactivo, retirado}, fechas `YYYY-MM-DD`.
- Unicidad con los mismos mensajes del legado → `409 CONFLICT`: correo (sin distinguir mayúsculas), cédula (`TRIM`), código de empresa (si se envía) y nombre de usuario.
- Al crear: si no se envía `username` se genera como el legado (inicial del nombre + apellido sin espacios/tildes, sólo `[a-z0-9]`) y se añade un contador hasta que sea único; si no se envía `password` se genera una temporal con `TokenGenerator.temporaryPassword()` y **se devuelve una sola vez** en la respuesta. La contraseña se guarda con `PasswordHasher`. El rol siempre es `funcionario`. Se crea la fila inicial en `puntos` (puerto `PuntosInitializer`).
- Al editar se conservan `username`, `role`, `profile_image` y `numero_hijos` (el formulario de admin no los toca).
- La foto se sube aparte (`POST /colaboradores/:id/foto`), carpeta `profile`, extensiones png/jpg/jpeg/gif, máximo 5 MB (límite del legado).
- Eliminar: el administrador **no puede eliminarse a sí mismo** (`422 INVALID_OPERATION`); el repositorio nunca borra filas con rol `admin`.
- El detalle incluye el contrato activo más reciente (puerto `ContratoActivoReader`, misma consulta que `get_contrato_activo`).

### Información personal (usuario autenticado)
- Datos básicos: sólo los campos que el legado permitía editar (dirección, teléfonos, género, estado civil, tipo de sangre, EPS, ARL, fondo de pensión, caja, número de hijos ≥ 0). La respuesta incluye identidad de sólo lectura (nombre, cédula, correo, código, fechas).
- Educación formal, educación no formal, familiares y experiencia laboral: listar/crear/editar/eliminar **siempre sobre el actor** (anti-IDOR: los `UPDATE`/`DELETE` filtran por `user_id`). El admin puede **consultar** las de otro usuario con `?userId=`; un funcionario que lo intente recibe `403`.
- Validaciones de dominio: nivel/estado de estudio/tipo/parentesco dentro de los catálogos del legado; institución, programa, nombre, empresa y cargo obligatorios; horas ≥ 0; la fecha final no puede ser anterior a la inicial.
- Educación no formal admite un certificado adjunto (`multipart`, campo `certificado`, pdf/png/jpg, máx. 5 MB) guardado en `uploads/certificados`; al reemplazarlo o eliminar el registro se borra el archivo anterior.

### Carnet digital
- `GET /carnet` devuelve los datos de `views/carnet/_page.php`: nombre, cargo (nombre del cargo o `designation`, "Sin cargo"), área ("Sin área"), sede/cédula/código ("N/A"), foto, logo de branding (`app_settings.branding_logo_light` si apunta a `uploads/`), año y el contenido JSON del QR (`nombre, cedula, cargo, area, codigo`).
- Un funcionario sólo puede ver su propio carnet; el admin cualquiera (`Carnet::ver`).

### Perfil
- `GET /perfil` incluye `completionPct` (mismos 11 campos que `settings.php`) y los 5 últimos inicios de sesión de `login_history` (puerto `LoginHistoryReader`).
- Actualizar datos personales (`Profile::update_personal_details`): nombres/apellidos/correo obligatorios; el correo no puede pertenecer a otro usuario (`409`); `skills` se guarda separado por comas; `joining_date` como `YYYY-MM-DD`.
- Portafolio (`update_portfolio`): github, sitio web, Facebook (`dribbble_username`) e Instagram (`pinterest_username`), como en la vista legada.
- Imágenes de perfil y portada: carpeta `profile`, png/jpg/jpeg/gif, **2 MB**.
- Cambio de contraseña (`change_password`): verifica la actual con `PasswordHasher.compare` (`401`), exige coincidencia y mínimo 8 caracteres (`400`).
- `privacy_settings` (JSONB): sólo las 5 claves del legado, booleanas (ausente = false). `experience` (JSONB): se descartan filas sin `job_title` y se rellenan vacíos con `''`.

## Endpoints (`/api/v1`)

| Método | Ruta | Rol |
|---|---|---|
| GET | `/colaboradores?estado&areaId&sedeId` | admin |
| GET | `/colaboradores/:id` | admin |
| POST | `/colaboradores` | admin |
| PUT | `/colaboradores/:id` | admin |
| POST | `/colaboradores/:id/foto` (multipart `file`) | admin |
| DELETE | `/colaboradores/:id` | admin |
| GET / PUT | `/info-personal/datos-basicos` (`?userId` sólo lectura admin) | autenticado |
| GET / POST | `/info-personal/educacion-formal` | autenticado |
| PUT / DELETE | `/info-personal/educacion-formal/:id` | autenticado (propio) |
| GET / POST | `/info-personal/educacion-no-formal` (POST multipart, `certificado` opcional) | autenticado |
| PUT / DELETE | `/info-personal/educacion-no-formal/:id` (PUT multipart) | autenticado (propio) |
| GET / POST | `/info-personal/familiares` | autenticado |
| PUT / DELETE | `/info-personal/familiares/:id` | autenticado (propio) |
| GET / POST | `/info-personal/experiencia` | autenticado |
| PUT / DELETE | `/info-personal/experiencia/:id` | autenticado (propio) |
| GET | `/carnet` | autenticado |
| GET | `/carnet/:userId` | admin (o el propio id) |
| GET | `/perfil` | autenticado |
| PUT | `/perfil` | autenticado |
| PUT | `/perfil/portafolio` | autenticado |
| POST | `/perfil/foto`, `/perfil/portada` (multipart `file`) | autenticado |
| PUT | `/perfil/password` | autenticado |
| PUT | `/perfil/privacidad` | autenticado |
| PUT | `/perfil/experiencia` | autenticado |

## Tablas
- `users` (entidad central `UserOrmEntity` de `shared`): colaboradores, datos básicos y perfil.
- `educacion_formal`, `educacion_no_formal`, `familiares`, `experiencia_laboral` (entidades ORM propias en `infrastructure/persistence/info-personal.orm-entities.ts`).
- Lectura vía SQL parametrizado (puertos): `contratos`, `login_history`, `app_settings`.

## Estructura
- `domain/`: `Colaborador` (+ `generateUsername`), registros de información personal, `Perfil` (+ privacidad/experiencia), puertos `ColaboradorRepository`, `*Repository`, `ContratoActivoReader`, `LoginHistoryReader`, `BrandingReader`.
- `application/`: casos de uso por operación y DTOs de salida.
- `infrastructure/http/`: `ColaboradoresController`, `InfoPersonalController`, `CarnetController`, `PerfilController` + DTOs class-validator/Swagger.
- `infrastructure/persistence/`: repositorios TypeORM y adaptadores SQL de los puertos.
- Tests: casos de uso con repositorios en memoria (`application/use-cases/__tests__`), dominio y controladores (`createTestApp` + supertest).
