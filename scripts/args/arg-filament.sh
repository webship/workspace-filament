#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The name of the project: its folder, its DDEV project and its host name.')
parser.add_argument('-d', '--demo',
                    action='store_true',
                    default=False,
                    help='Build the official demo app of the panel (a shop, a blog and an HR suite, with its own seed and two panels) instead of a new app with a panel.')
parser.add_argument('-k', '--starter-kit',
                    default="${site_starter_kit}",
                    choices=['livewire', 'react', 'vue'],
                    help='Without --demo: the official starter kit the new app is made from, by the builder of the Laravel plugin. Example: --starter-kit react [default %(default)s]')
parser.add_argument('-i', '--install',
                    action='store_true',
                    default=False,
                    help='Migrate the database (with --demo: and run its seed), with the workspace account as the first account of the panel.')
parser.add_argument('-a', '--add-users',
                    action='store_true',
                    default=False,
                    help='With --install, add the default accounts: the ones the test scenarios log in as.')
parser.add_argument('-p', '--production',
                    action='store_true',
                    default=False,
                    help='Run the app as a live app runs: APP_ENV=production and APP_DEBUG=false (the error pages instead of the debug page).')
parser.add_argument('-l', '--launch',
                    action='store_true',
                    default=False,
                    help='Open the panel in a browser when it is ready.')
parser.add_argument('--php-version',
                    default="8.4",
                    choices=['8.5', '8.4', '8.3'],
                    help='PHP version for the project container (the demo app needs 8.4 or later). Example: --php-version 8.5 [default %(default)s]')
ARGEOF
