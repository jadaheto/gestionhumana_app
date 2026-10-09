# Arquitectura del backend (NestJS + arquitectura hexagonal)

Este documento define **cómo está organizado el código y las reglas que todo módulo debe cumplir**.
Los módulos `auth` y `organizacion` son la implementación de referencia: copia su estructura.

## 1. Capas

```
src/
├── config/                     # Carga y validación de variables de entorno (Joi)
├── shared/                     # Núcleo compartido (sin lógica de negocio concreta)
│   ├── domain/                 # DomainError y subclases, Actor, UserRole, Page
│   ├── application/            # UseCase<I,O> y PUERTOS transversales (Clock, Mailer, FileStorage, PasswordHasher, TokenGenerator)
│   ├── infrastructure/
│   │   ├── adapters/           # Implementaciones de los puertos (bcrypt, nodemailer, disco local, reloj del sistema)
│   │   ├── http/               # Guards (JWT, Roles), decoradores (@Public, @Roles, @CurrentUser), DomainExceptionFilter
│   │   ├── persistence/        # typeorm.config, migraciones, entidades ORM de tablas CENTRALES (users, sedes, areas, cargos, app_settings)
│   │   └── shared.module.ts    # Módulo @Global que provee los puertos transversales
│   └── testing/                # Fakes de puertos, actores de prueba, createTestApp()
└── modules/<contexto>/         # Un módulo Nest por bounded context
    ├── domain/                 # Entidades/agregados, value objects, reglas de negocio, PUERTOS (repositorios abstractos)
    ├── application/            # Casos de uso (@Injectable), DTOs de entrada/salida (interfaces TS), puertos de aplicación
    ├── infrastructure/
    │   ├── http/               # Controladores Nest + DTOs class-validator/swagger
    │   ├── persistence/        # Entidades ORM propias del módulo (*.orm-entity.ts), mappers, repositorios TypeORM
    │   └── (otros adaptadores) # p. ej. generadores PDF, parsers, clientes externos
    └── <contexto>.module.ts    # Wiring: { provide: PuertoAbstracto, useClass: AdaptadorConcreto }
```

### Regla de dependencias
- `domain` **no importa nada** de Nest, TypeORM, Express ni de otras capas. Sólo TypeScript puro y `shared/domain`.
- `application` importa `domain`, `shared/application` y `shared/domain`. Puede usar `@Injectable()` de Nest (único acoplamiento aceptado) y `ConfigService` cuando necesita configuración.
- `infrastructure` importa todo lo anterior y los frameworks. Es la única capa que conoce TypeORM, Express, multer, pdfkit…
- Un módulo **no importa clases de otro módulo**. Si necesita datos de otro contexto, declara un **puerto** en su `domain` (p. ej. `ActiveContractChecker` en `auth`) y lo implementa en su `infrastructure` (consulta SQL directa o inyección del repositorio exportado por el otro módulo).

## 2. Puertos y adaptadores
- Los puertos son **clases abstractas** (no interfaces) para poder usarse como token de inyección sin `@Inject('STRING')`.
- Cada caso de uso recibe sus puertos por constructor. Los tests unitarios los sustituyen por fakes en memoria (ver `__tests__/in-memory-*.repositories.ts`).
- Puertos transversales disponibles en cualquier módulo (SharedModule es global): `Clock`, `PasswordHasher`, `Mailer`, `FileStorage`, `TokenGenerator`.

## 3. Errores
Lanza errores de `shared/domain/domain-error.ts` desde dominio/aplicación; el filtro global los traduce:

| Error                   | HTTP | Uso                                                    |
|-------------------------|------|--------------------------------------------------------|
| `NotFoundError`         | 404  | Registro inexistente                                   |
| `ValidationError`       | 400  | Datos inválidos según reglas de negocio                |
| `InvalidOperationError` | 422  | Estado no permite la operación (p. ej. ya aprobado)    |
| `ConflictError`         | 409  | Duplicados (cédula, username, correo)                  |
| `ForbiddenError`        | 403  | El actor no puede realizar la acción                   |
| `UnauthorizedError`     | 401  | Credenciales inválidas                                 |

Cuerpo de respuesta uniforme: `{ statusCode, code, message }`. La validación de DTOs (class-validator) responde 400 con `message: string[]`.

## 4. Seguridad
- `JwtAuthGuard` es global: todo endpoint exige `Authorization: Bearer <jwt>` salvo `@Public()`.
- `@Roles('admin')` restringe por rol (`RolesGuard` global). Roles: `admin`, `funcionario`.
- `@CurrentUser()` inyecta el `Actor` (`{ id, username, role, firstName, lastName, email }`). Los casos de uso reciben el `Actor` como parte de su input cuando la regla depende de quién ejecuta (p. ej. "un funcionario sólo ve sus propios contratos").
- Nunca confíes en `userId` del cuerpo para operaciones del propio usuario: usa `actor.id`. El admin sí puede actuar sobre otros usuarios.

## 5. Persistencia
- PostgreSQL con TypeORM, `synchronize: false`. El esquema se gestiona con migraciones en `shared/infrastructure/persistence/migrations/`.
- La migración `BaselineSchema` ejecuta `database/001_schema_base.sql` (esquema heredado) y `002_schema_runtime.sql` (DDL que el legado creaba en caliente). **Cualquier cambio de esquema nuevo** va en una migración TypeORM nueva (`<timestamp>-<Nombre>.ts`).
- Entidades ORM: `snake_case` igual que las columnas reales; se mapean a entidades de dominio en `camelCase` mediante mappers. Las tablas centrales (`users`, `sedes`, `areas`, `cargos`, `app_settings`) viven en `shared/infrastructure/persistence/orm/` y pueden ser usadas por cualquier módulo en su capa de infraestructura. Las demás tablas pertenecen al módulo que las gestiona.
- Consultas complejas (joins, agregaciones): usa `QueryBuilder` o SQL parametrizado (`dataSource.query(sql, [params])`). Nunca concatenes entrada del usuario en SQL.
- Fechas `DATE` se manejan como `string` `YYYY-MM-DD` de extremo a extremo (evita desfases de zona horaria).

## 6. Archivos subidos
- Usa `FileInterceptor`/`FilesInterceptor` de Nest (multer en memoria) en el controlador y pasa el `Buffer` al caso de uso, que lo guarda mediante el puerto `FileStorage` (`save(buffer, { folder, originalName, mimeType, allowedExtensions, maxBytes })`).
- Carpetas (mismas que el legado, para reutilizar los archivos existentes): `profile`, `branding`, `comunicados`, `nomina`, `soportes`, `incapacidades`, `certificados`, `contratos`.
- Se sirven en `GET /uploads/<ruta relativa>`.

## 7. HTTP y documentación
- Prefijo global `api/v1`. Rutas en **kebab-case** y en español, agrupadas por recurso: `GET /contratos`, `POST /contratos/:id/prorrogas`, `GET /mi-puesto/desprendibles`.
- Todo controlador lleva `@ApiTags`, `@ApiBearerAuth` y `@ApiOperation({ summary })`; los DTOs llevan `@ApiProperty`. Swagger en `/api/v1/docs`.
- DTOs de petición: clases con class-validator en `infrastructure/http/dto/`. DTOs de respuesta: interfaces en `application/dto/` (lo que devuelven los casos de uso) — el controlador los devuelve tal cual.
- Listados devuelven arrays; cuando se requiera paginación, usa `Page<T>` de `shared/domain/pagination.ts` con query `?page=1&size=20`.

## 8. Tests
- **Unitarios** (`src/**/__tests__/*.spec.ts` o `*.spec.ts` junto al archivo): casos de uso con repositorios en memoria y fakes de `shared/testing`. Deben cubrir las reglas de negocio (caminos felices y errores).
- **De controlador**: `createTestApp({ controllers, providers, actor })` de `shared/testing` + `supertest`. Verifican rutas, validación, códigos HTTP y control de roles con los casos de uso mockeados.
- **E2E** (`test/*.e2e-spec.ts`): contra PostgreSQL real (variables `.env`), ejecutados con `npm run test:e2e`.
- Comandos: `npm test`, `npm run test:cov`, `npm run test:e2e`.

## 9. Checklist para un módulo nuevo
1. `domain/`: entidades con factorías `create()` que validan invariantes; puertos de repositorio.
2. `application/`: un caso de uso por operación (`<Verbo><Entidad>UseCase` con `execute(input)`), DTOs.
3. `infrastructure/persistence/`: `*.orm-entity.ts`, mapper, `typeorm-*.repository.ts`.
4. `infrastructure/http/`: controlador + DTOs con validación y Swagger.
5. `<contexto>.module.ts` con el wiring puerto → adaptador; registrar en `app.module.ts`.
6. Tests unitarios + de controlador.
7. `docs/modules/<contexto>.md`: propósito, reglas de negocio, endpoints, tablas.
