#!/usr/bin/env bash

# Filament for the Webship Workspace: build a Laravel app with an admin panel (a new app with the
# panel installed, or the panel's official demo app), add its default accounts, and wire its step
# pack into the testing setup, next to the Laravel step pack it extends.
#
# Placed by `plugins.sh --install filament` in core/scripts/plugins/filament/functions/, where
# bootstrap sources it with the core's own functions and the Laravel plugin's: this plugin needs
# @webship.co/workspace-laravel. A new app starts from that plugin's laravel_build (the official
# installer and a starter kit), and the accounts are written with its laravel_write_accounts.
# Everything runs in the project's container (DDEV by default: `ddev artisan …`, `ddev composer …`),
# never on the host. The container tool writes the database settings of the app into its .env.
#
# The panel's CLI is Artisan, through the Laravel plugin's tool:
#   bash cmd-tools-laravel-artisan.sh <app> --run "make:filament-resource Post --generate"
#
# Four names are the ones the core's tools look for:
#   set_filament_users          the default accounts                (cmd-tools-add-users.sh <project> filament)
#   add_filament_users          create them through the app         (the same tool, and --add-users of the builder)
#   cancel_filament_users       delete them                         (cmd-tools-cancel-users.sh <project> filament)
#   testing_configure_filament  the step pack in the testing stack  (cmd-tools-testing.sh <project>)
# An app with a panel is a project of the DDEV type `laravel`: the row's Users menu hands the tools the
# Laravel plugin's list. The panel's own accounts come with the builder's --add-users, with the testing
# setup, and with `cmd-tools-add-users.sh <project> filament`.

# The step pack a panel is tested with, and the release line it is required at. It brings the Laravel
# step pack along; the Laravel plugin's hook adds that one too.
readonly FILAMENT_STEPS_PACKAGE='@webship-js/filament-steps';
readonly FILAMENT_STEPS_VERSION='^2.0.0';

# The release line of the panel the builder installs, and the branch of the demo app of that line.
readonly FILAMENT_LINE='5';

# The default accounts, the ones a scenario logs in as. A panel has no roles of its own: what the
# panel decides is whether an account may use it, so that is the "role" here. Accounts are
# configuration, created once on the app; a test suite never creates or deletes one.
#   administrator  a verified address: the panel lets it in
#   unverified     no verified address: the panel refuses it (its login form, and the 403 page)
function set_filament_users() {
  users=(administrator unverified);
  local user ;
  for user in "${users[@]}" ; do
    printf -v "user_${user}_name" '%s' "${user}" ;
    printf -v "user_${user}_mail" '%s' "${user}@example.com" ;
    printf -v "user_${user}_password" '%s' 'dD.123123ddd' ;
  done
  user_administrator_role='verified' ;
  user_unverified_role='unverified' ;
}

# Is this folder an app with a panel? A Laravel project (its DDEV project type) with the panel in its
# Composer packages.
function filament_is_project() {
  local project_path="$1";
  grep -qE '^type:[[:space:]]*"?laravel"?[[:space:]]*$' "${project_path}/.ddev/config.yaml" 2>/dev/null || return 1 ;
  grep -q '"filament/filament"' "${project_path}/composer.json" 2>/dev/null ;
}

# Go to the project a tool was asked about, or say why not.
function filament_enter_project() {
  local project_path="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}";
  if [ ! -d "${project_path}" ] ; then
    echo "No project ${PROJECT_NAME} in ${WORKSPACE_ROOT}/${doc_name}." ;
    return 1 ;
  fi
  if ! filament_is_project "${project_path}" ; then
    echo "${doc_name}/${PROJECT_NAME} is not an app with a panel: a Laravel project (type: laravel) with filament/filament in its composer.json." ;
    return 1 ;
  fi
  cd "${project_path}" || return 1 ;
}

# The path of the admin panel of an app: "/" when its panel provider gives none (the demo app), else
# the one it gives ("/admin" for a new panel).
function filament_panel_path() {
  local project_path="$1" provider path ;
  provider="${project_path}/app/Providers/Filament/AdminPanelProvider.php" ;
  path="$(grep -oE "\->path\('[^']*'\)" "${provider}" 2>/dev/null | head -1 | sed -E "s/->path\('([^']*)'\)/\1/")" ;
  printf '/%s' "${path#/}" ;
}

# The changes a panel needs to run as a live app runs, as the panel's documentation describes them,
# in the project folder: the User model says which accounts the panel lets in (an address verified),
# and the panel checks it on every page (its own middleware); a new panel offers the password reset.
# Each change is marked "Webship Workspace" where it is made.
function filament_set_up_panel() {
  python3 - <<'PYEOF' || return 1
import re
path = 'app/Models/User.php'
src = open(path).read()
count = 0
if 'Webship Workspace' in src:
    # Changed by an earlier build.
    count = 1
elif 'canAccessPanel' in src:
    # The demo app lets every account in: an address verified for its admin panel.
    src, count = re.subn(r"(public function canAccessPanel\(Panel \$panel\): bool\s*\{)\s*return true;",
        r"\1\n        // Changed by the Webship Workspace: the admin panel lets in an account whose address is\n        // verified, and refuses the others.\n        return $panel->getId() !== 'admin' || $this->hasVerifiedEmail();", src, count=1)
else:
    src = src.replace("use Illuminate\\Foundation\\Auth\\User as Authenticatable;", "use Filament\\Models\\Contracts\\FilamentUser;\nuse Filament\\Panel;\nuse Illuminate\\Foundation\\Auth\\User as Authenticatable;", 1)
    src, count = re.subn(r"class User extends Authenticatable\b(?! implements)", "class User extends Authenticatable implements FilamentUser", src, count=1)
    src, n = re.subn(r"(class User extends Authenticatable implements )(?!FilamentUser)", r"\1FilamentUser, ", src, count=1) if count == 0 else (src, 0)
    count = count or n
    src = src.rstrip()
    if count and src.endswith('}'):
        src = src[:-1].rstrip() + """

    // Added by the Webship Workspace: the panel lets in an account whose address is verified, and
    // refuses the others.
    public function canAccessPanel(Panel $panel): bool
    {
        return $this->hasVerifiedEmail();
    }
}
"""
if not count:
    raise SystemExit(path + ': the User model is not one the Webship Workspace knows; add canAccessPanel by hand.')
open(path, 'w').write(src)
path = 'app/Providers/Filament/AdminPanelProvider.php'
src = open(path).read()
if 'use App\\Http\\Middleware\\Authenticate;' in src:
    src = src.replace('use App\\Http\\Middleware\\Authenticate;', "// Changed by the Webship Workspace: the panel's own middleware, which checks canAccessPanel.\nuse Filament\\Http\\Middleware\\Authenticate;")
if '->passwordReset()' not in src and "->path('admin')" in src:
    src = re.sub(r"->login\(\)", "->login()\n            // Added by the Webship Workspace.\n            ->passwordReset()", src, count=1)
open(path, 'w').write(src)
PYEOF
}

# The official demo app of the panel, at the head of the branch of its release line, as its README
# installs it, in the project folder: its packages (the panel at the newest release of the line), its
# key, its database with its own seed, its storage link and its theme.
function filament_get_demo() {
  local tmp ;
  tmp="$(mktemp -d)" ;
  git clone --quiet --depth 1 --branch "${FILAMENT_LINE}.x" https://github.com/filamentphp/demo.git "${tmp}/demo" \
    || { echo "The demo app could not be downloaded." ; rm -rf "${tmp}" ; return 1 ; } ;
  (cd "${tmp}/demo" && git log -1 --format='  the demo app at %h (%ad)' --date=short) ;
  rm -rf "${tmp}/demo/.git" ;
  cp -a "${tmp}/demo/." ./ && rm -rf "${tmp}" ;
  [ -f .env ] || cp .env.example .env ;
}

# Build an app with a panel from nothing. With --demo, the panel's official demo app; without it, a new
# app made by the Laravel plugin's builder (the official installer and a starter kit) with the panel
# installed the documented way. With --install the database is migrated and the workspace account is
# the panel's first account; with --add-users the default accounts.
function filament_build() {
  trim_project_name ;
  local base_url="https://${PROJECT_NAME}.ddev.site" ;
  local php_version="${PHP_VERSION:-${site_php_version:-8.4}}" ;
  local add_users="${ADD_USERS}" launch="${LAUNCH}" production="${PRODUCTION}" ;

  if ! declare -f laravel_build > /dev/null || ! declare -f laravel_write_accounts > /dev/null ; then
    echo "The Filament plugin builds on the Laravel plugin, which is not installed here:" ;
    echo "  bash core/scripts/plugins.sh --install laravel" ;
    exit 1 ;
  fi

  if [ "${DEMO}" == 'yes' ] ; then
    cd ${WORKSPACE_ROOT}/${doc_name} || exit 1 ;
    drop_database ;
    rm -rf "${PROJECT_NAME}" ;
    mkdir -p "${PROJECT_NAME}" ;
    cd ${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME} || exit 1 ;
    # PHP 8.4: the demo's lock file holds packages that need it.
    ddev config --project-type=laravel --docroot=public --project-name=${PROJECT_NAME} \
      --nodejs-version=$(ddev_nodejs_version) --php-version=${php_version} --auto || exit 1 ;
    filament_get_demo || exit 1 ;
    # The restart writes the database and the mail settings of the container into .env.
    ddev_up start -y || exit 1 ;
    ddev composer install --no-interaction --no-progress || { echo "composer install failed." ; exit 1 ; } ;
    ddev composer update 'filament/*' --with-dependencies --no-interaction --no-progress || exit 1 ;
    ddev artisan key:generate --ansi > /dev/null || exit 1 ;
    ddev dotenv set .env --mail-from-address=webship@example.com > /dev/null ;
    if [ "${INSTALL}" == 'yes' ] ; then
      ddev artisan migrate --force --seed --no-interaction || { echo "The migrations and the demo's seed failed." ; exit 1 ; } ;
      ddev artisan storage:link > /dev/null ;
    fi
    ddev npm ci --no-audit --no-fund || exit 1 ;
    ddev npm run build || exit 1 ;
  else
    # A new app by the Laravel plugin's builder: its accounts and its browser come after the panel.
    ADD_USERS='no' ; LAUNCH='no' ; PRODUCTION='no' ;
    PHP_VERSION="${php_version}" ;
    ( laravel_build ) || exit 1 ;
    ADD_USERS="${add_users}" ; LAUNCH="${launch}" ; PRODUCTION="${production}" ;
    cd ${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME} || exit 1 ;
    ddev composer require "filament/filament:^${FILAMENT_LINE}.0" --with-all-dependencies --no-interaction --no-progress \
      || { echo "The panel could not be required." ; exit 1 ; } ;
    ddev artisan filament:install --panels --no-interaction || { echo "The panel could not be installed." ; exit 1 ; } ;
    ddev dotenv set .env --mail-from-address=webship@example.com > /dev/null ;
    # The panel's mail (the password reset) is a queued notification, and a new app queues in its
    # database: a local app runs no queue worker, so its queue runs in the request, as the demo's does.
    ddev dotenv set .env --queue-connection=sync > /dev/null ;
  fi

  filament_set_up_panel || exit 1 ;
  ddev artisan optimize:clear > /dev/null 2>&1 ;

  if [ "${INSTALL}" == 'yes' ] ; then
    # The workspace account is the panel's first account, its address verified.
    printf '%s|%s|%s|verified\n' "${account_name}" "${account_mail}" "${account_pass}" | laravel_write_accounts save > /dev/null \
      || { echo "The workspace account could not be written." ; exit 1 ; } ;
    if [ "${ADD_USERS}" == 'yes' ] ; then
      set_filament_users ;
      add_filament_users ;
      cd ${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME} || exit 1 ;
    fi
    if [ "${PRODUCTION}" == 'yes' ] ; then
      ddev dotenv set .env --app-env=production --app-debug=false > /dev/null ;
    fi
    local panel_path ;
    panel_path="$(filament_panel_path "$(pwd)")" ;
    echo "${doc_name} ${PROJECT_NAME} has been installed: $(ddev artisan --version 2>/dev/null), panel $(ddev composer show filament/filament 2>/dev/null | awk '$1 == "versions" {print $NF}')$( [ "${DEMO}" == 'yes' ] && echo ', the demo app').";
    echo "Go to ${base_url}${panel_path%/}/login and log in as ${account_mail}";
  else
    [ "${ADD_USERS}" == 'yes' ] && echo "--add-users needs --install: there is no database to add accounts to yet." ;
    echo "${doc_name} ${PROJECT_NAME} is ready: migrate its database with bash cmd-tools-laravel-artisan.sh ${PROJECT_NAME} --run \"migrate\"";
    echo "Go to ${base_url}";
  fi

  if [ "${LAUNCH}" == 'yes' ] ; then
    ddev launch "$(filament_panel_path "$(pwd)")" ;
  fi

  cd ${WORKSPACE_ROOT}/${doc_name};
}

# Create the default accounts through the app, with the Laravel plugin's writer (the password hashed
# with the app's own hasher). An account that is already there gets its name, password and state back.
# The list is loaded by the caller (set_filament_users): the core's add_users, the builder, the testing
# setup.
function add_filament_users() {
  filament_enter_project || return 1 ;
  local user user_name user_mail user_password user_role lines="" ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name"; user_mail="user_${user}_mail";
    user_password="user_${user}_password"; user_role="user_${user}_role";

    echo " ---------------------------------------------------------------- ";
    echo "      User name: ${!user_name}";
    echo "      User mail: ${!user_mail}";
    echo "  User password: ${!user_password}";
    echo "     User state: ${!user_role:-verified}";
    echo " ================================================================= ";

    lines="${lines}${!user_name}|${!user_mail}|${!user_password}|${!user_role:-verified}"$'\n' ;
  done
  printf '%s' "${lines}" | laravel_write_accounts save ;
  cd ${WORKSPACE_ROOT}/${doc_name};
}

# Delete the default accounts.
function cancel_filament_users() {
  filament_enter_project || return 1 ;
  local user user_name user_mail lines="" ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name"; user_mail="user_${user}_mail";
    echo " ---------------------------------------------------------------- ";
    echo "      User name: ${!user_name}";
    echo " ================================================================= ";
    lines="${lines}${!user_name}|${!user_mail}||"$'\n' ;
  done
  printf '%s' "${lines}" | laravel_write_accounts delete ;
  cd ${WORKSPACE_ROOT}/${doc_name};
}

# The step pack in the testing stack of an app with a panel. The core's testing_configure calls this
# in the project folder once webship-js is scaffolded and before the dependencies are installed; for a
# project that is not one it changes nothing.
#
# The panel's pack extends the Laravel pack, and both go in the same profile. This hook runs before the
# Laravel plugin's (the core calls them in the order of their names) and writes what that one would
# write for a starter-kit app: the users registry of the panel's accounts, the panel's home and login
# page, the mailbox, the tags and a first feature for the panel; the Laravel hook then finds them there
# and adds its own pack beside this one. Every part is skipped when it is already there, so a second run
# adds what the first missed and never resets a suite.
function testing_configure_filament() {
  local project_path="$1";
  filament_is_project "${project_path}" || return 0 ;
  if [ ! -f "${project_path}/cucumber.js" ] || [ ! -f "${project_path}/package.json" ] ; then
    echo "  Filament: cucumber.js is not here yet — run the testing setup again once webship-js is scaffolded." ;
    return 1 ;
  fi

  echo "Adding the Filament step pack (${FILAMENT_STEPS_PACKAGE} ${FILAMENT_STEPS_VERSION}).";
  set_filament_users ;
  local registry="" user user_name user_mail user_password panel_path ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name"; user_mail="user_${user}_mail"; user_password="user_${user}_password";
    registry="${registry}${user}|${!user_mail}|${!user_password}|${!user_name}"$'\n' ;
  done
  panel_path="$(filament_panel_path "${project_path}")" ;

  python3 - "${project_path}" "${FILAMENT_STEPS_PACKAGE}" "${FILAMENT_STEPS_VERSION}" 'FILAMENT' "${registry}" "${panel_path}" <<'PYEOF' || return 1
import json, re, sys

project, pack, version, prefix, registry, panel = sys.argv[1:7]

# package.json: the pack as a dev dependency, at the release line this plugin was proven on.
pkg_file = project + '/package.json'
pkg = json.load(open(pkg_file))
if pack not in pkg.get('dependencies', {}) and pack not in pkg.get('devDependencies', {}):
    pkg.setdefault('devDependencies', {})[pack] = version
    open(pkg_file, 'w').write(json.dumps(pkg, indent=4) + '\n')
    print('  package.json: %s %s' % (pack, version))

cucumber_file = project + '/cucumber.js'
src = open(cucumber_file).read()
before = src

# The pack's step definitions, after webship-js's own. The pack loads the Laravel pack's itself.
if ('node_modules/%s/' % pack) not in src:
    line = "'node_modules/%s/tests/step-definitions/**/*.js'," % pack
    anchor = re.search(r"^([ \t]*)'node_modules/webship-js/tests/step-definitions/[^']*',.*$", src, re.M)
    opening = re.search(r"^([ \t]*)require:[ \t]*\[[ \t]*$", src, re.M)
    if anchor:
        src = src[:anchor.end()] + '\n' + anchor.group(1) + line + src[anchor.end():]
    elif opening:
        src = src[:opening.end()] + '\n' + opening.group(1) + '  ' + line + src[opening.end():]
    else:
        sys.exit("  cucumber.js has no require list this can add to. Add this line to it:\n    " + line)
    print('  cucumber.js: the step definitions of %s' % pack)

# The pack's assertions that must fail, and the Laravel pack's lanes, are no part of a normal run.
if not re.search(r"^[ \t]*tags:", src, re.M):
    default = re.search(r"^([ \t]*)default:[ \t]*\{[ \t]*$", src, re.M)
    if default:
        pad = default.group(1) + '  '
        src = src[:default.end()] + '\n' + pad + "// Work in progress, the assertions that must fail and the Laravel pack's lanes (@maintenance, @debug-page) stay out of a normal run.\n" \
            + pad + "tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail and not @maintenance and not @debug-page'," + src[default.end():]
        print('  cucumber.js: the tags that keep the assertions that must fail out of a normal run')

world = re.search(r"^([ \t]*)worldParameters:[ \t]*\{[ \t]*$", src, re.M)
if not world:
    sys.exit("  cucumber.js has no worldParameters block to add the users registry to.")
pad = world.group(1) + '  '
additions = []
if not re.search(r"^[ \t]*homePath:", src, re.M):
    login = (panel.rstrip('/') or '') + '/login'
    additions += [
        pad + "// The panel's home and its login page (the login steps of the Laravel pack read them).",
        pad + "homePath: '%s'," % panel,
        pad + "loginPath: '%s'," % login,
    ]
if not re.search(r"^[ \t]*mailUrl:", src, re.M):
    additions += [
        pad + "// The mailbox that catches the mail of the app (the password reset steps read it).",
        pad + "mailUrl: process.env.MAIL_URL || (process.env.LAUNCH_URL || '').replace(/\\/+$/, '') + ':8026',",
    ]
if not re.search(r"^[ \t]*users:[ \t]*\{", src, re.M):
    rows = [r.split('|') for r in registry.splitlines() if r.strip()]
    additions += [
        pad + "// The users registry: a handle a scenario reads, mapped to an account of this app (the default",
        pad + "// accounts: cmd-tools-add-users.sh <project> filament). Override one with %s_<HANDLE>_EMAIL and %s_<HANDLE>_PASSWORD." % (prefix, prefix),
        pad + "users: {",
    ]
    for handle, email, password, name in rows:
        env = '%s_%s' % (prefix, handle.upper())
        additions.append(pad + "  %s: { email: process.env.%s_EMAIL || '%s', password: process.env.%s_PASSWORD || '%s', name: '%s' }," % (handle, env, email, env, password, name))
    additions.append(pad + "},")
    print('  cucumber.js: the users registry (%s)' % ', '.join(r[0] for r in rows))
if additions:
    src = src[:world.end()] + '\n' + '\n'.join(additions) + src[world.end():]

# An app's package.json says "type": "module" (Vite's convention): cucumber.js becomes an ES module
# that exports the same default profile, and tests/ gets a package.json that keeps it CommonJS (the
# Laravel plugin's hook does the same; whichever runs first does it).
if pkg.get('type') == 'module':
    if re.search(r"^module\.exports\s*=\s*\{", src, re.M) and not re.search(r"^export default ", src, re.M):
        src = re.sub(r"^module\.exports\s*=\s*\{", "// The app's package.json says \"type\": \"module\": this file is an ES module, the profiles stay as they were.\nconst config = {", src, count=1, flags=re.M)
        src = src.rstrip() + '\n\nexport default config.default;\n'
        print('  cucumber.js: an ES module (the package.json of the app says "type": "module")')
    import os
    tests_pkg = project + '/tests/package.json'
    if not os.path.exists(tests_pkg):
        os.makedirs(project + '/tests', exist_ok=True)
        open(tests_pkg, 'w').write(json.dumps({'type': 'commonjs'}, indent=2) + '\n')
        print('  tests/package.json: the step definitions under tests/ stay CommonJS')

if src != before:
    open(cucumber_file, 'w').write(src)
PYEOF

  # A first feature for the panel, as the project's site.feature when it has none: the Laravel plugin's
  # hook then keeps it, and places no starter-kit feature in a panel's project.
  local feature="${WORKSPACE_SCRIPTS}/plugins/filament/panel.feature" login_path ;
  login_path="${panel_path%/}/login" ;
  if [ -f "${feature}" ] && [ ! -f "${project_path}/tests/features/site.feature" ] ; then
    mkdir -p "${project_path}/tests/features" \
      && sed -e "s#__PANEL_PATH__#${panel_path}#g" -e "s#__LOGIN_PATH__#${login_path}#g" "${feature}" > "${project_path}/tests/features/site.feature" \
      && echo "  tests/features/site.feature: a first feature for the panel" ;
  fi

  # The scenarios log in as the default accounts: make sure a migrated app has them.
  if ddev artisan migrate:status > /dev/null 2>&1 ; then
    ( add_filament_users > /dev/null ) && echo "  the panel's default accounts are on the app (${users[*]})" ;
  fi
}
