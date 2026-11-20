Feature: The fields of a form
  On the panel's demo app built by the Webship Workspace (--demo). Nothing here is saved.

  Background:
    Given I am a logged in user with the "administrator" user

  Scenario: A required field left empty keeps the form from being sent
    Given I am on the "Tasks" list
    When I create a new record from the list
    And I create the record
    Then the "Title" field should block submission as required
    And the page heading should be "Create Task"

  Scenario: The fields a form shows as another field changes, on its tabs
    Given I am on the "Employees" list
    When I create a new record from the list
    Then the "Personal" tab should be open
    When I open the "Employment" tab
    And I set "Employment type" to "Contractor"
    Then the form should show the field "Hourly rate"
    And the form should not show the field "Salary"
    When I set "Employment type" to "Full Time"
    Then the form should show the field "Salary"
