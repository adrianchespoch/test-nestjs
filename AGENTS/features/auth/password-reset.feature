Feature: Password reset flow
  As a user who forgot my password
  I want to request a reset link and set a new password
  So that I can regain access without exposing my old password

  Background:
    Given the API is running
    And SMTP is reachable
    And reset tokens are 32 bytes of entropy, hashed at rest, single-use, with 30-minute TTL

  Scenario: Reset request for a registered email sends an email in constant time
    Given a user exists with email "alice@example.com"
    When I POST "/api/auth/password-reset/request" with body:
      | email | alice@example.com |
    Then the response status is 200
    And the response body is empty or generic ("If the email exists, a link has been sent.")
    And an email with a reset link is sent to "alice@example.com"
    And the response time is comparable to the unknown-email case

  Scenario: Reset request for an unregistered email does NOT leak existence
    Given no user exists with email "ghost@example.com"
    When I POST "/api/auth/password-reset/request" with body:
      | email | ghost@example.com |
    Then the response status is 200
    And the response body is identical to the registered-email case
    And no email is sent

  Scenario: Reset token is single-use and expires in 30 minutes
    Given a reset token "TKN" was issued for user "alice@example.com" 31 minutes ago
    When I POST "/api/auth/password-reset/confirm" with body:
      | token       | TKN              |
      | newPassword | New-Str0ng!2026  |
    Then the response status is 400
    And the error code is "RESET_TOKEN_INVALID_OR_EXPIRED"

  Scenario: Successful reset rotates password and invalidates all sessions
    Given a valid reset token "TKN" for user "alice@example.com"
    When I POST "/api/auth/password-reset/confirm" with body:
      | token       | TKN              |
      | newPassword | New-Str0ng!2026  |
    Then the response status is 200
    And the password hash for alice is updated
    And the new hash starts with "$argon2id$"
    And all active refresh-token families for alice are revoked
    And "TKN" is marked used and CANNOT be reused
