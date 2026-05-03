Feature: Role management
  As an admin
  I want to manage roles and their permissions
  So that I can grant access according to organizational policies

  Background:
    Given the API is running
    And admin user "root@example.com" holds the "superadmin" role
    And a permission catalog exists with at least: "create:Post", "read:Post", "update:Post", "delete:Post"

  Scenario: Admin creates a role with a set of permissions
    When admin POSTs "/api/rbac/roles" with body:
      | name        | editor                                |
      | description | Edits posts                           |
      | permissions | ["read:Post", "update:Post"]          |
    Then the response status is 201
    And a role "editor" is created with permissions ["read:Post", "update:Post"]

  Scenario: Cannot delete a role assigned to users (FK protection)
    Given role "editor" is assigned to 3 users
    When admin DELETEs "/api/rbac/roles/editor"
    Then the response status is 409
    And the error code is "ROLE_IN_USE"
    And the role still exists

  Scenario: The "superadmin" role cannot be modified or deleted via API
    When admin POSTs "/api/rbac/roles/superadmin/permissions" with body { permissions: [] }
    Then the response status is 403
    And the error code is "PROTECTED_ROLE"

  Scenario: Permission change invalidates the ability cache for affected users
    Given user "alice@example.com" has role "editor"
    And alice's ability cache key "rbac:ability:user:<alice-id>" is populated
    When admin PATCHes "/api/rbac/roles/editor/permissions" replacing permissions with ["read:Post"]
    Then the response status is 200
    And the cache key "rbac:ability:user:<alice-id>" is invalidated
    And the next request from alice rebuilds her abilities from DB
