Feature: The Filament plugin on the dashboard
  Once the plugin is activated and installed, with the Laravel plugin it needs, the sites folders
  offer the builder of an app with an admin panel, each AI folder lists the items of its kind the
  plugin ships, and the Settings page lists the plugin with its own page.

  # Settings lists every plugin that was added; the package and what the plugin ships are on its own page.
  Scenario: Settings lists the plugin, and its own page names its package and what it ships
    Given I am on "/settings"
     Then I should see "Filament"
     When I go to "/settings/plugin/filament"
     Then I should see "@webship.co/workspace-filament"
      And I should see "cmd-filament-project.sh"
      And I should see "filament-site-builder"

  # The plugin builds on the Laravel plugin: activating it with what it needs brings that one too.
  Scenario: The Laravel plugin it needs is on Settings as well
    Given I am on "/settings/plugin/laravel"
     Then I should see "@webship.co/workspace-laravel"
      And I should see "cmd-laravel-project.sh"

  Scenario: A sites folder offers the builder of an app with an admin panel next to the Laravel one
    Given I am on "/dev"
     Then "option[value='cmd-filament-project.sh']" should be attached
      And "option[value='cmd-laravel-project.sh']" should be attached

  # The AI folders are searched by name: with every plugin on, a folder lists more than one page of items.
  Scenario: The AI Agents folder lists the agents the plugin ships
    Given I am on "/ai-agents?q=filament-"
     Then I should see "filament-site-builder"
      And I should see "filament-tester"

  Scenario: The AI Skills folder lists the skill the plugin ships
    Given I am on "/ai-skills?q=filament-scenarios"
     Then I should see "filament-scenarios"

  Scenario: The AI Commands folder lists the command the plugin ships
    Given I am on "/ai-commands?q=filament-test"
     Then I should see "filament-test"

  Scenario: The AI Prompts folder lists the prompts the plugin ships
    Given I am on "/ai-prompts?q=filament-"
     Then I should see "filament-build-and-test"
      And I should see "filament-scenarios-for-a-resource"
