Feature: Email verification
  As a newly registered user
  I want to verify my email
  So that I can prove ownership and unlock login

  Background:
    Given the API is running
    And SMTP is reachable
    And verification tokens are 32 bytes of entropy, hashed at rest, single-use, with 24-hour TTL

  Scenario: Valid token verifies the email
    Given a verification token "VTKN" was issued for user "alice@example.com"
    When I GET "/api/auth/email/verify?token=VTKN"
    Then the response status is 200
    And the user's "emailVerifiedAt" timestamp is set to the current time
    And "VTKN" is marked used and cannot be reused

  Scenario: Expired or already-used token is rejected
    Given a verification token "VTKN-OLD" expired 1 minute ago
    When I GET "/api/auth/email/verify?token=VTKN-OLD"
    Then the response status is 400
    And the error code is "VERIFICATION_TOKEN_INVALID"

  Scenario: Resend verification email is throttled to 1 per minute per user
    Given user "alice@example.com" requested a resend at "2026-05-02T10:00:00Z"
    When alice POSTs "/api/auth/email/verify/resend" at "2026-05-02T10:00:30Z"
    Then the response status is 429
    And the response includes a "Retry-After" header with value 30
