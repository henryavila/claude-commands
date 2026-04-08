#!/usr/bin/env node

import { parseArgs } from 'node:util';

let values, positionals;
try {
  ({ values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      yes: { type: 'boolean', short: 'y', default: false },
      project: { type: 'boolean', default: false },
      ide: { type: 'string' },
      lang: { type: 'string' },
      scope: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  }));
} catch (err) {
  console.error(`  Error: ${err.message}`);
  process.exit(1);
}

const command = positionals[0];

// Backward compat: --scope project → --project
if (values.scope === 'project') values.project = true;
if (values.scope && values.scope !== 'user' && values.scope !== 'project') {
  console.error('  Error: --scope must be "user" or "project"');
  process.exit(1);
}

if (command === 'install') {
  const { install } = await import('../src/install.js');
  await install(process.cwd(), {
    yes: values.yes,
    project: values.project,
    ide: values.ide ? values.ide.split(',') : null,
    lang: values.lang,
  });
} else if (command === 'uninstall') {
  const { uninstall } = await import('../src/uninstall.js');
  const scope = values.project ? 'project' : (values.scope || null);
  await uninstall(process.cwd(), scope);
} else if (command === 'status') {
  const { status } = await import('../src/status.js');
  status(process.cwd());
} else {
  console.log(`
  ⚛ Atomic Skills — Stop rewriting prompts.

  Usage:
    npx @henryavila/atomic-skills install    [--yes] [--project] [--ide <ids>] [--lang <code>]
    npx @henryavila/atomic-skills status
    npx @henryavila/atomic-skills uninstall  [--project]

  Options:
    --yes, -y     Accept auto-detected defaults (non-interactive)
    --project     Install to ./ instead of ~/ (default: user scope)
    --ide <ids>   Comma-separated: claude-code,cursor,gemini,codex,opencode,github-copilot
    --lang <code> Language: en, pt

  Docs: https://github.com/henryavila/atomic-skills
  `);
}
