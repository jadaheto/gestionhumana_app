# Módulo `beneficios` — Solicitudes, vacaciones e incapacidades

## Propósito
Migra del legado `controllers/Solicitudes.php`, `controllers/Beneficios.php`, `models/Solicitud_model.php`,
`models/Beneficio_model.php`, `models/Vacaciones_model.php` y `MiPuesto::vacaciones_pendientes`:

- **Solicitudes** (`permisos`): creación por el funcionario (permiso, vacaciones o incapacidad), listado propio,
  listado/aprobación/rechazo por el administrador y **suspensión de vacaciones aprobadas**.
- **Saldo de vacaciones**: períodos cumplidos, días acumulados/consumidos/pendientes.
- **Vacaciones** (`vacaciones`/`vacaciones_detalle`): listado de períodos (propios o de todos).
- **Incapacidades**: listado y registro con soporte.
- **Colaboradores**: listado de sólo lectura para selects de administración.

## Estructura
```
domain/
  dias-habiles.calculator.ts   Servicio puro: festivos de Colombia (fijos, Ley Emiliani, Pascua) y días hábiles
  permiso.ts                   Entidad Permiso (create/aprobar/rechazar) + normalización de fecha-hora
  incapacidad.ts               Entidad Incapacidad
  vacaciones-suspension.ts     Entidad VacacionesSuspension (registrar con validaciones)
  vacaciones-saldo.ts          Servicio puro VacacionesSaldoCalculator (períodos × 15, consumidos, pendientes)
  vacacion.ts                  Modelos de sólo lectura Vacacion / VacacionDetalle
  repositories.ts              Puertos: PermisoRepository, VacacionesSuspensionRepository, IncapacidadRepository, VacacionRepository
  ports.ts                     Puertos a otros contextos: UsuariosPort (users/contratos), NotificacionesPort
application/
  use-cases/solicitudes.use-cases.ts     Crear, ListarMis, ListarAdmin, Aprobar, Rechazar, SuspenderVacaciones
  use-cases/vacaciones.use-cases.ts      GetResumenVacaciones, ListarVacaciones
  use-cases/incapacidades.use-cases.ts   ListarIncapacidades, RegistrarIncapacidad, ListarColaboradores
infrastructure/
  persistence/beneficios.orm-entity.ts   Entidades ORM: permisos, incapacidades, vacaciones, vacaciones_detalle, vacaciones_suspensiones
  persistence/typeorm-beneficios.repositories.ts
  persistence/typeorm-usuarios.adapter.ts        SQL sobre users/contratos (admins activos, fecha de ingreso, colaboradores)
  persistence/typeorm-notificaciones.adapter.ts  INSERT en notificaciones
  http/solicitudes.controller.ts, http/beneficios.controller.ts, http/dto/beneficios-request.dto.ts
```

## Reglas de negocio migradas
### Días hábiles (`DiasHabilesCalculator`)
- Lunes a viernes, excluyendo festivos colombianos.
- Fijos: 01/01, 01/05, 20/07, 07/08, 08/12, 25/12.
- Trasladables al lunes siguiente (Ley Emiliani): 06/01, 19/03, 29/06, 15/08, 12/10, 01/11, 11/11.
- Según Pascua (algoritmo gregoriano, equivalente a `easter_date()`): Jueves Santo (−3), Viernes Santo (−2),
  Ascensión (+43 → lunes), Corpus Christi (+64 → lunes), Sagrado Corazón (+71 → lunes).
- Rango inválido o fin < inicio ⇒ 0 días.

### Solicitudes
- Tipos permitidos: `personal, medico, calamidad, diligencia, estudio, otro, vacaciones, incapacidad`.
- Fechas obligatorias y `fechaFin >= fechaInicio` (columna TIMESTAMP, se acepta `YYYY-MM-DD[THH:mm]`).
- Justificación obligatoria. `horas` se ignora para vacaciones e incapacidad.
- Incapacidad exige soporte. Soporte en `uploads/soportes` (gif, jpg, jpeg, png, pdf, doc, docx; 5 MB).
- Al crear se notifica a todos los administradores activos (`notificaciones`, tipo `solicitud`, link `/solicitudes/admin`).
- Sólo se aprueban/rechazan solicitudes `pendiente` (si no: 422 "La solicitud ya fue procesada.").
- Aprobar vacaciones: días hábiles > 0 ("La solicitud de vacaciones no tiene días hábiles válidos.") y no superar el saldo
  disponible excluyendo la propia solicitud ("No se puede aprobar vacaciones anticipadas. Solicitados: X días hábiles, disponibles: Y.").
- Suspender vacaciones (admin): sólo `vacaciones` en estado `aprobado`; días hábiles > 0; `diasDisfrutados >= 1` y
  `<= diasTotales`; `diasReintegrados = totales − disfrutados`. Una suspensión por permiso (se actualiza si ya existe).

### Saldo de vacaciones (`get_saldo_resumen`)
- Fecha de ingreso de referencia: contrato `activo` con `fecha_inicio` → último contrato → `users.fecha_ingreso`.
- `periodos` = años completos entre la fecha de referencia y hoy; `diasAcumulados = periodos × 15`.
- `diasConsumidos` = suma de días hábiles de vacaciones aprobadas; si fueron suspendidas, sólo los días disfrutados.
- `diasPendientes = max(0, acumulados − consumidos)`.

### Incapacidades
- Tipos: `enfermedad_general, accidente_laboral, maternidad, paternidad, otra`. Fechas `YYYY-MM-DD` y fin >= inicio.
- `dias` >= 1 (si no se envía, se calcula como días calendario inclusivos).
- El administrador puede indicar `userId`; el funcionario siempre registra sobre sí mismo.
- Soporte en `uploads/incapacidades` (gif, jpg, jpeg, png, pdf; 5 MB).

## Endpoints (prefijo `api/v1`)
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/solicitudes/mis-permisos` | autenticado | Mis solicitudes |
| POST | `/solicitudes` (multipart, campo `archivoSoporte`) | autenticado | Crear solicitud |
| GET | `/solicitudes/admin?estado=` | admin | Todas las solicitudes con colaborador/aprobador |
| POST | `/solicitudes/:id/aprobar` `{observacion?}` | admin | Aprobar |
| POST | `/solicitudes/:id/rechazar` `{observacion?}` | admin | Rechazar |
| POST | `/solicitudes/:id/suspender-vacaciones` `{diasDisfrutados, motivo?}` | admin | Suspender vacaciones aprobadas |
| GET | `/beneficios/vacaciones` | autenticado | Períodos propios (funcionario) o de todos (admin) |
| GET | `/beneficios/vacaciones/saldo` | autenticado | Resumen de vacaciones propio (saldo, solicitudes, suspensiones) |
| GET | `/beneficios/vacaciones/saldo/:userId` | admin | Resumen de vacaciones de un colaborador |
| GET | `/beneficios/permisos` | autenticado | Permisos propios |
| GET | `/beneficios/incapacidades` | autenticado | Incapacidades propias (funcionario) o de todos (admin) |
| POST | `/beneficios/incapacidades` (multipart, campo `archivoSoporte`) | autenticado | Registrar incapacidad |
| GET | `/beneficios/colaboradores` | admin | Colaboradores activos (id, nombre, cédula) para selects |

Errores: 400 validación, 403 rol, 404 inexistente, 422 regla de negocio (`code: INVALID_OPERATION`).

## Tablas
- `permisos` (propia), `incapacidades` (propia), `vacaciones` y `vacaciones_detalle` (propias, sólo lectura),
  `vacaciones_suspensiones` (propia; DDL en `002_schema_runtime.sql`).
- Lectura vía puertos: `users` (admins activos, colaboradores, `fecha_ingreso`), `contratos` (`fecha_inicio`, `estado`).
- Escritura vía puerto: `notificaciones`.
- No requiere migraciones nuevas: todas las tablas existen en `BaselineSchema`.

## Tests
`npx jest src/modules/beneficios` — dominio (festivos 2025/2026, días hábiles, entidades, saldo, suspensión),
casos de uso con repositorios en memoria y controladores con `createTestApp` (roles, validación, multipart).

## Solicitudes: aprobación en dos pasos (jefe inmediato → Gestión Humana)
- Al crear la solicitud se resuelve el **jefe inmediato** con el organigrama (`UsuariosPort.findJefeInmediatoId`): responsable
  activo del área del colaborador; si no hay o es el mismo colaborador, el de la dependencia superior (`areas.padre_id`), y así
  hacia arriba. Se guarda en `permisos.jefe_id` con `jefe_estado = pendiente` y se notifica al jefe.
- **Jefe**: `GET /solicitudes/jefe`, `POST /solicitudes/:id/jefe/aprobar|rechazar` (sólo el jefe asignado). El visto bueno deja
  la solicitud `pendiente` con `jefe_estado = aprobado` y notifica a los administradores; el rechazo la cierra (`rechazado`).
- **Gestión Humana** (admin): `POST /solicitudes/:id/aprobar|rechazar` sólo cuando el jefe ya aprobó o no aplica; antes
  responde "La solicitud aún espera el visto bueno del jefe inmediato".
- Sin jefe en el organigrama (`jefe_estado = no_aplica`) la solicitud va directo a Gestión Humana, igual que las anteriores a la
  migración `1797000000000-SolicitudesJefeInmediato`.
- El DTO expone `jefeId`, `jefeEstado`, `jefeObservacion`, `jefeFecha`, `jefe` y `etapa` (`jefe` | `gestion_humana` | `finalizada`).
- `GET /solicitudes/jefe/estado` → `{ esJefe }`: verdadero si el usuario es responsable de un área activa o tiene solicitudes
  asignadas como jefe; el frontend lo usa para mostrar u ocultar la bandeja del equipo.
