Feature: Refresh token rotation and theft detection
  As a logged-in user
  I want my refresh token to rotate on each use
  So that a stolen refresh token has limited damage

  Background:
    Given the API is running
    And user "alice@example.com" has logged in and holds refresh token "RT1"
    And refresh tokens belong to a "family" linked by a parentId chain

  Scenario: Using a valid refresh token issues a new pair and revokes the old
    When I POST "/api/auth/refresh" with cookie "refresh=RT1"
    Then the response status is 200
    And the response body contains a new "accessToken"
    And the response sets a NEW "refresh" cookie with token "RT2"
    And the database marks "RT1" as revoked
    And "RT2" has parentId = "RT1" and same familyId as "RT1"
    And a "RefreshTokenRotated" event is published

  Scenario: Reusing a revoked refresh token revokes the entire family
    Given "RT1" has been used to issue "RT2" (so "RT1" is revoked)
    When an attacker POSTs "/api/auth/refresh" with cookie "refresh=RT1"
    Then the response status is 401
    And the error code is "INVALID_TOKEN"
    And ALL tokens in the family of "RT1" are revoked
    And a "RefreshTokenReuseDetected" event is published with severity "high"
    And the user's active sessions tied to that family are invalidated

  Scenario: Expired refresh token returns 401 with no rotation
    Given "RT1" has expired
    When I POST "/api/auth/refresh" with cookie "refresh=RT1"
    Then the response status is 401
    And no new tokens are issued
    And no event with severity "high" is published

  Scenario: Missing or malformed refresh cookie returns 401 without details
    When I POST "/api/auth/refresh" with no cookie
    Then the response status is 401
    And the error message is generic and does NOT specify "missing cookie" vs "invalid token"

  Scenario: Logout revokes the current refresh token and any descendants
    Given "RT2" is the current active refresh token in family "F"
    When I POST "/api/auth/logout" with cookie "refresh=RT2"
    Then the response status is 204
    And "RT2" is revoked
    And any unused descendants of "RT2" are also revoked
    And the "refresh" cookie is cleared in the response
