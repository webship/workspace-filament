Feature: The panel answers and its accounts work
  As the owner of the app
  I want the panel's login page, its dashboard and each default account to work
  So that a build that came out broken is caught before anything else is tested

  # Placed by the workspace's testing setup as a starting point: it is yours to change.
  # The accounts are the default ones (cmd-tools-add-users.sh <project> filament); a scenario logs in by
  # a handle of the users registry in cucumber.js, so no password is written here.

  @critical
  Scenario: A visitor is sent to the login form of the panel
    Given I am an anonymous user
    When I go to "__PANEL_PATH__"
    Then I should see the login form

  @critical
  Scenario: The administrator logs in, and the panel names it
    Given I am a logged in user with the "administrator" user
    Then I should be logged in as "administrator"
    And the user menu should offer "Sign out"

  @js-off
  Scenario: The panel refuses the account whose address is not verified
    Given I am an anonymous user
    When I go to "__LOGIN_PATH__"
    And I fill in "Email address" with the email of "unverified"
    And I fill in "Password" with the password of "unverified"
    And I press "Sign in"
    Then the "Email address" field should have the error "These credentials do not match our records."

  Scenario: The health route answers that the app is up
    Given I am an anonymous user
    When I go to "/up"
    Then the response status code should be 200
