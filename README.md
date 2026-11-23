# Gestión Humana — Backend (NestJS, arquitectura hexagonal)

API REST del sistema de Gestión Humana Comfasucre.

- **Stack:** NestJS 11, TypeScript, PostgreSQL 16 + TypeORM (migraciones), Passport-JWT, class-validator, Swagger, nodemailer, pdfkit, exceljs, Jest + supertest.
- **Arquitectura:** puertos y adaptadores por bounded context. Ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/modules`](docs/modules) y [`docs/adr`](docs/adr).
- **Swagger:** `http://localhost:3001/api/v1/docs` (JSON en `/api/v1/docs-json`). Compodoc: `npm run docs`.

## Comandos
```bash
cp .env.example .env
npm install
npm run migration:run        # aplica migraciones (esquema base + DDL runtime del legado)
npm run migration:baseline   # SOLO si la BD ya existe (viene del legado): marca la base como aplicada
npm run start:dev            # http://localhost:3001/api/v1
npm test                     # unitarios + controladores
npm run test:e2e             # e2e contra PostgreSQL (.env)
npm run test:cov             # cobertura
npm run lint                 # eslint --fix
npm run docs                 # Compodoc
```

## Estructura
```
src/
├── config/                 variables de entorno validadas (Joi)
├── shared/                 núcleo: errores de dominio, Actor, puertos transversales y adaptadores, guards, filtro, ORM central, testing
└── modules/<contexto>/     domain / application / infrastructure / <contexto>.module.ts
database/                   SQL base heredado (001) + DDL runtime consolidado (002)
test/                       e2e
```

## Variables de entorno
Ver `.env.example`. Obligatorias: `DB_*`, `JWT_SECRET` (≥16 caracteres). SMTP opcional (si no hay host, los correos se registran en el log y se omiten).

### Asistente IA "Ask AI"

Chat para administradores (botón **Ask AI** de la barra superior) que responde preguntas sobre los datos
consultando la base con herramientas de **solo lectura**. Módulo `src/modules/asistente`.

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `DEEPSEEK_API_KEY` | *(vacía)* | Clave del proveedor. Vacía ⇒ `POST /asistente/preguntar` responde 503. |
| `DEEPSEEK_MODEL` | `deepseek-chat` | Modelo (cualquier proveedor compatible con OpenAI). |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | URL base del proveedor. |
| `DEEPSEEK_TIMEOUT_MS` | `30000` | Tiempo de espera por defecto por llamada. |

| Endpoint | Descripción |
|---|---|
| `GET /asistente/estado` | `{ ok, configurado, modelo }` |
| `POST /asistente/preguntar` | `{ pregunta, historial?, conversacion? }` → `{ ok, respuesta (Markdown), herramientas[], uso }`. 400 pregunta inválida, 429 más de 30/min, 502 si el modelo falla, 503 sin clave. |

Seguridad:

- Solo rol `admin`. El asistente **no puede escribir**: herramientas de consulta parametrizadas y `consulta_sql`
  (un único `SELECT` validado, en transacción `READ ONLY` con `statement_timeout` de 6 s y máximo 200 filas).
- Lista blanca de tablas en `domain/validador-sql.ts`. Las personas se leen por la vista `colaboradores`
  (sin contraseña ni datos de acceso); nunca por `users`. Quedan fuera cuentas bancarias, desprendibles de
  nómina, endeudamiento, familiares, chat y correo interno.
- Los datos consultados se envían al proveedor del modelo para redactar la respuesta: usa una clave de una
  cuenta autorizada por la Caja para tratar datos de personal.
- Cada pregunta se audita en `assistant_messages` (usuario, respuesta, SQL generado, herramientas, tokens).
- Requiere la migración `1795500000000-AsistenteIa` (`npm run migration:run`).

### Esquema de base de datos
- `DB_MIGRATIONS_RUN=true`: la API ejecuta las migraciones pendientes al arrancar (equivale a `npm run migration:run`). Recomendado en despliegues.
- `DB_SYNCHRONIZE=true`: `synchronize` de TypeORM, crea/altera tablas a partir de las entidades. Sólo para desarrollo; en `NODE_ENV=production` se ignora con un aviso, porque puede eliminar columnas con datos.
- Base existente del legado: `npm run migration:baseline` marca la migración base como aplicada sin ejecutarla.
