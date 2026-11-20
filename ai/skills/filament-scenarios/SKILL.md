---
name: filament-scenarios
description: Write webship-js scenarios for a Filament admin panel of a Laravel app from phrases that exist — the steps of @webship-js/filament-steps by area (the sidebar and the pages, the tables, the forms and their fields, repeaters and builders, modals and slide-overs, relation managers and view pages, widgets, the global search, the notifications drawer, the theme, the tenants) and the Laravel pack's steps it brings along (the login, the toasts, the errors under a field, the mail, the error pages), the handles of the users registry, the traps found on a real panel, and three example features. Use when writing or fixing a scenario for an app with a panel, choosing a step, or checking that a phrase exists.
---

# filament-scenarios

Scenarios for a Filament admin panel, written with webship-js and two step packs:
[`@webship-js/filament-steps`](https://github.com/webship/filament-steps) (the panel) and
[`@webship-js/laravel-steps`](https://github.com/webship/laravel-steps), which the panel's pack loads
itself (the login, the toasts, the errors under a field, the mail, the framework's pages). The
installed packages are the source of truth: check a phrase there before using it
(`node_modules/@webship-js/filament-steps/tests/step-definitions/`, each step with five examples).
In a Webship Workspace, a container-based workspace (DDEV by default), `bash cmd-tools-testing.sh <app>`
sets the suite up and `bash cmd-tools-testing.sh <app> --run` runs it in the app's container.

## The accounts

The users registry of `cucumber.js` names the accounts by handle; the Webship Workspace writes them
(`bash cmd-tools-add-users.sh <app> filament`):

| Handle | What the panel does with it |
| --- | --- |
| `administrator` | lets it in (its address is verified) |
| `unverified` | refuses it at its login form ("These credentials do not match our records."); a session of it gets the 403 page |

A scenario never creates or deletes an account, and never writes a password: `When I fill in
"Password" with the password of "administrator"`.

## Phrases by area

**The session** (the Laravel pack's steps, on the panel's login page):
`Given I am a logged in user with the "administrator" user`, `When I log in as "administrator" with
the login form`, `When I log in with the email "nobody@example.com" and the password "Wrong-password-1"`,
`Then the "Email address" field should have the error "These credentials do not match our records."`,
`When I log out`, `Then I should be logged in as "administrator"`, `Then I should not be logged in`,
`Then I should see the login form`, `Then the user menu should offer "Sign out"`.

**The sidebar and the pages:** `Given I am on the "Products" list`, `When I open "Shop Dashboard"
from the sidebar`, `Then the sidebar should list "Products"`, `Then the "Orders" item of the sidebar
should show a badge`, `Then the sidebar should show "Products" as the current page`, `When I collapse
the "Shop" group of the sidebar`, `Then the page heading should be "Products"`, `Then the breadcrumbs
should read "Products › List"`, `Then I should be on the "Products" list`, `When I open "<record>"
from the list`, `When I create a new record from the list`, `When I open the "Edit" page of the
record`.

**A table:** `When I search the list for "kettle"`, `Then the list should count 3 products`, `Then
the list should have 10 rows`, `Then the list should show "<record>"`, `Then the "<record>" row
should show "<value>" in the "Brand" column`, `Then the first row of the list should be "<record>"`,
`Then the list should be empty`, `When I sort the list by "Price" in descending order`, `Then the list
should be sorted by "Price" in descending order`, `When I choose "Only deleted records" in the
"Deleted records" filter`, `Then the list should have the filter "Only deleted records"`, `When I
remove the filter "Only deleted records"`, `When I clear all filters`, `When I choose the
"Processing" tab of the list`, `When I hide the "SKU" column`, `When I go to page 2 of the list`,
`When I show 25 products per page`, `When I group the list by "Order date"`, `When I select all
products on the page`, `Then the selection should read "3 records selected"`, `When I run the bulk
action "Delete selected"`, `When I turn reordering of the list on`. A relation manager's table is
named by its heading: `Then the "Addresses" list should be empty`.

**Actions and modals:** `When I run the "Ship" action on the "<record>" row`, `Then the "<record>"
row should offer the "Process" action`, `When I run the "Edit" action of the page`, `When I run the
"New address" action of the "Addresses" list`, `Then the "Send email" modal should be open`, `Then the
"Ship" slide-over should be open`, `Then the modal should ask "Are you sure you would like to do
this?"`, `When I confirm the modal`, `When I cancel the modal`, `When I close the open modal`, `Then
no modal should be open`; and the toasts (the Laravel pack): `Then I should see the success
notification "Saved"`.

**A form:** `When I set "Status" to "New"`, `When I set these fields:`, `Then "Status" should be set
to "New"`, `Then the "Number" field should be read only`, `Then the form should show the field
"Salary"`, `When I open the "Employment" tab`, `When I go to the next step of the wizard`, `Then the
wizard should be on the "Order Items" step`, `When I add a row to "Order items"`, `When I set
"Quantity" to "2" in row 1 of "Order items"`, `When I add the "Milestone" block to "Plan"`, `Then the
rows of "Plan" should be "Milestone" and "Checkpoint"`, `When I move row 2 of "Plan" up`, `When I
remove row 1 of "Plan"`, `When I add the property "desk" with the value "B7" to "Metadata"`, `When I
upload "photo.jpg" to the "Images" field`, `Then the "Images" field should hold the file "photo.jpg"`,
`When I save the form`, `When I create the record`, `When I delete the record`, `Given there is no
"<record>" in the "Tasks" list`; and the field errors (the Laravel pack): `Then the "Title" field
should block submission as required`.

**What a page shows to be read:** `Then the stat "Revenue / Customer" should show a value`, `Then
the "Customer Growth" chart should be drawn`, `Then the page should show the widget "Flagged Orders"`,
`Then the "Title" entry should read "<value>"`.

**Around the pages:** `When I search the panel for "kettle"`, `Then the global search should find
"<record>"`, `Then the global search should find nothing`, `When I open the notifications drawer`,
`Then the notifications drawer should list "New order"`, `When I clear the notifications drawer`,
`When I switch the admin theme to "dark"`, `Then the admin theme should be "dark"`, `When I switch the
current tenant to "<team>"`, `Then the current tenant should be "<team>"`.

## Traps found on a real panel

- **Labels carry a required mark.** The form writes "Name*": name the field "Name".
- **A list that searches the server** shows its options only once something is typed: `When I set
  "Customer" to "<name>"` types the name and picks the option.
- **Some cells copy their text on a click** (an order number): `When I open "<record>" from the list`
  clicks another cell of the row.
- **The demo refuses its tables' deletions** with a warning toast, and keeps deleted orders and
  employees until "Force delete" on their edit page.
- **The dashboard keeps its filters in the session**, the tables their per-page choice: put back what
  a scenario changed.
- **The login is limited to five attempts a minute from one browser**, whatever the account: keep the
  session reuse of `cucumber.js` on, and log in through the form only where a scenario tests the form.
- **Error pages** log a failed resource in the browser console: tag their scenarios `@js-off`.

## Examples

Three features in `examples/` pass on the demo app the Webship Workspace builds
(`cmd-filament-project.sh <name> --install --add-users --demo`) and change nothing in it:
`session-and-navigation.feature`, `table.feature`, `form-and-modal.feature`.

## The book

For any automated functional testing in this work (a Gherkin feature, a step definition, choosing a
step, a test run and its failures), read the book *Automated Functional Testing Recipes* first.

- **Where.** Use the first that exists: `.claude/automated-functional-testing-recipes/` in the project,
  `~/.claude/automated-functional-testing-recipes/` (installed by webship/webship-js-ai-agent,
  webship/webship-js-skills or webship/ai-agents), or
  https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes
- **How.** Its `README.md` first, then the chapter that matches the task (one file per chapter,
  named by its subject), not the single complete file.
- **Which wins.** The installed webship-js package and the step pack are the source of truth for
  step phrasing. When they differ from the book, follow them and say so.
- **For Filament.** Start with `ch06-form-testing-recipes.md` (the fields of a form and their
  errors), `ch08-modal-dialog-testing.md` (the modals and slide-overs of the actions),
  `ch09-table-list-testing.md` (the tables of the resources) and `ch07-waiting-dynamic-content.md`
  (a panel that answers every action from the server).
