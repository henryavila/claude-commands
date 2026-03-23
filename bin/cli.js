#!/usr/bin/env node

import { argv } from 'node:process';

const command = argv[2];

// Parse --scope flag
const scopeIdx = argv.indexOf('--scope');
const scopeValue = scopeIdx !== -1 ? argv[scopeIdx + 1] : null;

if (scopeValue && scopeValue !== 'user' && scopeValue !== 'project') {
  console.error('  Error: --scope must be "user" or "project"');
  process.exit(1);
}

if (command === 'install') {
  const { install } = await import('../src/install.js');
  await install(process.cwd(), scopeValue);
} else if (command === 'uninstall') {
  const { uninstall } = await import('../src/uninstall.js');
  await uninstall(process.cwd(), scopeValue);
} else {
  console.log(`
  ⚛ Atomic Skills — Stop rewriting prompts.

  Usage:
    npx @henryavila/atomic-skills install [--scope user|project]
    npx @henryavila/atomic-skills uninstall [--scope user|project]

  Options:
    --scope user      Install to ~/  (all repos)
    --scope project   Install to ./  (this repo only)

  Docs: https://github.com/henryavila/atomic-skills
  `);
}
