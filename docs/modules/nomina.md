# Módulo `nomina` — Nómina y "Mi puesto de trabajo"

## Propósito
Migra del legado:
- `controllers/MiPuesto.php` + `models/MiPuesto_model.php`: cuentas bancarias, desprendibles (listado y PDF "Comprobante de pago"), reportes, certificado laboral y de ingresos/retenciones.
- `libraries/Nomina_parser.php`: parser del texto del PDF de "LIQUIDACIÓN DE NOMINA" → `domain/nomina-parser.ts` (servicio de dominio puro, port íntegro con tests).
- `controllers/AdminUsuarios.php` (importación de nómina): `importar_nomina_pdf`, `cerrar_lotes_atascados`, `procesar_importar_nomina_pdf`, `confirmar_importar_nomina_pdf`, `iniciar_importar_nomina`, `procesar_lote_nomina`, `historial_importaciones`, `extract_pdf_text`, `import_nomina_employee`, `upsert_user_from_nomina`, `upsert_{sede,area,cargo}_by_name`, `build_unique_{email,username}`, `build_periodo_key`.

## Estructura
```
modules/nomina/
├── domain/
│   ├── cuenta-bancaria.ts         # Agregado CuentaBancaria (validaciones)
│   ├── desprendible.ts            # Modelo + helpers de conceptos JSONB
│   ├── certificado.ts             # Tipos de certificado y modos del laboral
│   ├── nomina-parser.ts           # NominaParser (port de Nomina_parser.php)
│   ├── nomina-import.ts           # Lotes, errores, vista previa y reglas puras de importación
│   ├── repositories.ts            # Puertos: CuentaBancariaRepository, DesprendibleRepository, CertificadoRepository, NominaImportLoteRepository, NominaPreviewStore
│   └── ports.ts                   # Puertos hacia otros contextos: PerfilColaboradorReader, ContratoReader, CertificadoConfigReader, CedulasExistentesReader, NominaEmpleadoImporter
├── application/
│   ├── ports/                     # PdfRenderer (spec declarativa → Buffer), PdfTextExtractor
│   ├── formato.ts                 # fechas dd/mm/yyyy, pesos, tipo de contrato legible
│   └── use-cases/                 # cuentas-bancarias, desprendibles (+reportes), certificados, importacion-nomina
├── infrastructure/
│   ├── http/                      # MiPuestoController, NominaImportacionController + DTOs
│   ├── persistence/               # 6 entidades ORM, repositorios TypeORM, lectores SQL, importador transaccional
│   └── pdf/                       # PdfkitPdfRenderer, PopplerPdfTextExtractor (/usr/bin/pdftotext)
└── nomina.module.ts
```

## Reglas de negocio migradas
### Cuentas bancarias
- Un funcionario sólo ve/crea/edita/elimina **sus** cuentas (`actor.id`). Tipo ∈ {ahorros, corriente}; banco obligatorio (≤100); número 4–30 alfanuméricos.

### Desprendibles
- Listado ordenado por `fecha_fin DESC, periodo DESC`; `nro_comprobante` vacío → `NOM-<id>`.
- PDF "COMPROBANTE DE PAGO" generado con pdfkit replicando `descargar_desprendible`: logo (`branding_logo_dark`), No. comprobante, fecha liquidación (hoy si falta), periodo, empleado, cédula, cargo, área, banco/cuenta, tabla CONCEPTO/DEVENGOS/DESCUENTOS (fila "Salario" si no hay conceptos), totales y neto.
- **Decisión**: el PDF se genera **siempre** a partir de los datos. `archivo_pdf` del desprendible apunta al PDF de la liquidación completa importada (todos los empleados), por lo que no se entrega al funcionario (evitaría una fuga de datos de terceros). Igual que el legado, que tampoco servía ese archivo.

### Certificado laboral (`generar_certificado_laboral_pdf`)
- Modos: `actual` (contrato activo vigente hoy), `historico` (vigente + vencidos), `vencido` (un contrato del usuario con `fecha_fin < hoy`; exige `contratoId`).
- Sin contratos → 422 "No se encontraron contratos para generar la certificación."
- Texto: "La suscrita {cert_jefe_cargo} … certifica que: El(la) señor(a) {nombre}, identificado(a) con cédula No. {cedula} … Contrato {tipo} desde … hasta {fecha|Vigente}, desempeñando el cargo de {cargo} con salario mensual de ${salario}." + prórrogas (`contrato_prorrogas`), fecha de expedición, firma (`cert_firma_png`), `cert_jefe_nombre`/`cert_jefe_cargo` (defecto "Jefe Departamento Gestión Humana").
- `incluirFunciones=true` añade las funciones del cargo (`cargos.funciones`) y registra `laboral_con_funciones`; si no, `laboral_sin_funciones` (el legado siempre guardaba `laboral_con_funciones`).
- Se registra en `certificados` con `datos = { modo, contratos:[ids], incluirFunciones }`.

### Certificado de ingresos y retenciones
- El legado sólo mostraba un marcador de posición. Aquí se genera a partir de los desprendibles del año gravable (`fecha_fin`/`fecha_inicio`/`periodo`): acumula devengados y deducciones por concepto, calcula aportes a salud (concepto con "salud"/"eps"), pensión ("pensi", fondos) y retención ("retenci"). Sin desprendibles del año → 422. Registra `ingresos_retenciones`.

### Reportes
- El legado mostraba "próximamente". Se devuelve un resumen: nº de desprendibles, último período, neto del año en curso, certificados y cuentas.

### Importación de nómina (admin)
1. **Preview** (`procesar_importar_nomina_pdf`): guarda el PDF en `uploads/nomina/` (sólo `.pdf`, ≤50 MB), extrae texto con `pdftotext -layout` (fallback sin flags), parsea, fuerza la fuente si se indicó (`auto` = detectar; vacío → `COLEGIO`), rechaza PDF sin texto o sin empleados (y borra el archivo), marca `existe` por cédula (una sola consulta con variantes limpia/con DV, normalizando `-` y `.`), detecta lote previo `completado|parcial` del mismo período+fuente, purga vistas previas de >24 h y persiste la vista previa con token hex de 32.
2. **Confirmar** (`iniciar_importar_nomina`): crea `nomina_import_lotes` en `procesando` (`fuente` vacía → `SIN_FUENTE`), idempotente ante doble clic (devuelve el mismo `loteId`).
3. **Procesar** (`procesar_lote_nomina`): tanda de N empleados (5 por defecto, máx. 50); cada empleado en **su propia transacción** (`NominaEmpleadoImporter`): upsert sede (por fuente), área (defecto EDUCACION), cargo (defecto SIN CARGO, nivel 5) por nombre (case-insensitive, con caché por sesión); upsert usuario por cédula (crea `nom<cedula>@nomina.local`, username `nom<cedula>` únicos, contraseña aleatoria hasheada, rol funcionario; al actualizar no toca `codigo_empresa`); actualiza `salario_base` del contrato activo si difiere del sueldo del PDF; upsert desprendible por `(user_id, periodo, fecha_inicio, fecha_fin)` con `periodo = "{ini}_{fin}_{FUENTE}_T{tipo}"`. Errores → `nomina_import_errores` (+`raw_block` ≤3000) sin abortar la tanda; contadores incrementados atómicamente. Si se omite `offset` continúa desde `procesados` (reanudable). Al terminar: `completado`/`parcial` (si hubo errores), `detalle = "Importación desde PDF <archivo>"`, borra la vista previa.
4. **Historial**: últimos 100 lotes con nombre del importador y errores por lote; antes cierra lotes atascados (>30 min en `procesando` → `error`, "Importación interrumpida (marcada automáticamente).").
5. **Cancelar**: borra vista previa y PDF; no permitido si el lote ya se inició.

**Decisión — vista previa temporal**: el legado la guardaba en `uploads/nomina/preview_<token>.json`. Aquí se persiste en la tabla `nomina_import_previews` (migración `1791500000000-NominaImportPreviews`) porque `FileStorage` no permite escribir en una ruta determinista ni actualizar in situ, y la tabla permite enlazar el lote, guardar el avance (`procesados`) y purgar por antigüedad con SQL.

**No migrado**: la ruta síncrona `confirmar_importar_nomina_pdf` (importación completa en una sola transacción, usada sólo como fallback sin JavaScript); el flujo por tandas la sustituye.

## Endpoints (prefijo `api/v1`)
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/mi-puesto/cuentas` | autenticado | Mis cuentas bancarias |
| POST | `/mi-puesto/cuentas` | autenticado | Crear cuenta |
| PUT | `/mi-puesto/cuentas/:id` | autenticado | Editar cuenta propia |
| DELETE | `/mi-puesto/cuentas/:id` | autenticado | Eliminar cuenta propia (204) |
| GET | `/mi-puesto/desprendibles` | autenticado | Mis desprendibles |
| GET | `/mi-puesto/desprendibles/:id` | autenticado | Detalle con conceptos |
| GET | `/mi-puesto/desprendibles/:id/pdf` | autenticado | Comprobante de pago (application/pdf, attachment) |
| GET | `/mi-puesto/reportes` | autenticado | Resumen de reportes |
| GET | `/mi-puesto/certificados?tipo=laboral\|ingresos_retenciones` | autenticado | Historial de certificados |
| GET | `/mi-puesto/certificados/laboral/contratos` | autenticado | Contrato actual y vencidos |
| POST | `/mi-puesto/certificados/laboral` | autenticado | `{ modo, contratoId?, incluirFunciones }` → PDF |
| POST | `/mi-puesto/certificados/ingresos` | autenticado | `{ anio }` → PDF |
| POST | `/admin/nomina/importaciones/preview` | admin | multipart `archivo` (PDF ≤50 MB) + `fuente` → vista previa con `token` |
| GET | `/admin/nomina/importaciones/preview/:token` | admin | Vista previa pendiente |
| POST | `/admin/nomina/importaciones/:token/confirmar` | admin | Crea el lote → `{ loteId, total }` |
| DELETE | `/admin/nomina/importaciones/:token` | admin | Cancela la vista previa (204) |
| POST | `/admin/nomina/importaciones/lotes/:id/procesar` | admin | `{ offset?, size? }` → `{ processed, total, done, estado, counts }` |
| GET | `/admin/nomina/importaciones/lotes/:id` | admin | Estado del lote con errores |
| GET | `/admin/nomina/importaciones` | admin | Historial (100) con errores |
| POST | `/admin/nomina/importaciones/cerrar-atascados` | admin | `{ cerrados }` |

## Tablas
- Propias: `cuentas_bancarias`, `desprendibles_nomina`, `certificados`, `nomina_import_lotes`, `nomina_import_errores`, `nomina_import_previews` (nueva).
- Leídas/escritas por SQL parametrizado a través de puertos: `users`, `sedes`, `areas`, `cargos`, `contratos`, `contrato_prorrogas`, `app_settings` (claves `cert_jefe_nombre`, `cert_jefe_cargo`, `cert_firma_png`, `branding_logo_dark`).

## Archivos
- PDFs de nómina importados: carpeta `nomina` del `FileStorage` (`/uploads/nomina/...`). Las rutas de imágenes de `app_settings` (`uploads/branding/x.png` en el legado) se resuelven contra el almacenamiento quitando el prefijo `uploads/`.
- `pdftotext`: `/usr/bin/pdftotext` (configurable con `PDFTOTEXT_BIN`).

## Tests
`npx jest src/modules/nomina` — 80 tests: parser (fixtures de texto), reglas de importación, casos de uso con repos en memoria, controladores con `createTestApp` (roles/validación/PDF) e integración real pdfkit → pdftotext → parser.

## Cuentas bancarias: las gestiona Gestión Humana
El colaborador sólo consulta sus cuentas (`GET /mi-puesto/cuentas`). Registrar, editar y eliminar (`POST`, `PUT`, `DELETE
/mi-puesto/cuentas`) es exclusivo de administradores, que indican el colaborador con `userId` (cuerpo en POST/PUT, query en
GET/DELETE; por defecto, la cuenta propia). Un colaborador recibe 403.
