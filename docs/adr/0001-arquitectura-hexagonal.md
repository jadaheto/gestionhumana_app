# ADR 0001 — Arquitectura hexagonal (puertos y adaptadores) sobre NestJS

**Estado:** aceptado · **Fecha:** 2026-10-08

## Contexto
El sistema legado (CodeIgniter 3, MVC) mezcla reglas de negocio, acceso a datos y presentación en controladores y modelos. Se necesita una base que permita probar las reglas de RRHH sin base de datos y cambiar infraestructura (ORM, correo, almacenamiento, PDF) sin tocar el negocio.

## Decisión
Cada bounded context es un módulo Nest con tres capas: `domain` (entidades, reglas, puertos), `application` (casos de uso), `infrastructure` (adaptadores: TypeORM, HTTP, PDF, correo). Los puertos son clases abstractas usadas como tokens de inyección. Los módulos no se importan entre sí; la integración es por puertos con SQL directo o por tablas compartidas.

## Consecuencias
+ Casos de uso testeables con repositorios en memoria; infraestructura sustituible.
+ Errores de dominio independientes de HTTP, traducidos por un filtro global.
− Más archivos por funcionalidad (mapper, ORM entity, repo, caso de uso). Se mitiga con las plantillas de `auth` y `organizacion`.
