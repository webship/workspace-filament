Feature: The session and the sidebar of the panel
  On the panel's demo app built by the Webship Workspace (cmd-filament-project.sh <name> --install
  --add-users --demo): its admin panel is at the root of the app, its login page at /login.

  Scenario: The administrator logs in and finds the pages of the panel in its sidebar
    Given I am a logged in user with the "administrator" user
    Then I should be logged in as "administrator"
    And the sidebar should list "Products"
    And the sidebar should list "Employees"
    When I open "Products" from the sidebar
    Then I should be on the "Products" list
    And the breadcrumbs should read "Products › List"
    And the sidebar should show "Products" as the current page

  @js-off
  Scenario: The panel refuses the account whose address is not verified
    Given I am an anonymous user
    When I go to "/login"
    And I fill in "Email address" with the email of "unverified"
    And I fill in "Password" with the password of "unverified"
    And I press "Sign in"
    Then the "Email address" field should have the error "These credentials do not match our records."
