import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI = join(__dirname, '..', 'bin', 'cli.js');

describe('CLI flag parsing', () => {
  it('rejects invalid --scope value', () => {
    assert.throws(() => {
      execFileSync('node', [CLI, 'install', '--scope', 'invalid'], {
        encoding: 'utf8',
        timeout: 5000,
      });
    }, (err) => {
      assert.ok(err.stderr.includes('--scope must be'));
      return true;
    });
  });

  it('shows help when no command given', () => {
    const output = execFileSync('node', [CLI], { encoding: 'utf8', timeout: 5000 });
    assert.ok(output.includes('--yes'));
    assert.ok(output.includes('--project'));
    assert.ok(output.includes('--ide'));
    assert.ok(output.includes('--lang'));
    assert.ok(output.includes('status'));
  });

  it('shows help with -h flag', () => {
    const output = execFileSync('node', [CLI, '-h'], { encoding: 'utf8', timeout: 5000 });
    assert.ok(output.includes('Atomic Skills'));
  });

  it('runs status command without error when not installed', () => {
    const output = execFileSync('node', [CLI, 'status'], {
      encoding: 'utf8',
      timeout: 5000,
      cwd: '/tmp',
    });
    assert.ok(output.length > 0);
  });
});
