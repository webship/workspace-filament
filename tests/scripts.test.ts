import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const FUNCTIONS = path.join(PKG, 'scripts', 'functions', 'fun-filament.sh');

// The cucumber.js webship-js scaffolds, as far as the testing hook reads it.
const SCAFFOLD = `module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions.
      'tests/step-definitions/**/*.js',                                  // Your custom step definitions.
    ],
    paths: ['tests/features/**/*.feature'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'http://localhost:8080',
    },
  },
};
`;

// The demo app's User model and admin panel, and a new app's, as far as the builder changes them.
const DEMO_USER = `<?php
namespace App\\Models;
use Filament\\Models\\Contracts\\FilamentUser;
use Filament\\Panel;
use Illuminate\\Foundation\\Auth\\User as Authenticatable;
class User extends Authenticatable implements FilamentUser
{
    public function canAccessPanel(Panel $panel): bool
    {
        return true;
    }
}
`;
const DEMO_PANEL = `<?php
namespace App\\Providers\\Filament;
use App\\Http\\Middleware\\Authenticate;
class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel->default()->id('admin')->login(Login::class)->authMiddleware([Authenticate::class]);
    }
}
`;
const NEW_USER = `<?php
namespace App\\Models;
use Illuminate\\Foundation\\Auth\\User as Authenticatable;
class User extends Authenticatable
{
    protected $fillable = ['name', 'email', 'password'];
}
`;
const NEW_PANEL = `<?php
namespace App\\Providers\\Filament;
use Filament\\Http\\Middleware\\Authenticate;
class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel->default()->id('admin')->path('admin')->login()->authMiddleware([Authenticate::class]);
    }
}
`;

/** A project folder with the testing stack scaffolded, and the tooling folder the installer would have filled. */
function project(type: string, { panel = true, demo = true, module = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'filament-plugin-'));
  const dir = path.join(root, 'dev', 'site1');
  fs.mkdirSync(path.join(dir, '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ddev', 'config.yaml'), `name: site1\ntype: ${type}\ndocroot: public\n`);
  fs.writeFileSync(path.join(dir, 'cucumber.js'), SCAFFOLD);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'site1', ...(module ? { type: 'module' } : {}), devDependencies: { 'webship-js': '^2.0.16' } }, null, 2));
  fs.writeFileSync(path.join(dir, 'composer.json'), JSON.stringify({ require: panel ? { 'laravel/framework': '^12.0', 'filament/filament': '^5.0' } : { 'laravel/framework': '^12.0' } }, null, 2));
  fs.mkdirSync(path.join(dir, 'app', 'Models'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'app', 'Providers', 'Filament'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'app', 'Models', 'User.php'), demo ? DEMO_USER : NEW_USER);
  fs.writeFileSync(path.join(dir, 'app', 'Providers', 'Filament', 'AdminPanelProvider.php'), demo ? DEMO_PANEL : NEW_PANEL);
  const scripts = path.join(root, 'core', 'scripts');
  fs.mkdirSync(path.join(scripts, 'plugins', 'filament'), { recursive: true });
  fs.copyFileSync(path.join(PKG, 'testing', 'panel.feature'), path.join(scripts, 'plugins', 'filament', 'panel.feature'));
  return { root, dir, scripts };
}

// The Laravel plugin's functions this one calls, replaced by recorders: its builder and its account writer.
const LARAVEL = `laravel_build() { echo "laravel_build kit=\${STARTER_KIT:-} php=\${PHP_VERSION:-} add_users=\${ADD_USERS:-}" >> "\${DDEV_LOG:-/dev/null}" ; return 0 ; }
laravel_write_accounts() { echo "laravel_write_accounts $1" >> "\${DDEV_LOG:-/dev/null}" ; cat >> "\${DDEV_LOG:-/dev/null}" ; return 0 ; }`;

/** Run bash with the plugin's functions sourced, the Laravel plugin's replaced and `ddev` replaced by a recorder. */
function bash(script: string, env: Record<string, string> = {}, { laravel = true } = {}) {
  const r = spawnSync('bash', ['-c', `ddev() { echo "ddev $*" >> "\${DDEV_LOG:-/dev/null}" ; return 0 ; }\ntrim_project_name() { : ; }\ndrop_database() { : ; }\nddev_up() { ddev "$@" ; }\nddev_nodejs_version() { echo 24 ; }\n${laravel ? LARAVEL : ''}\nsource ${FUNCTIONS}\n${script}`],
    { encoding: 'utf8', env: { ...process.env, ...env } });
  return r;
}

test('the default accounts are one the panel lets in and one it refuses, with example addresses', () => {
  const r = bash('set_filament_users ; for u in "${users[@]}" ; do n="user_${u}_name" ; m="user_${u}_mail" ; p="user_${u}_password" ; l="user_${u}_role" ; echo "${!n}|${!m}|${!p}|${!l}" ; done');
  assert.strictEqual(r.status, 0, r.stderr);
  const rows = r.stdout.trim().split('\n').map((l) => l.split('|'));
  assert.deepStrictEqual(rows.map((row) => row[0]), ['administrator', 'unverified']);
  assert.deepStrictEqual(rows.map((row) => row[3]), ['verified', 'unverified']);
  for (const [name, mail, password] of rows) {
    assert.strictEqual(mail, `${name}@example.com`);
    assert.ok(password.length >= 12, 'long enough for the password rules of a live app');
  }
});

test('an app with a panel is a Laravel project with the panel in its packages; a plain Laravel app is not', () => {
  const withPanel = project('laravel');
  const plain = project('laravel', { panel: false });
  const other = project('wordpress');
  assert.strictEqual(bash(`filament_is_project ${withPanel.dir}`).status, 0);
  assert.notStrictEqual(bash(`filament_is_project ${plain.dir}`).status, 0);
  assert.notStrictEqual(bash(`filament_is_project ${other.dir}`).status, 0);
});

test('the panel is at the root of the demo app, at /admin on a new app', () => {
  assert.strictEqual(bash(`filament_panel_path ${project('laravel').dir}`).stdout, '/');
  assert.strictEqual(bash(`filament_panel_path ${project('laravel', { demo: false }).dir}`).stdout, '/admin');
});

test('the accounts are written with the Laravel plugin\'s writer, with their state, and removed with it', () => {
  const p = project('laravel');
  const log = path.join(p.root, 'ddev.log');
  const env = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log };
  let r = bash('set_filament_users ; add_filament_users', env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  let written = fs.readFileSync(log, 'utf8');
  assert.match(written, /^laravel_write_accounts save$/m);
  assert.match(written, /^administrator\|administrator@example\.com\|[^|]+\|verified$/m);
  assert.match(written, /^unverified\|unverified@example\.com\|[^|]+\|unverified$/m);
  fs.writeFileSync(log, '');
  r = bash('set_filament_users ; cancel_filament_users', env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  written = fs.readFileSync(log, 'utf8');
  assert.match(written, /^laravel_write_accounts delete$/m);
  assert.match(written, /^administrator\|administrator@example\.com\|\|$/m);
});

test('the user tools refuse a project that is not an app with a panel', () => {
  const p = project('laravel', { panel: false });
  const r = bash('set_filament_users ; add_filament_users', { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1' });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stdout, /is not an app with a panel/);
});

test('the builder says so, and stops, when the Laravel plugin is not here', () => {
  const p = project('laravel');
  const r = bash('filament_build', { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1' }, { laravel: false });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stdout, /builds on the Laravel plugin, which is not installed here/);
  assert.match(r.stdout, /plugins\.sh --install laravel/);
});

test('a new app is made by the Laravel plugin\'s builder, then the panel is installed, set up, and the accounts added', () => {
  const p = project('laravel', { demo: false });
  const log = path.join(p.root, 'ddev.log');
  const env = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log,
    INSTALL: 'yes', ADD_USERS: 'yes', DEMO: 'no', STARTER_KIT: 'react', account_name: 'webmaster', account_mail: 'webmaster@example.com', account_pass: 'a-password-1' };
  const r = bash('filament_build', env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const done = fs.readFileSync(log, 'utf8');
  assert.match(done, /laravel_build kit=react php=8\.4 add_users=no/, 'the Laravel builder makes the app, without its accounts');
  assert.match(done, /ddev composer require filament\/filament:\^5\.0 --with-all-dependencies/);
  assert.match(done, /ddev artisan filament:install --panels --no-interaction/);
  assert.match(done, /ddev dotenv set \.env --queue-connection=sync/, 'the queue runs in the request: the panel\'s mail is queued');
  assert.match(done, /webmaster\|webmaster@example\.com\|a-password-1\|verified/, 'the workspace account is the panel\'s first account');
  assert.match(done, /administrator\|administrator@example\.com\|[^|]+\|verified/);
  const user = fs.readFileSync(path.join(p.dir, 'app', 'Models', 'User.php'), 'utf8');
  assert.match(user, /class User extends Authenticatable implements FilamentUser/);
  assert.match(user, /return \$this->hasVerifiedEmail\(\);/);
  const provider = fs.readFileSync(path.join(p.dir, 'app', 'Providers', 'Filament', 'AdminPanelProvider.php'), 'utf8');
  assert.match(provider, /->login\(\)\n\s+\/\/ Added by the Webship Workspace\.\n\s+->passwordReset\(\)/);
});

test('the demo app is cloned, installed with its own seed, and its admin panel refuses an address not verified', () => {
  const p = project('laravel');
  const log = path.join(p.root, 'ddev.log');
  const env = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log,
    INSTALL: 'yes', ADD_USERS: 'no', DEMO: 'yes', account_name: 'webmaster', account_mail: 'webmaster@example.com', account_pass: 'a-password-1' };
  // The build starts from an empty folder, and the clone brings the demo's own files: here, the ones of the project.
  const demo = path.join(p.root, 'demo');
  fs.cpSync(p.dir, demo, { recursive: true });
  const r = bash(`filament_get_demo() { cp -a ${demo}/. ./ ; } ; filament_build`, env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const done = fs.readFileSync(log, 'utf8');
  assert.match(done, /ddev config --project-type=laravel --docroot=public --project-name=site1 --nodejs-version=24 --php-version=8\.4 --auto/);
  assert.match(done, /ddev composer install --no-interaction/);
  assert.match(done, /ddev composer update filament\/\* --with-dependencies/);
  assert.match(done, /ddev artisan migrate --force --seed --no-interaction/);
  assert.match(done, /ddev npm run build/);
  assert.doesNotMatch(done, /laravel_build/, 'the demo app is not made by the Laravel builder');
});

test('the panel set-up changes the demo app\'s access and middleware, once, and marks what it changed', () => {
  const p = project('laravel');
  let r = spawnSync('bash', ['-c', `source ${FUNCTIONS}\ncd ${p.dir} && filament_set_up_panel && filament_set_up_panel`], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const user = fs.readFileSync(path.join(p.dir, 'app', 'Models', 'User.php'), 'utf8');
  assert.match(user, /return \$panel->getId\(\) !== 'admin' \|\| \$this->hasVerifiedEmail\(\);/);
  assert.strictEqual((user.match(/Webship Workspace/g) || []).length, 1, 'changed once');
  const provider = fs.readFileSync(path.join(p.dir, 'app', 'Providers', 'Filament', 'AdminPanelProvider.php'), 'utf8');
  assert.match(provider, /use Filament\\Http\\Middleware\\Authenticate;/);
  assert.doesNotMatch(provider, /use App\\Http\\Middleware\\Authenticate;/);
  assert.doesNotMatch(provider, /passwordReset/, 'the demo\'s admin panel keeps its own login: its app panel has the password reset');
  r = spawnSync('bash', ['-c', `source ${FUNCTIONS}\ncd ${p.root} && filament_set_up_panel`], { encoding: 'utf8' });
  assert.notStrictEqual(r.status, 0, 'outside an app it stops');
});

test('the testing hook adds the pack, the users registry, the panel\'s pages, the mailbox, the tags and a first feature, once', () => {
  for (const demo of [true, false]) {
    const p = project('laravel', { demo });
    const env = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1' };
    let r = bash(`testing_configure_filament ${p.dir}`, env);
    assert.strictEqual(r.status, 0, r.stderr + r.stdout);
    r = bash(`testing_configure_filament ${p.dir}`, env);
    assert.strictEqual(r.status, 0, r.stderr + r.stdout);
    const pkg = JSON.parse(fs.readFileSync(path.join(p.dir, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.devDependencies['@webship-js/filament-steps'], '^2.0.0');
    const cucumber = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
    assert.strictEqual((cucumber.match(/node_modules\/@webship-js\/filament-steps\/tests\/step-definitions\/\*\*\/\*\.js/g) || []).length, 1, 'the pack once, after webship-js');
    assert.ok(cucumber.indexOf('webship-js/tests/step-definitions') < cucumber.indexOf('filament-steps'));
    assert.strictEqual((cucumber.match(/^\s*tags:/gm) || []).length, 1);
    assert.match(cucumber, /tags: process\.env\.CUCUMBER_TAGS \|\| 'not @wip and not @must-fail and not @maintenance and not @debug-page'/);
    assert.match(cucumber, demo ? /homePath: '\/',\n\s+loginPath: '\/login',/ : /homePath: '\/admin',\n\s+loginPath: '\/admin\/login',/);
    assert.match(cucumber, /administrator: \{ email: process\.env\.FILAMENT_ADMINISTRATOR_EMAIL \|\| 'administrator@example\.com', password: process\.env\.FILAMENT_ADMINISTRATOR_PASSWORD \|\| '[^']+', name: 'administrator' \},/);
    assert.match(cucumber, /unverified: \{ email: process\.env\.FILAMENT_UNVERIFIED_EMAIL/);
    assert.strictEqual((cucumber.match(/^\s*users: \{/gm) || []).length, 1, 'the registry once');
    assert.match(cucumber, /mailUrl: process\.env\.MAIL_URL/);
    const feature = fs.readFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'utf8');
    assert.doesNotMatch(feature, /__PANEL_PATH__|__LOGIN_PATH__/, 'the paths of this panel are filled in');
    assert.match(feature, demo ? /When I go to "\/login"/ : /When I go to "\/admin\/login"/);
  }
});

test('in an app whose package.json is a module, cucumber.js becomes an ES module and tests/ stays CommonJS, once', () => {
  const p = project('laravel', { module: true });
  const env = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1' };
  for (let i = 0; i < 2; i += 1) assert.strictEqual(bash(`testing_configure_filament ${p.dir}`, env).status, 0);
  const cucumber = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
  assert.strictEqual((cucumber.match(/^export default config\.default;$/gm) || []).length, 1);
  assert.doesNotMatch(cucumber, /^module\.exports/m);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(p.dir, 'tests', 'package.json'), 'utf8')), { type: 'commonjs' });
});

test('the testing hook leaves a project that is not an app with a panel alone', () => {
  for (const p of [project('laravel', { panel: false }), project('wordpress')]) {
    const before = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
    const r = bash(`testing_configure_filament ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts });
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout, '');
    assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), before);
  }
});

test('the first feature names no platform in a step, and no password', () => {
  const feature = fs.readFileSync(path.join(PKG, 'testing', 'panel.feature'), 'utf8');
  const steps = feature.split('\n').filter((l) => /^\s*(Given|When|Then|And|But)\s/.test(l));
  assert.ok(steps.length >= 8);
  for (const step of steps) assert.doesNotMatch(step, /filament|livewire|laravel/i, step);
  assert.doesNotMatch(feature, /password "/);
});

// ---- The runtimes: DDEV as before, and Docker Compose, Podman, Kubernetes, Lando and Docksal through the core's layer ----

const ADDRESSES: Record<string, string> = {
  docker: 'http://127.0.0.1:41234', podman: 'http://127.0.0.1:41234', lando: 'http://127.0.0.1:41234',
  kubernetes: 'http://172.18.0.2:30080', docksal: 'http://site1.docksal.site',
};

// The Laravel plugin's functions for the runtimes, replaced by recorders that do what it does: DDEV's verbs on
// DDEV, `php artisan` through exec and the keys written by the plugin on another runtime.
const LARAVEL_RUNTIMES = `laravel_artisan() { if [ "$(declare -f runtime_of > /dev/null && runtime_of || echo ddev)" == ddev ] ; then ddev artisan "$@" ; else ddev exec php artisan "$@" ; fi ; }
laravel_dotenv_set() { if [ "$(declare -f runtime_of > /dev/null && runtime_of || echo ddev)" == ddev ] ; then ddev dotenv set "$@" ; else echo "laravel_dotenv_set $*" >> "\${DDEV_LOG:-/dev/null}" ; fi ; }
laravel_runtime_config() { echo "laravel_runtime_config $*" >> "\${DDEV_LOG:-/dev/null}" ; }`;

/**
 * The demo build in a throwaway workspace, with `ddev` replaced by a recorder and the core's layer by stand-ins:
 * `layer` is the runtime it answers with (runtime_of, rt_url), or '' for a core that has no layer yet;
 * `laravel` is 'runtimes' for a Laravel plugin that builds on the runtimes, 'old' for one from before.
 */
function demoBuild(layer: string, laravel: 'runtimes' | 'old', env: Record<string, string> = {}, demo = true) {
  const p = project('laravel', { demo });
  const log = path.join(p.root, 'ddev.log');
  const copy = path.join(p.root, 'demo');
  fs.cpSync(p.dir, copy, { recursive: true });
  const address = ADDRESSES[layer] || '';
  const stand = [
    layer ? `runtime_of() { echo "\${RUNTIME_ANSWER}" ; } ; rt_url() { [ "\${RUNTIME_ANSWER}" == ddev ] && echo "https://\${PROJECT_NAME}.ddev.site" || echo "${address}" ; } ; rt_claim() { echo "rt_claim $* in $(basename "$PWD")" >> "${log}" ; }` : '',
    laravel === 'runtimes' ? LARAVEL_RUNTIMES : '',
  ].join('\n');
  const r = spawnSync('bash', ['-c', `ddev() { echo "ddev $*" >> "${log}" ; return 0 ; }\ntrim_project_name() { : ; }\ndrop_database() { : ; }\nddev_up() { ddev "$@" ; }\nddev_nodejs_version() { echo 24 ; }\n${LARAVEL}\n${stand}\nsource ${FUNCTIONS}\nfilament_get_demo() { cp -a ${copy}/. ./ ; }\nfilament_build`],
    { encoding: 'utf8', env: { ...process.env, WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log,
      INSTALL: 'yes', ADD_USERS: 'no', DEMO: demo ? 'yes' : 'no', PRODUCTION: 'no', LAUNCH: 'no', RUNTIME: '_none_', RUNTIME_ANSWER: layer || 'ddev',
      account_name: 'webmaster', account_mail: 'webmaster@example.com', account_pass: 'a-password-1', ...env } });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter((c) => /^(ddev|laravel_\w+|rt_claim) /.test(c)) : [];
  return { r, calls, dir: p.dir };
}

test('on DDEV the build is what it was: the same commands with the layer and without it, with a Laravel plugin of either age', () => {
  for (const demo of [true, false]) {
    const before = demoBuild('', 'old', {}, demo);
    assert.strictEqual(before.r.status, 0, before.r.stderr + before.r.stdout);
    for (const b of [demoBuild('ddev', 'old', {}, demo), demoBuild('ddev', 'runtimes', {}, demo), demoBuild('', 'runtimes', {}, demo)]) {
      assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
      assert.deepStrictEqual(b.calls, before.calls);
      assert.match(b.r.stdout, /Go to https:\/\/site1\.ddev\.site\/(admin\/)?login and log in as webmaster@example\.com/);
    }
    assert.ok(before.calls.some((c) => /^ddev artisan (migrate|filament:install)/.test(c)));
    assert.ok(!before.calls.some((c) => c.startsWith('laravel_runtime_config') || c.startsWith('rt_claim ')), 'on DDEV nothing is written for the app, and nothing is claimed');
  }
});

test('on Docker Compose, Podman, Kubernetes, Lando and Docksal the app gets the .env DDEV would write, and Artisan through exec', () => {
  for (const runtime of Object.keys(ADDRESSES)) {
    const address = ADDRESSES[runtime];
    const b = demoBuild(runtime, 'runtimes', { RUNTIME: runtime });
    assert.strictEqual(b.r.status, 0, runtime + ': ' + b.r.stderr + b.r.stdout);
    // The claim right after the project is configured, before it starts.
    assert.deepStrictEqual(b.calls.slice(0, 3), ['ddev config --project-type=laravel --docroot=public --project-name=site1 --nodejs-version=24 --php-version=8.4 --auto', 'rt_claim filament in site1', 'ddev start -y'], runtime);
    const at = b.calls.indexOf(`laravel_runtime_config ${address}`);
    assert.ok(at > b.calls.indexOf('ddev start -y') && at < b.calls.findIndex((c) => c.startsWith('ddev composer install')), `${runtime}: the .env after the start, before the packages`);
    assert.ok(b.calls.includes('ddev exec php artisan migrate --force --seed --no-interaction'), runtime);
    assert.ok(b.calls.includes('laravel_dotenv_set .env --mail-from-address=webship@example.com'), runtime);
    assert.ok(b.calls.includes('ddev npm ci --no-audit --no-fund') && b.calls.includes('ddev npm run build'), `${runtime}: npm in the tests container`);
    assert.ok(!b.calls.some((c) => /^ddev (artisan|dotenv) /.test(c)), `${runtime}: no verb the layer does not know`);
    assert.match(b.r.stdout, new RegExp(`Go to ${address.replace(/[.]/g, '\\.')}/login and log in as webmaster@example\\.com`), runtime);
    assert.doesNotMatch(b.r.stdout, /ddev\.site/, runtime);
    // A new app: the Laravel plugin's builder makes it, on the same runtime.
    const n = demoBuild(runtime, 'runtimes', { RUNTIME: runtime }, false);
    assert.strictEqual(n.r.status, 0, runtime + ': ' + n.r.stderr + n.r.stdout);
    assert.ok(n.calls.indexOf('rt_claim filament in site1') === n.calls.findIndex((c) => c.startsWith('laravel_build ')) + 1, `${runtime}: the claim on the project the Laravel builder made`);
    assert.ok(n.calls.includes('ddev exec php artisan filament:install --panels --no-interaction'), runtime);
    assert.ok(n.calls.includes('laravel_dotenv_set .env --queue-connection=sync'), runtime);
    assert.match(n.r.stdout, new RegExp(`Go to ${address.replace(/[.]/g, '\\.')}/admin/login`), runtime);
  }
});

test('--runtime is refused on a workspace without the runtime layer, and with a Laravel plugin from before the runtimes', () => {
  const noLayer = demoBuild('', 'runtimes', { RUNTIME: 'docker' });
  assert.strictEqual(noLayer.r.status, 1);
  assert.match(noLayer.r.stdout, /--runtime docker needs a Webship Workspace with the container runtimes/);
  assert.deepStrictEqual(noLayer.calls, []);
  const oldLaravel = demoBuild('docker', 'old', { RUNTIME: 'docker' });
  assert.strictEqual(oldLaravel.r.status, 1);
  assert.match(oldLaravel.r.stdout, /--runtime docker needs the Laravel plugin 1\.0\.2 or later, which builds on the container runtimes/);
  assert.deepStrictEqual(oldLaravel.calls, [], 'nothing is built');
});

test('the builder takes --runtime, with the runtimes of the core\'s own builders', () => {
  const args = fs.readFileSync(path.join(PKG, 'scripts', 'args', 'arg-filament.sh'), 'utf8');
  assert.match(args, /parser\.add_argument\('--runtime',\s+dest='RUNTIME',\s+default="_none_",\s+choices=\['ddev', 'docker', 'podman', 'kubernetes', 'lando', 'docksal'\],/);
});

test('an app with a panel is known on every runtime: the layer reads its project type', () => {
  const p = project('laravel');
  fs.rmSync(path.join(p.dir, '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(p.dir, 'compose.yaml'), 'name: site1\nx-webship:\n  runtime: docker\n  type: laravel\n  port: 41234\n');
  const layer = 'rt_is_platform() { grep -q "^  type: $2$" "$1/compose.yaml" 2>/dev/null ; } ; ';
  assert.strictEqual(bash(`${layer} filament_is_project ${p.dir}`).status, 0);
  assert.notStrictEqual(bash(`filament_is_project ${p.dir}`).status, 0, 'an older core reads no compose.yaml');
  const plain = project('laravel', { panel: false });
  fs.rmSync(path.join(plain.dir, '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(plain.dir, 'compose.yaml'), 'name: site1\nx-webship:\n  runtime: docker\n  type: laravel\n');
  assert.notStrictEqual(bash(`${layer} filament_is_project ${plain.dir}`).status, 0, 'a Laravel app without the panel is not one');
});

test('the feature of the runtimes drives an app of the platform, and names no platform in a step', () => {
  const feature = fs.readFileSync(path.join(PKG, 'features', 'filament-runtimes.feature'), 'utf8');
  const scenarios = feature.split(/\n(?=  @needs-runtime-)/).slice(1);
  assert.strictEqual(scenarios.length, 6);
  for (const s of scenarios) assert.match(s, /^  @needs-runtime-(docker|kubernetes) @needs-platform-filament\n  Scenario: /);
  const steps = feature.split('\n').filter((l) => /^\s*(Given|When|Then|And|But) /.test(l));
  for (const s of steps) assert.doesNotMatch(s, /filament|laravel|livewire/i, s);
  assert.strictEqual(scenarios.filter((s) => /I open "\/login" on the/.test(s)).length, 2, 'the login page of either kind of app');
  assert.doesNotMatch(feature, /ddev\.site|127\.0\.0\.1/);
  const manifest = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8')).workspacePlugin;
  assert.ok(manifest.features.includes('features/filament-runtimes.feature'));
  assert.match(manifest.featuresSite, /^cmd-filament-project\.sh ci-filament( [A-Za-z0-9._=-]+)* --runtime docker$/);
});

test('the demo app\'s .npmrc loses only its min-release-age line, and the builder says so; no .npmrc, nothing written', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filament-npmrc-'));
  const file = path.join(dir, '.npmrc');
  fs.writeFileSync(file, 'registry=https://registry.npmjs.org/\nmin-release-age=7\nfund=false\n  min-release-age = 14\n');
  const r = bash(`cd ${dir} && filament_npmrc_release_age .npmrc`);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), 'registry=https://registry.npmjs.org/\nfund=false\n', 'the other lines are kept as they were');
  assert.match(r.stdout, /^  \.npmrc: the min-release-age line taken out of the app's \.npmrc: the testing setup installs step packs younger than seven days\.$/m);
  assert.strictEqual(r.stdout.trim().split('\n').length, 1, 'one line');
  // Without the line: the file is as it was, and nothing is said.
  fs.writeFileSync(file, 'fund=false\n');
  const again = bash(`cd ${dir} && filament_npmrc_release_age .npmrc`);
  assert.strictEqual(again.status, 0);
  assert.strictEqual(again.stdout, '');
  assert.strictEqual(fs.readFileSync(file, 'utf8'), 'fund=false\n');
  // No .npmrc: none is written.
  fs.rmSync(file);
  const none = bash(`cd ${dir} && filament_npmrc_release_age .npmrc`);
  assert.strictEqual(none.status, 0);
  assert.strictEqual(none.stdout, '');
  assert.ok(!fs.existsSync(file), 'no .npmrc is made');
});

test('the demo build takes the line out on every runtime, DDEV too, after the demo is there', () => {
  for (const [layer, env] of [['', {}], ['ddev', {}], ['docker', { RUNTIME: 'docker' }], ['kubernetes', { RUNTIME: 'kubernetes' }]] as [string, Record<string, string>][]) {
    const p = project('laravel');
    const log = path.join(p.root, 'ddev.log');
    const copy = path.join(p.root, 'demo');
    fs.cpSync(p.dir, copy, { recursive: true });
    fs.writeFileSync(path.join(copy, '.npmrc'), 'min-release-age=7\nfund=false\n');
    const stand = layer ? `runtime_of() { echo "${layer}" ; } ; rt_url() { echo "http://127.0.0.1:41234" ; } ; rt_claim() { : ; }` : '';
    const r = spawnSync('bash', ['-c', `ddev() { echo "ddev $*" >> "${log}" ; return 0 ; }\ntrim_project_name() { : ; }\ndrop_database() { : ; }\nddev_up() { ddev "$@" ; }\nddev_nodejs_version() { echo 24 ; }\n${LARAVEL}\n${LARAVEL_RUNTIMES}\n${stand}\nsource ${FUNCTIONS}\nfilament_get_demo() { cp -a ${copy}/. ./ ; }\nfilament_build`],
      { encoding: 'utf8', env: { ...process.env, WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log,
        INSTALL: 'yes', ADD_USERS: 'no', DEMO: 'yes', PRODUCTION: 'no', LAUNCH: 'no', RUNTIME: '_none_', account_name: 'webmaster', account_mail: 'webmaster@example.com', account_pass: 'a-password-1', ...env } });
    assert.strictEqual(r.status, 0, (layer || 'no layer') + ': ' + r.stderr + r.stdout);
    assert.strictEqual(fs.readFileSync(path.join(p.dir, '.npmrc'), 'utf8'), 'fund=false\n', layer || 'no layer');
    assert.match(r.stdout, /\.npmrc: the min-release-age line taken out/, layer || 'no layer');
  }
});
