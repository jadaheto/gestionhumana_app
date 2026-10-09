# Módulo `contratos`

Migración de `controllers/Contratos.php` + `models/Contrato_model.php` (CodeIgniter) a NestJS con arquitectura hexagonal.

## Propósito
Gestión de los contratos laborales de los colaboradores: listado (admin/funcionario), creación, edición, eliminación, prórrogas, alertas de vencimiento a los administradores y generación de cartas (preaviso de terminación, prórroga y renovación) en PDF.

## Estructura
```
modules/contratos/
├── domain/
│   ├── contrato.ts                 # Agregado Contrato (invariantes, vencimiento, vigencia, prórroga)
│   ├── contrato-prorroga.ts        # ContratoProrroga y ContratoAlerta
│   ├── fechas.ts                   # sumar(), diferenciaDias(), fechaLargaEs(), ordinalTexto() (semántica strtotime)
│   ├── repositories.ts             # ContratoRepository, ContratoProrrogaRepository, ContratoAlertaRepository
│   └── ports.ts                    # UsuariosPort, NotificacionesPort, BrandingPort (otros contextos)
├── application/
│   ├── contrato-document-renderer.port.ts   # Modelo DocumentoContrato + puerto ContratoDocumentRenderer
│   ├── dto/contratos.dto.ts
│   └── use-cases/
│       ├── contratos.use-cases.ts                     # Listar, Obtener, Guardar, Eliminar, RegistrarProrroga, ListarProrrogas, ListarColaboradores
│       ├── sincronizar-contratos-vencidos.use-case.ts # sync_expired_contracts[_daily]
│       ├── notificar-contratos-por-vencer.use-case.ts # notificar_contratos_por_vencer
│       └── generar-documento-contrato.use-case.ts     # build_preaviso/prorroga/renovacion_html + procesar_firma_png
└── infrastructure/
    ├── http/contratos.controller.ts (+ dto/)
    ├── persistence/  # ORM contratos, contrato_prorrogas, contrato_alertas; repos TypeORM; adaptadores SQL de los puertos
    └── pdf/pdfkit-contrato-document-renderer.ts
```

## Reglas de negocio migradas
| Legado | Implementación |
|---|---|
| `index`: `sync_expired_contracts_daily()` antes de listar | `SincronizarContratosVencidosUseCase` (`forzar: false`): una vez por fecha (en memoria por proceso, en lugar del marcador en disco). `create/update/delete` lo ejecutan con `forzar: true` como `sync_expired_contracts()`. |
| `sync_expired_contracts`: `estado='finalizado'` si `activo` y `fecha_fin < CURRENT_DATE` | `ContratoRepository.finalizarVencidos(hoy)` con la fecha del `Clock`. |
| `sync_user_status_by_contracts`: `users.estado_colaborador` activo/inactivo según contrato activo vigente (no toca admins ni retirados) | `UsuariosPort.sincronizarEstadoPorContratos(hoy)` (SQL parametrizado). |
| `notificar_contratos_por_vencer` (solo admin al listar): contratos activos que vencen en ≤ 30 días → notificación a cada admin activo, una vez por `(contrato, destinatario, 'vencimiento', fecha_fin)` en `contrato_alertas` | `NotificarContratosPorVencerUseCase`; `ContratoAlertaRepository.save` usa `ON CONFLICT DO NOTHING` sobre el índice único. Notificación: título "Contrato por vencer", mensaje "`<nombre>` vence en N día(s). Define si deseas prorrogarlo.", tipo `contrato`, link `/contratos`. |
| Admin ve todos los contratos (con nombre, cédula, cargo); funcionario solo los suyos | `ListarContratosUseCase` con `Actor` (`actor.id`, nunca del body). `ObtenerContrato`/`ListarProrrogas` lanzan 403 si el funcionario no es el dueño. |
| `guardar`: campos user_id, tipo, número, fechas, salario, estado (por defecto activo), observaciones | `Contrato.create()` valida: colaborador, tipo ∈ {indefinido, fijo, prestacion_servicios, obra_labor, aprendizaje}, número obligatorio (≤ 50), fechas `AAAA-MM-DD`, fecha fin ≥ fecha inicio, salario > 0, estado ∈ {activo, finalizado, renovado}. En edición el colaborador no cambia (campo oculto del legado). Se comprueba que el colaborador exista. |
| `registrar_prorroga`: meses ≥ 1, contrato con fecha fin; inicio = fin + 1 día; nueva fin = inicio + N meses − 1 día; inserta `contrato_prorrogas`, pone contrato `activo` con la nueva fecha; sincroniza usuarios; transacción | `Contrato.prorrogar()` + `ContratoProrrogaRepository.registrar()` (transacción TypeORM). Devuelve `{ fechaFinAnterior, fechaFinNueva, meses }`. |
| `documento_pasos` (sesión paso 1 → paso 2) + `documento_generar` | Un solo `POST /contratos/:id/documentos` multipart con todos los campos (el frontend conserva el estado de los pasos). Valores por defecto idénticos: meses 3, número 1, años 1, código `G.H.3.1.` (preaviso) / `D.A.3`, firmante `DIRECTORA ADMINISTRATIVA` / `Comfasucre`, revisores `Jefe Departamento` / `Revisó Jurídica`, proyectó `Talento Humano`. |
| `documento_preaviso/prorroga/renovacion` (atajos con query `meses`, `numero`, `anios`) | `GET /contratos/:id/documentos/{preaviso|prorroga|renovacion}`. |
| `build_*_html`: fecha larga en español, nombre en mayúsculas, cargo − área, fechas de prórroga/renovación, ordinal (`primera (01) prórroga`), bloque de firma, revisores, pie | `GenerarDocumentoContratoUseCase` produce un `DocumentoContrato` (texto idéntico, negritas con `**`) que `PdfKitContratoDocumentRenderer` dibuja. Logo: `app_settings.branding_logo_dark` (vía `BrandingPort`); si no existe se escribe "COMFASUCRE". |
| `procesar_firma_png`: solo PNG, máx. 5 MB, guardado en `uploads/documentos/` e incrustado | Validación por cabecera PNG y tamaño (400 si falla, en lugar de ignorar en silencio), copia en `FileStorage` carpeta `documentos`, incrustación en el PDF. |
| Salida `.doc` (HTML con cabecera Word) | **PDF** (`application/pdf`, `Content-Disposition: attachment`). |

## Endpoints (`/api/v1`)
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/contratos` | autenticado | Listado (admin: todos + alertas; funcionario: propios). Sincroniza vencidos. |
| GET | `/contratos/colaboradores` | admin | Colaboradores `{ id, firstName, lastName, cedula, cargoNombre }` para el select. |
| GET | `/contratos/:id` | autenticado (dueño o admin) | Detalle. |
| POST | `/contratos` | admin | Crear. Body: `userId, tipoContrato, numeroContrato, fechaInicio, fechaFin?, salarioBase, estado?, observaciones?`. |
| PUT | `/contratos/:id` | admin | Actualizar (ignora `userId`). |
| DELETE | `/contratos/:id` | admin | Eliminar (204). |
| POST | `/contratos/:id/prorrogas` | admin | `{ meses, observacion? }` → `{ contratoId, fechaFinAnterior, fechaFinNueva, meses }`. |
| GET | `/contratos/:id/prorrogas` | dueño o admin | Historial de prórrogas. |
| POST | `/contratos/:id/documentos` | admin | multipart: `tipo (preaviso|prorroga|renovacion), meses?, numero?, anios?, codigo?, firmanteNombre?, firmanteCargo?, revisoUno?, revisoDos?, proyecto?, firmaPng?` → PDF. |
| GET | `/contratos/:id/documentos/preaviso` | admin | PDF con valores por defecto. |
| GET | `/contratos/:id/documentos/prorroga?meses&numero` | admin | PDF. |
| GET | `/contratos/:id/documentos/renovacion?anios` | admin | PDF. |

Respuesta `ContratoDto`: `id, userId, colaboradorNombre, cedula, cargoNombre, areaNombre, tipoContrato, tipoContratoNombre, numeroContrato, fechaInicio, fechaFin, salarioBase, estado, estadoNombre ("Inactivo" para finalizado), observaciones, diasParaVencer (null si indefinido), puedeProrrogar, createdAt, updatedAt`.

## Tablas
- `contratos` (propia): id, user_id, tipo_contrato, numero_contrato, fecha_inicio, fecha_fin, salario_base, estado, observaciones, created_at, updated_at.
- `contrato_prorrogas` (propia): historial de prórrogas.
- `contrato_alertas` (propia): alertas enviadas; índice único `idx_contrato_alertas_unique (contrato_id, destinatario_id, alerta_tipo, alerta_fecha)`.
- Lectura/escritura vía puertos (sin importar otros módulos): `users` (join de nombre/cédula/cargo, admins activos, `estado_colaborador`), `areas`, `cargos`, `notificaciones` (inserción), `app_settings` (logo).

Todas las tablas ya existen en `database/001_schema_base.sql`; **no se requieren migraciones nuevas**.

## Tests
`npx jest src/modules/contratos` — dominio (fechas, invariantes, prórroga), casos de uso con repositorios en memoria (vencimiento, sincronización diaria, alertas sin duplicar, autorización admin/funcionario, guardar/editar/eliminar, prórroga, documentos y firma PNG), renderizador pdfkit (PDF válido) y controlador con `createTestApp` + supertest (rutas, validación, roles, multipart, cabeceras PDF).
