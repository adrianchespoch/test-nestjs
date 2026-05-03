# 04 — Coverage policy

## Umbrales por capa

```jsonc
// jest.config.ts
{
  "coverageThreshold": {
    "global": {
      "branches": 75,
      "functions": 80,
      "lines": 80,
      "statements": 80,
    },
    "src/modules/*/domain/**/*.ts": {
      "branches": 90,
      "functions": 95,
      "lines": 95,
      "statements": 95,
    },
    "src/modules/*/application/**/*.ts": {
      "branches": 85,
      "functions": 90,
      "lines": 90,
      "statements": 90,
    },
  },
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/**/*.module.ts",
    "!src/**/*.dto.ts",
    "!src/**/index.ts",
    "!src/main.ts",
    "!src/otel.ts",
  ],
}
```

## Excluido

- **`*.module.ts`**: cableado de NestJS. La cobertura no aporta valor — si hay bug, falla en startup.
- **`*.dto.ts`**: clases con decorators. Cubiertos por validation tests indirectamente.
- **`main.ts`, `otel.ts`**: bootstrap. Imposible/ridículo testear unitariamente.
- **Migrations**: testeadas vía smoke en staging.
- **Adapters infraestructura puros** (`PrismaXxxRepository`): cubiertos por integration tests, no por unit. Coverage individual no exigible — el agregado lo trae el integration suite.

## Por qué umbrales por capa

- **Domain**: contiene reglas de negocio. Cualquier branch no testeado es una invariante sin verificar.
- **Application** (use cases): orquestación. Branches importantes (Result.Err mappings) deben cubrirse.
- **Presentation/Infrastructure**: tests E2E e integration cubren los flows reales — coverage line-by-line es ruido.

## Branch coverage importa más que line

Branch = 0/2 vs 1/2 vs 2/2. Lines cubiertas pero branches no = falso positivo: testeaste el happy path y dejaste el error path sin verificar.

## Mutation testing (opcional)

`stryker-mutator` para validar que los tests realmente atrapan cambios. Costoso (1 hora full run); correr semanalmente o pre-release, no en cada PR.

## CI enforcement

```yaml
- run: pnpm test:cov
- run: pnpm test:cov -- --ci --coverage --coverageReporters=lcov
- name: Upload to Codecov
  uses: codecov/codecov-action@v4
```

Codecov o similar bloquea PRs si:

- Coverage total baja > 1%.
- Cobertura del código nuevo del PR < 80%.

## Untested code rationale

Si código no se puede testear razonablemente (ej. fallback de fallback de un timeout específico de hardware), comentario explícito:

```ts
/* istanbul ignore next — fallback only triggers when ... */
function obscureBranch() { ... }
```

Mejor: ese código probablemente no debería existir, o si existe, va a `infrastructure/` con test E2E que lo ejercita en condiciones reales.

## Métricas de salud (no solo coverage)

- **Tiempo de suite**: < 2 min CI total.
- **Flakiness rate**: 0 tests retried en última semana.
- **Test:code ratio**: 1.5–3.0 razonable. Más alto sugiere over-testing trivial. Más bajo sugiere gaps.
- **Mutation score** (si se mide): > 70% en domain.

## Cuándo bajar umbrales

Solo en código legacy importado o en sprints donde se prioriza scope sobre rigor. **Documentado** en commit message + issue de catch-up con due date.
