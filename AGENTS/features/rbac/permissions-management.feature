Feature: Permission catalog
  As the system
  I want to model permissions as (action, subject, conditions?) tuples
  So that authorization is declarative and granular

  Background:
    Given the API is running
    And the permission catalog is seeded with system actions

  Scenario: Permission tuple is the unit of authorization
    Given a permission row { action: "update", subject: "Post" } exists
    When admin assigns this permission to role "editor"
    Then any user with role "editor" can update any Post

  Scenario: Conditional permissions express ownership rules
    Given a permission row exists:
      | action     | update                       |
      | subject    | Post                         |
      | conditions | { "ownerId": "$user.id" }    |
    When this permission is the only "update:Post" granted to user alice
    Then alice can update a Post where post.ownerId equals alice.id
    And alice CANNOT update a Post where post.ownerId is someone else
    And the Prisma query for "alice's editable posts" includes "WHERE ownerId = alice.id"

  Scenario: Listing permissions requires "read:Permission"
    Given user "viewer@example.com" has no "read:Permission" right
    When viewer GETs "/api/rbac/permissions"
    Then the response status is 403
    And the body does NOT contain any permission data
