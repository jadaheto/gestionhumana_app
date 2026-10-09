# Módulo `endeudamiento`

Migra `controllers/Endeudamiento.php`, `models/Endeudamiento_model.php` y las vistas `admin/endeudamiento_lista.php`, `endeudamiento_form.php` y `endeudamiento_ver.php`.

## Propósito
Evaluar el nivel de endeudamiento de un colaborador antes de autorizar un crédito/libranza: registra devengados, deducciones por concepto y la cuota del nuevo crédito, y concluye automáticamente (aprobado/rechazado) según un umbral.

## Reglas de negocio migradas (`EndeudamientoCalculator`, dominio puro)
Con `conceptos` = filas cuyo nombre no está vacío:
- `totalDevengado = salarioMensual + otrosDevengados`
- `totalDeducido = Σ conceptos.deducido`
- `netoActual = totalDevengado − totalDeducido`
- `deduccionesEndeudamiento = max(totalDeducido − deduccionesLey, 0)`
- `base = totalDevengado > 0 ? totalDevengado : 1`
- `porcentajeActual = totalDeducido / base × 100` (2 decimales)
- `valorQuincenal = cuotaMensual / 2`
- `porcentajeNuevoCredito = (totalDeducido + cuotaMensual) / base × 100`
- `netoRecibir = totalDevengado − (totalDeducido + cuotaMensual)`
- `concepto.porcentaje = deducido / base × 100`
- `umbralAprobacion <= 0` → `50`
- `estado = porcentajeNuevoCredito <= umbral ? 'aprobado' : 'rechazado'`; `conclusion` = texto manual en mayúsculas o `APROBADO`/`RECHAZADO`.
- Semáforo del formulario: `SUPERA LIMITE` (> umbral), `CERCA DEL LIMITE` (≥ 90 % del umbral), `ZONA SEGURA`.
- Cuota sugerida en el formulario: `valorSolicitado / plazoMeses` cuando ambos son > 0.
- Número de solicitud autogenerado `SOL-<año>-####` (consecutivo por `anio`); `anio` se deriva de la fecha. `created_by` = actor.
- Salario de referencia: `salario_base` del contrato activo más reciente; si no, `cargo_salarios.salario_2024 + aumento_2025`; si no, `0`.
- Búsqueda de colaboradores (no admin) por nombre, apellido, cédula o código de empresa, máximo 20 resultados, con su salario de referencia.

## Endpoints (`/api/v1/endeudamiento`, todos `admin`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/endeudamiento` | Listado (más recientes primero) |
| GET | `/endeudamiento/siguiente-numero` | `{ solicitudNo }` para el formulario |
| GET | `/endeudamiento/colaboradores?q=` | Buscar colaboradores con salario de referencia |
| GET | `/endeudamiento/colaboradores/:userId/salario-referencia` | `{ userId, salario }` |
| GET | `/endeudamiento/:id` | Detalle con conceptos |
| POST | `/endeudamiento` | Crea la evaluación (el servidor recalcula todo; si `solicitudNo` viene vacío se genera) |

## Tablas
`endeudamiento_solicitudes`, `endeudamiento_conceptos` (entidades ORM en `infrastructure/persistence/endeudamiento.orm-entities.ts`; escritura transaccional con SQL parametrizado). Lecturas de `users`, `contratos` y `cargo_salarios` mediante los puertos `ColaboradorFinder` y `SalarioReferenciaReader`.

## No migrado
- Edición/eliminación de evaluaciones: el legado tampoco las ofrecía (sólo crear, listar y ver).
