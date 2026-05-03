# 00 — Context

## Por qué este skeleton

Cada vez que arrancamos un nuevo proyecto Node/Nest, repetimos los mismos pasos: configurar auth, definir tabla de usuarios, hashear passwords, montar JWT, decidir RBAC, escribir migraciones, setear logging y observabilidad, escribir el primer test E2E. Cada repetición introduce inconsistencias y bugs sutiles (algoritmos de hash débiles, leak de existencia de usuarios, refresh sin rotación, migraciones sin rollback, etc.).

Este skeleton es la **base estable y opinada** que elimina ese drift. Las decisiones difíciles ya están tomadas y documentadas en ADRs; los flujos críticos están escritos como reglas de negocio en Gherkin (no como ideas en una wiki).

## Problema concreto que resuelve

1. **Auth desde cero, hecha mal**: la mayoría de implementaciones omiten rotación de refresh tokens, no detectan reuse, no aplican timing-constant para login, y no tienen lockout.
2. **RBAC ad-hoc**: roles hardcoded en if/else, sin permisos granulares ni ABAC condicional.
3. **Migraciones que rompen prod**: `ALTER TABLE` con write lock, sin rollback ensayado, sin pattern expand-contract.
4. **Tests frágiles**: mocks de DB que pasan en CI y fallan en prod (problema histórico de este equipo según `CLAUDE.md` no aplica aquí, pero sí en proyectos pasados).
5. **Observabilidad como afterthought**: logs en `console.log`, sin trazas, sin correlation IDs.

## Outcomes esperados

Al terminar el skeleton, un nuevo proyecto debe poder:

- Hacer `pnpm install && pnpm migrate && pnpm dev` y tener API funcional con auth + Swagger en < 5 min.
- Tener todos los flujos críticos cubiertos por features Gherkin verificables.
- Pasar un security review básico OWASP top 10 sin cambios al código de plantilla.
- Hacer un deploy con migración expand-contract sin downtime.
- Triagear un incidente con un runbook escrito (no improvisar).

## Lo que NO es este skeleton

- **No es un framework**: es un repo plantilla. No abstrae NestJS — lo usa idiomáticamente.
- **No es un boilerplate de SaaS**: no hay billing, multi-tenancy, ni feature flags. Eso se agrega cuando se necesite.
- **No es un IDP**: si el proyecto necesita auth a escala empresa (SAML, SCIM), usar Auth0/Keycloak/Logto y borrar la sección auth local.

## Antecedentes

El repo actual (`/workspaces/python/code/FIND_JOB/01_nestjs/01_todos`) es un demo NestJS 10 + TypeORM + MySQL hecho como prueba técnica. Sirvió de exploración y se preserva como referencia de patrones (cache invalidation, exception filter para `ER_DUP_ENTRY`, etc.) pero **no es la base** sobre la que construimos el skeleton — el skeleton se reescribirá con el stack objetivo siguiendo esta documentación.
