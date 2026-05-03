Feature: Health checks
  As the platform (k8s, load balancer, monitoring)
  I want distinct liveness and readiness probes
  So that I can route traffic correctly and restart unhealthy pods

  Background:
    Given the API is running

  Scenario: Liveness reports 200 as long as the process responds
    When I GET "/api/health/live"
    Then the response status is 200
    And the body contains "status": "ok"
    And the check does NOT touch DB nor Redis

  Scenario: Readiness reports 503 when DB is unreachable
    Given the database is unreachable
    When I GET "/api/health/ready"
    Then the response status is 503
    And the body reports db.ok=false and explains the cause

  Scenario: Readiness reports 503 when Redis is unreachable but Redis is required
    Given Redis is unreachable
    And REDIS_REQUIRED=true
    When I GET "/api/health/ready"
    Then the response status is 503
    And the body reports redis.ok=false

  Scenario: Readiness reports release metadata
    When I GET "/api/health/ready"
    Then the body contains:
      | version    | semver string         |
      | commit     | git short SHA         |
      | uptimeSec  | non-negative number   |
      | startedAt  | ISO timestamp         |
