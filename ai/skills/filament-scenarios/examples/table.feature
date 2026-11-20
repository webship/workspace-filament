Feature: The list of the products
  On the panel's demo app built by the Webship Workspace (--demo): its products come from its own
  seed. Nothing here changes a record.

  Background:
    Given I am a logged in user with the "administrator" user
    And I am on the "Products" list

  Scenario: A search that finds nothing, and the list back
    When I search the list for "no product of the app has this name"
    Then the list should be empty
    When I clear the search of the list
    Then the list should have 10 rows

  Scenario: Sorting both ways, and the records per page
    When I sort the list by "Price" in descending order
    Then the list should be sorted by "Price" in descending order
    When I show 5 products per page
    Then the list should have 5 rows
    When I show 10 products per page
    Then the list should have 10 rows

  Scenario: A bulk action the demo refuses, with its confirmation
    When I select all products on the page
    Then the selection should read "10 records selected"
    When I run the bulk action "Delete selected"
    And I confirm the modal
    Then I should see the warning notification "Now, now, don't be cheeky, leave some records for others to play with!"
