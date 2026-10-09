# Módulo `usuarios` (administración de cuentas de acceso)

Migra `controllers/AdminUsuarios.php` (métodos `index`, `crear`, `editar`, `guardar`, `reset_password`, `eliminar`)
y las vistas `admin/usuarios_lista.php`, `usuario_crear.php`, `usuario_editar.php`.

## Propósito
CRUD de usuarios del sistema (tabla `users`) por parte del administrador: datos de identidad, rol
(`admin` | `funcionario`), ubicación organizacional (sede/área/cargo), restablecimiento de contraseña y
eliminación. Las demás responsabilidades de `AdminUsuarios` (sedes/áreas/cargos, nómina, branding,
correo, certificado laboral) pertenecen a otros módulos.

## Estructura
```
usuarios/
├── domain/            Usuario (agregado con validaciones), UsuarioRepository, PuntosInicializador (puerto hacia Puntos)
├── application/       ListUsuarios, GetUsuario, CreateUsuario, UpdateUsuario, ResetPasswordUsuario, DeleteUsuario + DTOs
├── infrastructure/
│   ├── http/          UsuariosController + DTOs class-validator/Swagger
│   └── persistence/   TypeOrmUsuarioRepository (sobre UserOrmEntity de shared), TypeOrmPuntosInicializador (SQL a `puntos`)
└── usuarios.module.ts
```

## Reglas de negocio migradas
| Regla | Origen legado | Implementación |
|---|---|---|
| Sólo administradores | `__construct` (redirect si no admin) | `@Roles('admin')` en el controlador |
| Rol permitido `admin`/`funcionario`; otro valor → `funcionario` | `guardar()` (`in_array`) | DTO `@IsIn`, y `normalizeRole` en el caso de uso |
| Username/correo únicos | restricciones UNIQUE de `users` (error 500 en el legado) | `ConflictError` (409) antes de insertar; correo único también al editar |
| Contraseña temporal si no se envía, mostrada una sola vez | `generate_temp_password()` + flashdata | `TokenGenerator.temporaryPassword()`; se devuelve en `temporaryPassword` del `POST /usuarios` y nunca más |
| Crear fila en `puntos` al crear usuario | `$this->db->insert('puntos', …)` | puerto `PuntosInicializador` → `INSERT … ON CONFLICT DO NOTHING` |
| El username no se modifica al editar | campo `readonly` en `usuario_editar.php` | `UpdateUsuarioInput` no admite username |
| Restablecer: contraseña indicada ≥ 8 caracteres, o temporal generada | `reset_password()` | `ResetPasswordUsuarioUseCase` (`ValidationError` si < 8) |
| No eliminarse a sí mismo | `eliminar()` (`$id != user_id`) | `InvalidOperationError` (422) usando `actor.id` |
| Listado ordenado por nombre con sede/área/cargo | `index()` (sólo `users`; las vistas no mostraban catálogos) | `LEFT JOIN` a `sedes`, `areas`, `cargos` |

Diferencias deliberadas respecto al legado:
- La contraseña inicial indicada al crear también debe tener ≥ 8 caracteres (el legado no validaba; la vista decía "por defecto 123456" pero el controlador generaba una temporal).
- El correo se normaliza a minúsculas y se valida su formato en dominio.

## Endpoints (prefijo `api/v1`, todos con rol `admin`)
| Método | Ruta | Descripción | Respuesta |
|---|---|---|---|
| GET | `/usuarios` | Listar usuarios con nombres de sede/área/cargo | `UsuarioDto[]` |
| GET | `/usuarios/:id` | Obtener usuario | `UsuarioDto` (404 si no existe) |
| POST | `/usuarios` | Crear (`username`, `email`, `firstName`, `lastName`, `role`, `password?`, `sedeId?`, `areaId?`, `cargoId?`) | `UsuarioCreadoDto` con `temporaryPassword` (null si se indicó contraseña) |
| PUT | `/usuarios/:id` | Actualizar datos y rol | `UsuarioDto` |
| POST | `/usuarios/:id/restablecer-contrasena` | `{ newPassword? }` (≥ 8) o vacío para generar temporal | `{ temporaryPassword, message }` |
| DELETE | `/usuarios/:id` | Eliminar (422 si es el propio actor) | 204 |

## Tablas
- `users` (entidad central `UserOrmEntity` de `shared`): lectura/escritura de `username`, `email`, `password`, `first_name`, `last_name`, `role`, `sede_id`, `area_id`, `cargo_id`.
- `puntos`: inserción de la fila inicial (`user_id`, `puntos_actuales = 0`) mediante SQL parametrizado.
- Lectura de `sedes`, `areas`, `cargos` para los nombres del listado.

No requiere migraciones nuevas.

## Tests
- `application/use-cases/__tests__/usuarios.use-cases.spec.ts`: reglas de negocio con repositorio en memoria.
- `infrastructure/http/__tests__/usuarios.controller.spec.ts`: rutas, validación de DTOs, códigos HTTP y roles.
