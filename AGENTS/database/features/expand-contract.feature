Feature: Expand-contract migrations for zero-downtime schema changes
  As the platform team
  I want every schema change to follow expand-contract
  So that production deploys never block on DDL or break in-flight requests

  Background:
    Given the application runs at least 2 replicas during deploys
    And rolling deploys are the default strategy
    And the migration tool is "prisma migrate deploy"
    And manual SQL edits are allowed when Prisma generates unsafe DDL

  Scenario: Expand — add a nullable column
    Given the schema has a "users" table
    When a developer adds a new column "users.middleName" as nullable
    And generates the migration with "prisma migrate dev --name add_middle_name"
    Then the migration SQL is "ALTER TABLE users ADD COLUMN middle_name TEXT"
    And the migration is backward compatible with the previous app version
    And rolling out the new app while old replicas still run is safe

  Scenario: Migrate — backfill data idempotently
    Given the new column "middle_name" is added (Expand done)
    When a backfill script runs in batches of 1000 rows with "UPDATE users SET middle_name = ... WHERE middle_name IS NULL LIMIT 1000"
    Then the script can be re-run safely (idempotent)
    And it does NOT take a global lock
    And progress is logged with row count

  Scenario: Contract — drop the old column only after the new app is fully rolled out
    Given the new column has been backfilled and the new app version writes to BOTH old and new columns
    And the new app version has been live for at least the previous version's max-uptime window
    When a Contract migration runs to drop the old column
    Then the migration is "ALTER TABLE users DROP COLUMN old_column"
    And the migration runs in a deploy where no replica reads the old column anymore

  Scenario: Adding an index on a large table uses CONCURRENTLY (Postgres)
    When a migration adds an index on "users.email"
    Then the SQL must be "CREATE INDEX CONCURRENTLY ..."
    And it must run OUTSIDE a transaction (Prisma migration must be edited manually)
    And a CI lint warns if the migration uses plain "CREATE INDEX" on a hot table

  Scenario: Adding a NOT VALID FK then validating in a separate migration
    When a migration adds a foreign key on a populated table
    Then the SQL is "ALTER TABLE ... ADD CONSTRAINT ... NOT VALID"
    And a follow-up migration runs "ALTER TABLE ... VALIDATE CONSTRAINT ..."
    And the two are NOT bundled in a single deploy

  Scenario: Renaming a column is forbidden in a single migration
    When a developer attempts a migration that contains "ALTER COLUMN ... RENAME"
    Then a pre-commit hook rejects the migration
    And the developer is instructed to follow the 3-step expand-rename workflow:
      | step 1 | add new column                |
      | step 2 | backfill + dual-write          |
      | step 3 | drop old column                |
