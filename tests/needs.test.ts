/**
 * What this plugin needs from the workspace it is added to and from the machine (the manifest's `needs` and `suggests`).
 * The workspace reads them: github.com/webship/workspace, core/workspace-app/PLUGINS.md.
 */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

// Compiled, this test runs from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8')).workspacePlugin;

test("the manifest says what the plugin needs: the plugins and the commands it cannot work without, and what a part of it uses", () => {
  assert.deepStrictEqual(manifest.needs, [['dev', 'test', 'sandboxes', 'demos'], 'laravel', 'ai-agents', 'ai-skills', 'ai-commands', 'ai-prompts']);
  assert.deepStrictEqual(manifest.suggests, undefined);
  assert.deepStrictEqual(manifest.needs[0], manifest.commands.workspaces, 'the alternatives are the folders the commands go to');
  for (const kind of ['agents', 'skills', 'commands', 'prompts']) assert.ok(manifest.ai[kind].length > 0, `it ships ${kind}, which is why it needs the folder they are placed in`);
  assert.match(fs.readFileSync(path.join(PKG, 'README.md'), 'utf8'), /^## What it needs$/m, 'and the README says so');
});

test('it needs the Laravel plugin, whose builder, account writer and Artisan tool it builds on, and says so', () => {
  assert.ok(manifest.needs.includes('laravel'), 'the Laravel plugin is a need: a new app starts from its laravel_build');
  const functions = fs.readFileSync(path.join(PKG, 'scripts', 'functions', 'fun-filament.sh'), 'utf8');
  assert.match(functions, /declare -f laravel_build/, 'the builder says so when the Laravel plugin is missing');
  assert.match(functions, /cmd-tools-laravel-artisan\.sh/, 'the panel\'s CLI is the Laravel plugin\'s Artisan tool');
  assert.match(fs.readFileSync(path.join(PKG, 'README.md'), 'utf8'), /@webship\.co\/workspace-laravel/, 'the README names it');
});
