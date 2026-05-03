Feature: Account lockout policy
  As the system
  I want to lock accounts after repeated failed logins
  So that brute-force attacks are throttled

  Background:
    Given the API is running
    And the lockout policy is: 5 failed attempts in 10 minutes triggers a 15-minute lockout

  Scenario: Lockout duration grows on repeated lockouts (exponential cap)
    Given user "alice@example.com" has been locked out 3 times in the past 24 hours
    When alice triggers a 4th lockout
    Then the lockout duration is at least 60 minutes
    And the cap is 24 hours

  Scenario: Admin can manually unlock a user account
    Given user "alice@example.com" is locked out
    And admin "root@example.com" holds permission "unlock:User"
    When admin POSTs "/api/admin/users/alice/unlock"
    Then the response status is 204
    And alice's lockout flag is cleared
    And alice's failed-attempts counter is reset to 0

  Scenario: Lockout does NOT block password reset (anti-DoS)
    Given user "alice@example.com" is locked out
    When I POST "/api/auth/password-reset/request" with body:
      | email | alice@example.com |
    Then the response status is 200
    And a reset email is still sent
    And a successful password reset clears the lockout
