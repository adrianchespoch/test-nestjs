Feature: Rollback procedure for a failed migration
  As the on-call engineer
  I want a rehearsed runbook for failed migrations
  So that I can recover production without improvising

  Background:
    Given a migration "20260601_add_audit_table" was started in production
    And the migration failed mid-way (some DDL applied, some not)
    And "prisma migrate status" reports the migration as "failed"
    And a corresponding "down.sql" exists in "prisma/migrations/20260601_add_audit_table/"

  Scenario: Mark the failed migration as rolled-back
    When the on-call runs "prisma migrate resolve --rolled-back 20260601_add_audit_table"
    Then the migration record is marked as rolled-back in the "_prisma_migrations" table
    And subsequent "prisma migrate deploy" no longer attempts to apply it

  Scenario: Apply the down migration to revert applied DDL
    Given the migration partially applied "CREATE TABLE audit_log"
    When the on-call runs "prisma db execute --file prisma/migrations/20260601_add_audit_table/down.sql"
    Then the down SQL "DROP TABLE IF EXISTS audit_log" runs
    And the database is restored to the pre-migration state
    And the down script is idempotent (safe to re-run)

  Scenario: Incident communication and verification
    Given the rollback steps above completed
    When the on-call posts the incident to the runbook channel
    Then the post includes:
      | impact      | which endpoints/users affected during failure |
      | duration    | minutes from detection to recovery            |
      | rootCause   | one-line summary                              |
      | nextSteps   | follow-up to fix root cause                   |
    And the migration is re-attempted only after the root cause is fixed in a new migration
    And smoke tests are re-run before declaring resolved
