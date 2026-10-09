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
