Feature: User login with email and password
  As a registered user
  I want to log in with my credentials
  So that I receive an access token and a refresh cookie

  Background:
    Given the API is running
    And a verified user exists with email "alice@example.com" and password "Str0ng-Pass!2026"

  Scenario: Successful login emits access token and refresh cookie
    When I POST "/api/auth/login" with body:
      | email    | alice@example.com  |
      | password | Str0ng-Pass!2026    |
    Then the response status is 200
    And the response body contains an "accessToken" with TTL 15 minutes
    And the response sets a cookie "refresh" with attributes:
      | HttpOnly | true   |
      | Secure   | true   |
      | SameSite | Strict |
      | Path     | /auth  |
      | Max-Age  | 2592000 |
    And a "UserLoggedIn" event is published

  Scenario: Wrong password increments failed attempts counter
    Given the failed-attempts counter for "alice@example.com" is 0
    When I POST "/api/auth/login" with body:
      | email    | alice@example.com |
      | password | wrong-password    |
    Then the response status is 401
    And the error code is "INVALID_CREDENTIALS"
    And the failed-attempts counter for "alice@example.com" is now 1

  Scenario: Account is locked after 5 failed attempts within 10 minutes
    Given the failed-attempts counter for "alice@example.com" is 4
    When I POST "/api/auth/login" with the wrong password
    Then the response status is 403
    And the error code is "ACCOUNT_LOCKED"
    And the lockout TTL is 15 minutes
    And subsequent login attempts during the lockout return 403 even with the correct password

  Scenario: Login is rejected when email is not verified
    Given a user exists with email "newbie@example.com" but emailVerifiedAt is NULL
    When the user POSTs "/api/auth/login" with the correct password
    Then the response status is 403
    And the error code is "EMAIL_NOT_VERIFIED"

  Scenario: Login response is constant-time regardless of email existence
    Given no user exists with email "ghost@example.com"
    When I POST "/api/auth/login" with email "ghost@example.com" and any password
    And I POST "/api/auth/login" with email "alice@example.com" and a wrong password
    Then both responses take comparable time (within 50ms tolerance)
    And both responses return the same generic error code "INVALID_CREDENTIALS"

  Scenario: Login error does NOT reveal whether the email is registered
    When I POST "/api/auth/login" with body for an unregistered email
    Then the response error message is identical to the "wrong password" case
