Feature: Soft-delete user
  As an admin
  I want to deactivate a user without losing referential integrity
  So that historical records remain consistent and the user can be restored if needed

  Background:
    Given the API is running
    And admin "root@example.com" holds "delete:User"
    And user "alice@example.com" exists with isActive=true and deletedAt=NULL
    And alice has 5 posts authored

  Scenario: Soft-delete sets deletedAt and revokes sessions
    When admin DELETEs "/api/users/<alice-id>"
    Then the response status is 204
    And alice's "deletedAt" is set to current timestamp
    And alice's "isActive" is false
    And all alice's refresh-token families are revoked
    And alice's posts are NOT deleted (referential integrity preserved)

  Scenario: Soft-deleted users do NOT appear in default listings
    Given alice is soft-deleted
    When admin GETs "/api/users?limit=100"
    Then the response items do NOT include alice
    When admin GETs "/api/users?limit=100&includeDeleted=true"
    Then alice appears with deletedAt populated

  Scenario: Login is blocked for soft-deleted users
    Given alice is soft-deleted
    When alice POSTs "/api/auth/login" with valid credentials
    Then the response status is 403
    And the error code is "ACCOUNT_DEACTIVATED"

  Scenario: Restore endpoint reactivates a soft-deleted user
    Given alice is soft-deleted
    When admin POSTs "/api/users/<alice-id>/restore"
    Then alice's "deletedAt" is set to NULL
    And alice's "isActive" is true
    And alice can log in again
