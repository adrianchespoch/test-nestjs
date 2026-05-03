# 03 — Migration rollback runbook

Procedimiento ante una migration que falla en producción o que después de aplicada introduce un bug.

## Triage inicial (primeros 5 minutos)

1. **¿La migration completó?** Revisa `_prisma_migrations` table:

   ```sql
   SELECT migration_name, started_at, finished_at, rolled_back_at, logs
     FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 5;
   ```

   - `finished_at IS NOT NULL` y `rolled_back_at IS NULL` → completó OK.
   - `finished_at IS NULL` → falló a mitad (parcial).
   - `rolled_back_at IS NOT NULL` → ya marcada rolled-back.

2. **¿La app funciona?** Revisa `/health/ready` + métricas `5xx_rate`.

3. **¿Está el equipo en canal de incidente?** Abrir bridge.

4. **Decide**: rollback o roll-forward.
   - **Rollback** si el problema es la migration (datos corruptos, schema malo).
   - **Roll-forward** si la migration está OK pero el código de la app tiene bug — revertir el deploy del app, **no** la DB.

## Caso A — Migration completó, app está rota porque depende de schema viejo

**Acción**: revertir el **deploy de la app**, no la DB. La migration expandió, app vieja sigue funcionando.

```sh
kubectl rollout undo deployment/api -n prod
```

Si la migration es expand-style (backward compatible), esto es seguro.

## Caso B — Migration completó pero introdujo bug en datos / schema

**Acción**: aplicar `down.sql` después de revertir app.

```sh
# 1. Revertir app primero (asume que la versión anterior es compatible con schema viejo)
kubectl rollout undo deployment/api -n prod

# 2. Marcar la migration como rolled-back en Prisma
pnpm prisma migrate resolve --rolled-back <migration_name>

# 3. Ejecutar down.sql
pnpm prisma db execute --file prisma/migrations/<timestamp>_<name>/down.sql

# 4. Verificar schema
psql $DATABASE_URL -c '\d "User"'
```

⚠️ Si la migration ya fue Contract (drop column/table), **no se puede rollback con down.sql** salvo restore de backup. Ver Caso D.

## Caso C — Migration falló a mitad (status `failed`)

**Acción**:

```sh
# 1. Revisar logs en _prisma_migrations.logs
SELECT logs FROM "_prisma_migrations" WHERE migration_name='<name>';

# 2. Decidir: completar manualmente o rollback
# Si completable manualmente:
psql $DATABASE_URL -f /tmp/finish_migration.sql
pnpm prisma migrate resolve --applied <migration_name>

# Si rollback:
pnpm prisma db execute --file prisma/migrations/<timestamp>_<name>/down.sql
pnpm prisma migrate resolve --rolled-back <migration_name>
```

## Caso D — Datos perdidos por DROP

**Acción**: restore desde backup point-in-time.

1. Estimar ventana de daño: `<migration finished_at>` a `<ahora>`.
2. Coordinar con DBA / cloud provider:
   - **AWS RDS**: PITR a un nuevo cluster, dump tablas afectadas, restore selectivo.
   - **Google Cloud SQL**: similar.
   - **Self-hosted**: WAL replay desde último base backup.
3. Re-aplicar mutations que ocurrieron en la ventana (si hay outbox/audit log que las preserve).

## Comandos clave

```sh
# Ver historial
pnpm prisma migrate status

# Marcar como aplicada (sin ejecutar SQL)
pnpm prisma migrate resolve --applied <migration_name>

# Marcar como rolled-back
pnpm prisma migrate resolve --rolled-back <migration_name>

# Ejecutar SQL custom (out of migration system)
pnpm prisma db execute --file path/to.sql --schema prisma/schema.prisma

# Diff dos schemas (útil para generar down)
pnpm prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource $DATABASE_URL \
  --script
```

## Comunicación

Durante incidente:

- Canal: `#incident-<date>`.
- Status page: actualizar cada 15 min.
- Post-mortem: dentro de 5 días hábiles, formato blameless, acciones con due date.

## Checklist post-incidente

- [ ] Issue creado para fix permanente.
- [ ] Tests agregados que reproducen el escenario.
- [ ] `down.sql` revisado para futuras migrations similares.
- [ ] Runbook actualizado con lo aprendido.
- [ ] Pre-deploy checks ajustados (ej. agregar squawk rule).

## Pre-flight checklist (antes de cada migration en prod)

- [ ] Migration ensayada en staging con data-set similar a prod.
- [ ] `down.sql` ensayado.
- [ ] Estimación de duración (basada en tamaño de tabla afectada).
- [ ] Maintenance window agendado si afecta endpoints críticos.
- [ ] DBA on call disponible.
- [ ] Roll-forward plan + roll-back plan documentados.
- [ ] Backup PITR habilitado y reciente.
