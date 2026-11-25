# Módulo `auth` — autenticación y preferencias de interfaz

**Legado:** `controllers/Auth.php`, `models/User_model.php` (login, recuperación de contraseña, preferencias UI).

## Reglas de negocio migradas
- Login por usuario **o** correo; sólo autentica si la coincidencia es única (igual que el legado).
- Un funcionario accede únicamente si tiene un contrato `activo` vigente hoy; si no, se marca `estado_colaborador = inactivo` y se rechaza con el mensaje del legado. Si vuelve a tener contrato, se reactiva. Los `retirado` nunca acceden. Los `admin` siempre.
- Se registra cada acceso en `login_history` (dispositivo = user-agent, IP).
- Recuperación: token aleatorio de 64 hex válido 1 hora; los tokens anteriores del correo se invalidan; enlace al frontend `/auth/reset-password/:token`.
- Restablecer: token válido, contraseñas coinciden y mínimo 8 caracteres; bcrypt (compatible con `$2y$`).
- Preferencias UI: sólo se persisten las claves conocidas de layout (tema, idioma, `data-*` de Velzon).

## Endpoints (`/api/v1/auth`)
| Método | Ruta | Acceso |
|---|---|---|
| POST | `/login` | público |
| POST | `/forgot-password` | público |
| GET | `/reset-password/:token` | público (valida) |
| POST | `/reset-password` | público |
| GET | `/me` | autenticado |
| GET / PUT | `/ui-preferences` | autenticado |

## Tablas
`users` (ORM central en `shared`), `password_resets`, `login_history`, lectura de `contratos` mediante el puerto `ActiveContractChecker`.

## Modo colaborador (cambio de rol del administrador)
Un administrador puede actuar como colaborador enviando la cabecera `X-Rol-Activo: funcionario`: `JwtStrategy` construye el
`Actor` con rol `funcionario`, de modo que guards y casos de uso lo tratan como a cualquier colaborador. La cabecera sólo
permite bajar de rol (se ignora para usuarios que no son `admin`) y `GET /auth/me` sigue devolviendo el rol real.
