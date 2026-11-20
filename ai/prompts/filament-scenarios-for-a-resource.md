Write and run the webship-js scenarios of one resource of a Filament admin panel: its list, its form and its actions.

The launch command below is for Claude Code, the default; the text between the triple quotes can be given to another AI CLI as it is.

```
claude --permission-mode bypassPermissions """
Write the scenarios of the <resource> resource of the admin panel of this app, and run them
# ~/workspace/<folder>/<app> · https://<app>.ddev.site · container-based (DDEV by default)
# the phrases are in the filament-scenarios skill; the filament-tester agent is the one to hand this work over to
# look at the panel first: in the Playwright MCP browser, in a tab of your own, open the list, the form and the actions of the resource by hand once before writing a scenario
# a feature to write or a run to read: the book Automated Functional Testing Recipes first (its README.md, then the matching chapter), from .claude/automated-functional-testing-recipes/ in the project, ~/.claude/automated-functional-testing-recipes/ or https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes

The resource: <the name of its list in the sidebar, as "Products">.
Cover: its list (a search, a sorting, a filter and its indicator, the columns, the pages),
its form (each kind of field it has, a refusal of a required field, a save), and its actions (a row action, a bulk action with its confirmation).

Read the installed steps first:
grep -hE '^(Given|When|Then)\(' node_modules/@webship-js/filament-steps/tests/step-definitions/*.steps.js

Write one feature in tests/features/<resource>.feature, from phrases that exist.
Log in by the handle of the users registry (administrator):
no password in the feature, no account created by a scenario, no platform name in a step phrase.
What a scenario makes, it deletes (Given there is no "<record>" in the "<list>" list removes a leftover first); put back a sorting, a filter or a choice of columns a scenario changed.

Then, from the sites folder (cd ..):
bash cmd-tools-testing.sh <app> --dry-run --path tests/features/<resource>.feature
bash cmd-tools-testing.sh <app> --run --path tests/features/<resource>.feature

A failing scenario is a result: tell me what the panel did, do not loosen the scenario.
When you are done: the scenarios, the result of the run, and any step you could not find in the packs
"""
```
