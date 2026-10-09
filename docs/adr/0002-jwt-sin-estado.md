# ADR 0002 — Autenticación JWT sin estado en lugar de sesiones PHP

**Estado:** aceptado · **Fecha:** 2026-10-08

## Contexto
El legado usa sesiones de servidor (`$this->session`) y `flashdata`. Angular es una SPA servida aparte de la API.

## Decisión
`POST /auth/login` emite un JWT (HS256, `JWT_EXPIRES_IN`) con `sub`, `username`, `role` y nombre. Un guard global exige el token salvo en endpoints `@Public()`. Los roles se verifican con `@Roles()`. Los mensajes flash pasan a ser respuestas HTTP que el frontend muestra como toasts.

## Consecuencias
+ API apta para múltiples clientes; sin estado en servidor.
− No hay revocación inmediata de tokens; se mitiga con expiraciones cortas (8 h) y, si se requiere, una lista de revocación futura.
