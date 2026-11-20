/**
 * Filament for Webship Workspace: a platform plugin that builds on the Laravel plugin.
 *
 * What the package carries is placed by the installer from the manifest: the builder in the sites
 * folders, its functions and argparse under core/scripts/plugins/filament/ (with the first feature of
 * a panel's testing setup), and its AI items (ai/ in this package) in the folder of their kind: the
 * agents in AI Agents, the skill in AI Skills, the command in AI Commands, the prompts in AI Prompts. It
 * needs the Laravel plugin (the manifest's `needs`): a new app starts from that plugin's builder, the
 * accounts are written with its writer, and the panel's CLI is its Artisan tool. The dashboard needs
 * nothing drawn for it: the builder is in the Build list because it is a cmd-*-project.sh, the row menus
 * are the core's, the AI items are listed like any other. What register() adds is what the assistant is
 * told.
 *
 * Everything the dashboard is asked for goes through `api`; this package requires nothing from the
 * dashboard's own files, so it can be installed from npm and removed without a trace.
 */

import type { PluginApi } from '@webship.co/workspace-plugin-api';

/** The plugin's name. An app with a panel is a project of the DDEV type `laravel`, with filament/filament in its composer.json. */
export const PLATFORM = 'filament';

/** The plugin this one builds on: its builder, its account writer and its Artisan tool. */
export const BASE = 'laravel';

/** The commands the installer places in every sites folder. The panel's CLI is the Laravel plugin's Artisan tool. */
export const COMMANDS = ['cmd-filament-project.sh'];

/** The agents the installer places in the AI Agents folder. */
export const AGENTS = ['filament-site-builder', 'filament-tester'];

/** The skill the installer places in the AI Skills folder (a folder each, with its SKILL.md). */
export const SKILLS = ['filament-scenarios'];

/** The slash command the installer places in the AI Commands folder. */
export const AI_COMMANDS = ['filament-test'];

/** The prompts the installer places in the AI Prompts folder: each a whole launch command for a new session. */
export const PROMPTS = ['filament-build-and-test', 'filament-scenarios-for-a-resource'];

/** What the assistant is told about Filament in this workspace. */
export function assistantContext(): string {
  return [
    'Filament (a plugin, @webship.co/workspace-filament, which needs the Laravel plugin): an app with an admin panel is built with',
    '`bash cmd-filament-project.sh <name> --install --add-users` from a sites folder (dev, test, sandboxes, demos):',
    'a new Laravel app made by the Laravel plugin\'s builder (`--starter-kit livewire|react|vue`) with the panel installed the documented way, its admin panel at /admin;',
    'or with `--demo` the panel\'s official demo app (a shop, a blog, an HR suite, its own seed), its admin panel at the root of the app and a second panel with teams at /app.',
    'It runs in a container like every other project, at https://<name>.ddev.site; `--production` runs it as a live app runs.',
    'The panel\'s CLI is Artisan through the Laravel plugin\'s tool: `bash cmd-tools-laravel-artisan.sh <name> --run "<artisan command>"` (make:filament-resource, filament:upgrade, about).',
    '`bash cmd-tools-add-users.sh <name> filament` adds the default accounts (administrator, its address verified: the panel lets it in; unverified: the panel refuses it).',
    '`bash cmd-tools-testing.sh <name>` sets up webship-js with the Filament step pack (it brings the Laravel step pack along); `--run` runs the suite.',
    `For Filament work, hand over to the agents ${AGENTS.map((a) => `\`${a}\``).join(' and ')}.`,
    `The plugin also places the skill ${SKILLS.map((a) => `\`${a}\``).join(', ')} (the step pack's phrases, by area) in ai-skills/,`,
    `the command ${AI_COMMANDS.map((a) => `\`/${a} <app>\``).join(', ')} in ai-commands/ and the prompts ${PROMPTS.map((a) => `\`${a}\``).join(' and ')} in ai-prompts/.`,
    'Never run php, composer, npm or artisan on the host for a project; never write database settings into its .env by hand.',
  ].join(' ');
}

export function register(api: PluginApi): void {
  api.addAssistantContext(assistantContext);
}
