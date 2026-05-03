Feature: User registration with email and password
  As a visitor
  I want to register with my email and a password
  So that I can use the app

  Background:
    Given the API is running
    And the database is reachable
    And SMTP is reachable
    And rate limiting is enforced for registration

  Scenario: Successful registration with a unique email
    Given no user exists with email "alice@example.com"
    When I POST "/api/auth/register" with body:
      | name     | Alice                |
      | email    | alice@example.com    |
      | password | Str0ng-Pass!2026      |
    Then the response status is 201
    And the response body contains a "userId"
    And the response body does NOT contain a "password"
    And a "UserRegistered" domain event is published
    And a verification email is sent to "alice@example.com"

  Scenario: Rejection when email is already registered
    Given a user already exists with email "bob@example.com"
    When I POST "/api/auth/register" with body:
      | name     | Bob                  |
      | email    | bob@example.com      |
      | password | Str0ng-Pass!2026      |
    Then the response status is 409
    And the error code is "EMAIL_ALREADY_EXISTS"

  Scenario: Rejection when password does not meet policy
    When I POST "/api/auth/register" with body:
      | name     | Carol                |
      | email    | carol@example.com    |
      | password | weak                 |
    Then the response status is 400
    And the error message references "password"

  Scenario: Input is sanitized when stored
    When I POST "/api/auth/register" with body:
      | name     | <script>alert(1)</script>Mallory |
      | email    | mallory@example.com              |
      | password | Str0ng-Pass!2026                  |
    Then the response status is 201
    And the stored "name" does NOT execute as HTML when rendered
    And no XSS payload reaches downstream consumers

  Scenario: Rate limit blocks registration spam from a single IP
    Given the IP "203.0.113.10" has registered 5 accounts in the last hour
    When the IP "203.0.113.10" POSTs "/api/auth/register" with a valid body
    Then the response status is 429
    And the response includes a "Retry-After" header

  Scenario: Password is stored using argon2id
    Given a user registers with email "dave@example.com" and password "Str0ng-Pass!2026"
    When I inspect the stored password hash for "dave@example.com"
    Then the hash starts with "$argon2id$"
    And the plaintext password is NOT stored anywhere
