# 03 — CI/CD pipeline (GitHub Actions)

## Estructura de jobs

```
on: [push, pull_request]

  ┌────────┐   ┌────────────┐   ┌──────────────────┐
  │ lint   │   │ unit tests │   │ integration tests│
  └────────┘   └────────────┘   └──────────────────┘
       \             |                   /
        \            |                  /
         ▼           ▼                 ▼
              ┌─────────────┐
              │   build     │
              │ (docker)    │
              └─────────────┘
                    │
                    ▼
              ┌─────────────┐
              │ scan trivy  │
              └─────────────┘
                    │
                    ▼  (only on main)
              ┌─────────────┐
              │ deploy      │
              │ (staging)   │
              └─────────────┘
                    │
                    ▼  (manual approval)
              ┌─────────────┐
              │ deploy      │
              │ (prod)      │
              └─────────────┘
```

## Workflow file

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

env:
  PNPM_VERSION: '9'
  NODE_VERSION: '24'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm tsc --noEmit
      - name: Squawk migration linter
        run: pnpm exec squawk prisma/migrations/*/migration.sql || true   # warn-only inicialmente

  test-unit:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm test:unit -- --ci --coverage --coverageReporters=lcov
      - uses: codecov/codecov-action@v4
        with: { files: ./coverage/lcov.info, flags: unit }

  test-integration:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:17-alpine
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: test }
        ports: ['5432:5432']
        options: --health-cmd "pg_isready -U postgres" --health-interval 5s
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      REDIS_URL: redis://localhost:6379
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm prisma migrate deploy
      - run: pnpm prisma db seed
      - run: pnpm test:integration -- --ci

  test-e2e:
    runs-on: ubuntu-latest
    needs: [test-unit, test-integration]
    services:
      postgres:
        image: postgres:17-alpine
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: test }
        ports: ['5432:5432']
        options: --health-cmd "pg_isready -U postgres" --health-interval 5s
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      REDIS_URL: redis://localhost:6379
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm prisma migrate deploy
      - run: pnpm test:e2e -- --runInBand

  audit:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --prod --audit-level high
      - name: Snyk scan
        uses: snyk/actions/node@master
        env: { SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }} }

  build:
    runs-on: ubuntu-latest
    needs: [test-unit, test-integration, audit]
    permissions: { contents: read, packages: write }
    outputs:
      image: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=sha,format=short
            type=ref,event=branch
            type=ref,event=tag
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  scan:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ needs.build.outputs.image }}
          severity: 'CRITICAL,HIGH'
          exit-code: 1
          ignore-unfixed: true

  deploy-staging:
    runs-on: ubuntu-latest
    needs: scan
    if: github.ref == 'refs/heads/main'
    environment: staging
    steps:
      - run: ./scripts/deploy.sh staging ${{ needs.build.outputs.image }}

  deploy-prod:
    runs-on: ubuntu-latest
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    environment: production       # requiere manual approval (configurado en GitHub)
    steps:
      - run: ./scripts/deploy.sh production ${{ needs.build.outputs.image }}
```

## Reglas

- **Branch protection** en `main`: PRs require `lint`, `test-unit`, `test-integration`, `audit` passing.
- **Required reviewers**: 1 mínimo, 2 si toca `prisma/migrations/`.
- **Conventional Commits** validado por commitlint en CI.
- **Codecov** bloquea PRs con coverage drop > 1%.

## Performance budget

- Total CI run < 8 min (lint+unit+integration en paralelo).
- E2E < 5 min adicionales.
- Build + scan < 5 min.

Si excede, optimize: split test suites, cache better, parallelize.

## Renovate / Dependabot

```yaml
# .github/renovate.json
{
  'extends': ['config:recommended'],
  'automerge': true,
  'automergeType': 'branch',
  'automergeStrategy': 'squash',
  'prCreation': 'immediate',
  'packageRules':
    [
      { 'matchUpdateTypes': ['major'], 'automerge': false },
      { 'matchPackageNames': ['@prisma/client', 'prisma'], 'groupName': 'prisma' },
      { 'matchPackageNames': ['@nestjs/*'], 'groupName': 'nestjs' },
    ],
}
```

## Deployment script

`scripts/deploy.sh`:

1. Set kubectl context o equivalente.
2. Run `kubectl apply -f k8s/migrate-job.yaml` (corre `prisma migrate deploy`).
3. Wait for migration job success.
4. `kubectl set image deployment/api api=<new image>`.
5. Wait for rollout.
6. Smoke test (`curl /health/ready`).
7. Notify Slack.

## Rollback

```sh
kubectl rollout undo deployment/api -n prod
```

Si la migration introdujo schema incompatible: ver [`database/03-rollback-runbook.md`](../database/03-rollback-runbook.md).
