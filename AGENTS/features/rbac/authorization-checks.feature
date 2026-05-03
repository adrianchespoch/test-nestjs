Feature: Runtime authorization checks
  As the API
  I want every protected route to evaluate the caller's abilities
  So that access control is consistent and audit-able

  Background:
    Given the API is running
    And user "alice@example.com" exists with role "editor" (permissions: read:Post, update:Post where ownerId=$user.id)
    And user "bob@example.com" exists with role "viewer" (permissions: read:Post)
    And admin "root@example.com" exists with role "superadmin" (permissions: manage:all)
    And there are posts:
      | id | ownerId   |
      | P1 | alice.id  |
      | P2 | bob.id    |

  Scenario: User without permission receives 403
    When bob PATCHes "/api/posts/P1" with body { title: "hacked" }
    Then the response status is 403
    And the error code is "FORBIDDEN"
    And no log entry mentions the post existence to bob

  Scenario: Owner can update their own resource (ABAC condition satisfied)
    When alice PATCHes "/api/posts/P1" with body { title: "renamed" }
    Then the response status is 200
    And post P1 has title "renamed"

  Scenario: Owner CANNOT update someone else's resource
    When alice PATCHes "/api/posts/P2" with body { title: "stolen" }
    Then the response status is 403

  Scenario: Admin can update any resource
    When root PATCHes "/api/posts/P2" with body { title: "moderated" }
    Then the response status is 200

  Scenario: Listings are filtered at query level (no leak via pagination)
    Given there are 100 posts, 10 owned by alice, 90 owned by others
    When alice GETs "/api/posts?limit=100"
    And the controller asks for "alice's editable posts"
    Then the SQL executed includes a WHERE clause filtering by alice.id
    And the response returns at most 10 posts
    And the total count returned reflects only the visible subset

  Scenario: 403 on a hidden resource does NOT reveal whether the resource exists
    Given post "P-SECRET" exists but bob has no read permission
    When bob GETs "/api/posts/P-SECRET"
    Then the response status is 404
    And the body is the same generic 404 as for nonexistent IDs
