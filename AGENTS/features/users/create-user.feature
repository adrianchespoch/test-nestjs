Feature: Create user (admin endpoint)
  As an admin
  I want to provision users without a self-registration flow
  So that I can onboard accounts manually or via integration

  Background:
    Given the API is running
    And admin "root@example.com" holds permission "create:User"

  Scenario: Admin creates a user with a temporary password
    When admin POSTs "/api/users" with body:
      | name             | New User              |
      | email            | newbie@example.com    |
      | temporaryPassword | Temp-P@ss-2026        |
      | mustChangePassword | true                |
    Then the response status is 201
    And a User is created with mustChangePassword=true
    And on first login the user is forced to set a new password
    And no email verification is required (admin-created users are assumed verified)

  Scenario: Non-admin cannot create users
    Given user "bob@example.com" has no "create:User" permission
    When bob POSTs "/api/users" with a valid body
    Then the response status is 403

  Scenario: Email collision returns 409
    Given a user exists with email "newbie@example.com"
    When admin POSTs "/api/users" with the same email
    Then the response status is 409
    And the error code is "EMAIL_ALREADY_EXISTS"
