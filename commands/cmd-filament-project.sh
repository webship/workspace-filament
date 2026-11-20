#!/usr/bin/env bash

# workspace-name: Filament (admin panel on Laravel)

# Installed by the Filament plugin (plugins.sh --install filament); __WORKSPACE__ is the workspace it was installed into.
#
# Build a Laravel app with an admin panel in a container, at https://<name>.ddev.site: a new app made by
# the Laravel plugin's builder (the official installer and a starter kit) with the panel installed the
# documented way (its admin panel at /admin), or with --demo the panel's official demo app (its admin
# panel at the root of the app). With --install its database is migrated and the workspace account is
# the panel's first account; with --add-users it also gets the default accounts. The panel's CLI is
# Artisan, through the Laravel plugin's tool: bash cmd-tools-laravel-artisan.sh <name> --run "about".

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Set the starter kit of a new app (the Laravel plugin's builder makes it).
site_starter_kit="livewire";

# Distribution.
distribution_name="filament";
distribution_title="Filament";
distribution_webroot="public";

ARGPARSE_DESCRIPTION="Build a Laravel app with a ${distribution_title} admin panel in __WORKSPACE__"
# The args file comes with the plugin: core/scripts/plugins/filament/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/filament/args/arg-filament.sh || exit 1 ;

shift $#;

filament_build ;
