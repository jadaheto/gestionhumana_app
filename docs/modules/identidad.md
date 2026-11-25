# Módulo `identidad`

Identidad empresarial (misión, visión, valores, principios, himno) y configuración de la aplicación sobre `app_settings`:
branding (logos/favicon), correo de comunicados y certificado laboral.

Migra: `controllers/Identidad.php`, `models/Identidad_model.php`, `helpers/branding_helper.php` y, de
`controllers/AdminUsuarios.php`: `branding`, `guardar_branding`, `upload_branding_asset`, `correo_comunicados`,
`guardar_correo_comunicados`, `certificado_laboral_config`, `guardar_certificado_laboral_config`.

## Reglas de negocio migradas
- Identidad: campos fijos `mision, vision, valores, principios, himno_url` (tabla `identidad_empresa`, uno por fila).
  Al guardar sólo se actualizan los campos enviados (como `Identidad::guardar`). `himno_url` debe ser http(s) o vacía.
- Branding: 5 slots (`light, dark, sm, auth, favicon`) ↔ claves `branding_logo_light`, `branding_logo_dark`,
  `branding_logo_sm`, `branding_logo_auth`, `branding_favicon`. Logos `png|jpg|jpeg|svg`, favicon `ico|png`, máx. 5 MB,
  carpeta `branding`. Debe enviarse al menos un archivo ("No se seleccionaron archivos para actualizar logos."). Sólo se
  reemplazan los slots enviados. La lectura devuelve `archivo` (ruta relativa a `/uploads/`, normalizando `uploads/branding/x`)
  y `personalizado`; `archivo=null` significa "usar el logo por defecto del frontend".
- Correo de comunicados: `comunicados_mail_mode` (`test|produccion`), `comunicados_mail_test_to`, `comunicados_mail_prod_to`;
  ambos correos obligatorios y válidos. Valores por defecto: configuración de la app (`COMUNICADOS_MAIL_*`).
- Certificado laboral: `cert_jefe_nombre`, `cert_jefe_cargo` (obligatorios; por defecto "Jefe Departamento Gestión Humana") y
  `cert_firma_png` (PNG opcional, máx. 5 MB, carpeta `branding`; si no se envía se conserva la actual).

## Endpoints (prefijo `api/v1`)
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/identidad` | autenticado | `{ mision, vision, valores, principios, himno_url, updatedAt }` |
| PUT | `/identidad` | admin | Actualiza los campos enviados |
| GET | `/config/branding` | **público** (`@Public()`) | Logos para el login/shell |
| PUT | `/admin/config/branding` (multipart: `light, dark, sm, auth, favicon`) | admin | Subir logos |
| GET | `/admin/config/correo-comunicados` | admin | `{ modo, testTo, prodTo }` |
| PUT | `/admin/config/correo-comunicados` | admin | Guardar |
| GET | `/admin/config/certificado-laboral` | admin | `{ jefeNombre, jefeCargo, firma }` |
| PUT | `/admin/config/certificado-laboral` (multipart: `jefeNombre, jefeCargo, firma?`) | admin | Guardar |

## Puertos y adaptadores
- `IdentidadRepository` → `TypeOrmIdentidadRepository` (`identidad_empresa`).
- `AppSettingsRepository` (`get(key, default)`, `set(key, value)`, `getMany(keys)`) → `TypeOrmAppSettingsRepository`
  sobre `AppSettingOrmEntity` de `shared`. Se exporta del módulo por si otros contextos lo necesitan.
- Transversal: `FileStorage`.

## Tablas
`identidad_empresa` (propia), `app_settings` (central). Sin migraciones nuevas.
