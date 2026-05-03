Feature: User logout
  As a logged-in user
  I want to log out
  So that my session is terminated immediately on the server

  Background:
    Given the API is running
    And user "alice@example.com" has refresh token "RT-ACTIVE" stored in cookie

  Scenario: Logout clears cookie and revokes the active refresh token
    When I POST "/api/auth/logout" with cookie "refresh=RT-ACTIVE"
    Then the response status is 204
    And "RT-ACTIVE" is marked revoked in the database
    And the response sets a "refresh" cookie with Max-Age=0 (clearing it)

  Scenario: Logout without an active session is idempotent
    When I POST "/api/auth/logout" with no cookie
    Then the response status is 204
    And no error is raised

  Scenario: Logout from all devices revokes every active family for the user
    Given user "alice@example.com" has 3 active refresh-token families: F1, F2, F3
    When I POST "/api/auth/logout-all" with a valid access token belonging to alice
    Then the response status is 204
    And all refresh tokens in F1, F2, F3 are revoked
    And every other device using alice's tokens receives 401 on the next refresh
