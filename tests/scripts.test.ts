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
