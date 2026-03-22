import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { hashContent } from '../src/hash.js';

describe('hashContent', () => {
  it('returns consistent sha256 for same input', () => {
    const h1 = hashContent('hello world');
    const h2 = hashContent('hello world');
    assert.strictEqual(h1, h2);
  });

  it('returns different hashes for different input', () => {
    const h1 = hashContent('hello');
    const h2 = hashContent('world');
    assert.notStrictEqual(h1, h2);
  });

  it('returns a sha256 hex string (64 chars)', () => {
    const h = hashContent('test');
    assert.match(h, /^[a-f0-9]{64}$/);
  });
});
