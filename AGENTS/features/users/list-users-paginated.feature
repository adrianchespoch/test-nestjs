Feature: List users with cursor pagination
  As an admin
  I want to list users efficiently
  So that I can browse large datasets without performance penalty

  Background:
    Given the API is running
    And admin "root@example.com" holds "read:User"
    And there are 1000 users seeded with sequential createdAt timestamps

  Scenario: First page returns N items and a nextCursor
    When admin GETs "/api/users?limit=20"
    Then the response status is 200
    And the response body contains:
      | items      | array of 20 |
      | nextCursor | non-empty   |
      | hasMore    | true        |

  Scenario: Cursor advances correctly
    Given the previous page returned nextCursor "C1"
    When admin GETs "/api/users?limit=20&cursor=C1"
    Then the response items are the next 20 by createdAt
    And no item from the previous page appears

  Scenario: Last page reports hasMore=false and no nextCursor
    When admin paginates to the last page
    Then the response body has "hasMore": false
    And "nextCursor" is null or absent

  Scenario: Listing is filtered by ability (CASL)
    Given user "alice@example.com" has "read:User" only with condition { id: "$user.id" }
    When alice GETs "/api/users?limit=20"
    Then the response contains exactly 1 item (alice herself)
    And the SQL executed includes WHERE id = alice.id
