Feature: OAuth2 login via GitHub
  As a visitor
  I want to log in with my GitHub account
  So that I avoid creating yet another password

  Background:
    Given the API is running
    And GitHub OAuth client is configured with valid credentials
    And the redirect URI is "https://api.example.com/api/auth/github/callback"
    And the requested scope is "user:email"

  Scenario: First-time login via GitHub creates a User and an account_provider link
    Given no user exists with email "alice@users.noreply.github.com"
    When the user completes the GitHub OAuth flow returning email "alice@users.noreply.github.com"
    Then a new User is created with email "alice@users.noreply.github.com" and emailVerifiedAt=now
    And an account_provider row is created:
      | provider          | github       |
      | providerAccountId | <github id>  |
    And the response sets the "refresh" cookie and returns an "accessToken"

  Scenario: GitHub user without a public email triggers email-fetch endpoint
    Given GitHub returns no primary email in the user payload
    When the OAuth callback runs
    Then the adapter calls "GET https://api.github.com/user/emails" with the access token
    And uses the primary verified email
    And rejects the flow if no verified email is found

  Scenario: GitHub OAuth with an email that already exists prompts account linking
    Given a user exists with email "alice@example.com" registered via password
    When an unauthenticated visitor completes GitHub OAuth returning email "alice@example.com"
    Then the response status is 409
    And the error code is "ACCOUNT_LINK_REQUIRED"

  Scenario: State parameter mismatch is rejected (CSRF protection)
    When the OAuth callback arrives with a "state" that does NOT match what was issued
    Then the response status is 400
    And the error code is "OAUTH_STATE_MISMATCH"
