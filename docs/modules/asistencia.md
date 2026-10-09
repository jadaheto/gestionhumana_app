# Módulo `asistencia`

Migra `controllers/Asistencia.php`, `models/Asistencia_model.php` y las vistas `asistencia/index.php` e `historial.php`.

## Propósito
Control de asistencia a partir de los archivos del reloj biométrico de cada sede: importación de marcaciones, consolidación del resumen diario según la política de la sede, envío de memorandos de tardanza por correo e historial propio del funcionario.

## Reglas de negocio migradas
- **Política por sede** (`asistencia_politicas`): hora límite de entrada, hora de salida temprana, tolerancia en minutos e interruptor de envío de memorandos. Si la sede no tiene política guardada se usan los valores del legado: `08:10:00`, `11:59:00`, tolerancia `0`, memorandos activados (`configurada: false` en la respuesta).
- **Importación** (`Asistencia::importar`): sólo `xlsx`, `csv` o `txt`, máximo 20 MB. La primera fila son cabeceras que se normalizan (`"ID de Usuario"` → `id_de_usuario`, `"Fecha/Hora"` → `fecha_hora`). Columnas reconocidas: `id_de_usuario`/`identificacion` (ignorando `0`), `nombre`, `tipo_de_registro`/`tipo_registro`, `departamento`, `dispositivo_nro`, `fecha_hora`/`fecha` (+ `hora` o 7.ª columna). Filas sin identificación, nombre o fecha interpretable se descartan; si no queda ninguna, error 400. Formatos de fecha: `d/m/y H:i:s`, `d/m/Y H:i:s`, `Y-m-d H:i:s` y variantes (sin segundos, con `T`, celdas de fecha de Excel). El colaborador se resuelve por `TRIM(cedula)` o `TRIM(codigo_empresa)` entre los usuarios no admin de la sede; las marcaciones sin colaborador se guardan con `user_id = NULL` y se informan en `sinColaborador`.
- **Consolidación** (`rebuild_daily_summary`, servicio de dominio `consolidarDia`): para cada colaborador activo (no admin) de la sede:
  - entrada = primera marcación `in`/`entrada` o, si no hay, la primera del día; salida = última `out`/`salida` o la última del día;
  - `minutos_tarde` = minutos enteros después de `hora_entrada_limite + tolerancia`;
  - `minutos_salida_temprana` = minutos enteros antes de `hora_salida_temprana`;
  - estados: `normal`, `tarde`, `salida_temprana`, `tarde_salida_temprana`, `falla` (sin marcaciones) y `justificado` (sin marcaciones pero con permiso/vacaciones aprobados o incapacidad activa ese día; el texto queda en `justificacion`/`detalle`).
  - Se recalcula en cada consulta del resumen (upsert por `user_id + sede_id + fecha`), igual que el legado al cargar la pantalla.
- **Memorandos de tardanza** (`enviar_memorandos`): acción explícita (POST). Reconsolida, respeta `enviar_memorando_tardanza`, toma las filas con `minutos_tarde > 0`, `memo_enviado = false` y correo no vacío; envía un correo por fila mediante el puerto `Mailer` y marca `memo_enviado`/`memo_enviado_at` o `memo_error`. No reenvía memorandos ya enviados.
- **Historial propio** (`Asistencia::historial`): usa siempre `actor.id`. Devuelve, por rango de fechas (por defecto el mes actual), la unión de la tabla heredada `asistencia` (registros `presencial`/`virtual`) y del resumen diario biométrico (`tipo: 'biometrico'` con su estado).

## Endpoints (`/api/v1/asistencia`)
| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/asistencia/sedes` | admin | Sedes activas para el filtro |
| GET | `/asistencia/resumen?sedeId=&fecha=` | admin | Reconsolida y devuelve `{ fecha, sedeId, politica, resumen[] }` |
| POST | `/asistencia/importar` (multipart: `sedeId`, `archivo`) | admin | Importa marcaciones; responde `{ importacionId, totalFilas, sinColaborador, mensaje }` |
| POST | `/asistencia/memorandos` `{ sedeId, fecha? }` | admin | Envía memorandos pendientes; `{ enviados, fallidos, mensaje }` |
| GET | `/asistencia/politicas/:sedeId` | admin | Política (o valores por defecto) |
| PUT | `/asistencia/politicas/:sedeId` | admin | Guarda la política (`horaEntradaLimite`, `horaSalidaTemprana`, `toleranciaMinutos`, `enviarMemorandoTardanza`) |
| GET | `/asistencia/mi-historial?desde=&hasta=` | cualquier usuario | Historial del usuario autenticado |

## Tablas
`asistencia`, `asistencia_importaciones`, `asistencia_marcaciones`, `asistencia_politicas`, `asistencia_resumen_diario` (entidades ORM en `infrastructure/persistence/asistencia.orm-entities.ts`). Lecturas de otros contextos mediante puertos: `users`/`sedes` (`ColaboradoresSedeReader`, `SedesReader`) y `permisos`/`incapacidades` (`JustificacionReader`), implementados con SQL parametrizado.

## Puertos y adaptadores
- `AsistenciaFileParser` → `BufferAsistenciaFileParser` (CSV/TSV con detección de delimitador y comillas; XLSX con exceljs). El mapeo de filas es dominio puro (`marcacion-row.mapper.ts`).
- `Mailer` y `Clock` del núcleo compartido.

## No migrado
- Conexión opcional a una base de datos externa (`external_db`) para la tabla `asistencia`: el legado la usaba sólo si había credenciales reales; aquí se lee siempre la base local.
- `get_today()` del modelo (no era usado por ningún controlador).
