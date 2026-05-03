Feature: Update own profile
  As a logged-in user
  I want to update my profile fields
  So that my information stays current

  Background:
    Given the API is running
    And user "alice@example.com" is logged in

  Scenario: User updates their own name
    When alice PATCHes "/api/users/me" with body:
      | name | Alice Updated |
    Then the response status is 200
    And alice's stored name is "Alice Updated"

  Scenario: User cannot escalate their own role via update
    When alice PATCHes "/api/users/me" with body:
      | name  | Alice Hacker  |
      | roles | ["superadmin"] |
    Then the response status is 400
    And the error references "roles" as a non-whitelisted field

  Scenario: User cannot update someone else via "/users/me"
    When alice PATCHes "/api/users/me" with body { id: "<bob-id>", name: "pwned" }
    Then the changes apply ONLY to alice (id is ignored)
    And bob's record is unchanged

  Scenario: Email change requires re-verification
    When alice PATCHes "/api/users/me" with body:
      | email | alice2@example.com |
    Then the response status is 200
    And alice's "emailVerifiedAt" is set to NULL
    And a verification email is sent to "alice2@example.com"
    And alice's active sessions are NOT invalidated
    And alice's login is blocked until re-verification (per login.feature)
