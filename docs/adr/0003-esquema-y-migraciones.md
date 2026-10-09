# ADR 0003 — Conservar el esquema PostgreSQL y gobernarlo con migraciones TypeORM

**Estado:** aceptado · **Fecha:** 2026-10-08

## Contexto
La base de datos existente contiene datos de producción y el legado creaba tablas "en caliente" (`ensure_*`). Se quiere migrar sin transformar datos.

## Decisión
Se conserva el esquema tal cual (nombres `snake_case`), consolidado en `database/001_schema_base.sql` + `002_schema_runtime.sql` y aplicado por la migración `BaselineSchema`. `synchronize` queda desactivado; todo cambio futuro es una migración versionada. Para bases existentes se usa `npm run migration:baseline`. Los hashes bcrypt `$2y$` de PHP se validan con `bcryptjs`, así que los usuarios conservan sus contraseñas.

## Consecuencias
+ Migración de datos trivial (misma BD); rollback posible al legado durante la transición.
− Las entidades ORM usan nombres en `snake_case`; los mappers traducen a dominio.
