Feature: OAuth2 login via Google
  As a visitor
  I want to log in with my Google account
  So that I avoid creating yet another password

  Background:
    Given the API is running
    And Google OAuth client is configured with valid credentials
    And the redirect URI is "https://api.example.com/api/auth/google/callback"

  Scenario: First-time login via Google creates a User and an account_provider link
    Given no user exists with email "alice@gmail.com"
    When the user completes the Google OAuth flow with email "alice@gmail.com"
    Then a new User is created with email "alice@gmail.com" and emailVerifiedAt=now
    And an account_provider row is created:
      | userId            | <new>             |
      | provider          | google            |
      | providerAccountId | <google sub>      |
    And the response sets the "refresh" cookie and returns an "accessToken"
    And no password is stored

  Scenario: Google OAuth with an email that already exists prompts account linking
    Given a user exists with email "alice@gmail.com" registered via password
    When an unauthenticated visitor completes the Google OAuth flow returning email "alice@gmail.com"
    Then the response status is 409
    And the error code is "ACCOUNT_LINK_REQUIRED"
    And no account_provider row is created automatically

  Scenario: Authenticated user can link their Google account
    Given user "alice@gmail.com" is logged in (has access token)
    When alice completes the Google OAuth flow while authenticated
    Then an account_provider row is created linking alice to her google sub
    And the response status is 200

  Scenario: User cancels in Google's consent screen
    When the OAuth callback returns with "error=access_denied"
    Then the response is a redirect to the configured "OAUTH_CANCEL_URL"
    And no User or account_provider row is created
    And the response status is NOT 500

  Scenario: State parameter mismatch is rejected (CSRF protection)
    When the OAuth callback arrives with a "state" that does NOT match what was issued
    Then the response status is 400
    And the error code is "OAUTH_STATE_MISMATCH"
    And no token is issued
