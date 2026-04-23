import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeSlug, editDistance, SOURCE_TYPE_WEIGHTS } from '../src/bootstrap.js';

describe('normalizeSlug', () => {
  it('lowercases and kebab-cases simple input', () => {
    assert.equal(normalizeSlug('AsReviewCode'), 'as-review-code');
  });

  it('strips common branch prefixes', () => {
    assert.equal(normalizeSlug('feat/as-review-code'), 'as-review-code');
    assert.equal(normalizeSlug('fix/bug-123'), 'bug-123');
    assert.equal(normalizeSlug('refactor/old-auth'), 'old-auth');
    assert.equal(normalizeSlug('chore/bump-deps'), 'bump-deps');
    assert.equal(normalizeSlug('docs/readme'), 'readme');
    assert.equal(normalizeSlug('test/unit-helpers'), 'unit-helpers');
  });

  it('strips date prefixes from doc filenames', () => {
    assert.equal(normalizeSlug('2026-04-10-as-review-code.md'), 'as-review-code');
    assert.equal(normalizeSlug('2025-12-31-bug-fix'), 'bug-fix');
  });

  it('strips leading articles', () => {
    assert.equal(normalizeSlug('The Review Skill'), 'review-skill');
    assert.equal(normalizeSlug('a-tool'), 'tool');
  });

  it('collapses whitespace and underscores to single hyphen', () => {
    assert.equal(normalizeSlug('review__code  skill'), 'review-code-skill');
  });

  it('removes non-alphanumeric chars except hyphens', () => {
    assert.equal(normalizeSlug('review (code)!'), 'review-code');
  });

  it('truncates to 40 chars', () => {
    assert.equal(
      normalizeSlug('a'.repeat(50)),
      'a'.repeat(40)
    );
  });

  it('removes trailing hyphens after truncation', () => {
    assert.equal(normalizeSlug('abc-def-ghi-'), 'abc-def-ghi');
  });

  it('returns empty string for non-normalizable input', () => {
    assert.equal(normalizeSlug(''), '');
    assert.equal(normalizeSlug('!@#'), '');
    assert.equal(normalizeSlug(null), '');
    assert.equal(normalizeSlug(undefined), '');
    assert.equal(normalizeSlug(42), '');
  });

  it('leaves digit-leading slugs unchanged (caller validates against spec regex)', () => {
    // Caller is responsible for checking the spec-compliant regex ^[a-z][a-z0-9-]{1,39}$
    // This function normalizes but does NOT validate.
    assert.equal(normalizeSlug('123-feature'), '123-feature');
    assert.equal(normalizeSlug('42'), '42');
  });

  it('converts remaining slashes to hyphens after prefix strip', () => {
    assert.equal(normalizeSlug('feat/org/feature'), 'org-feature');
    assert.equal(normalizeSlug('owner/repo'), 'owner-repo');
  });
});

describe('editDistance', () => {
  it('returns 0 for identical strings', () => {
    assert.equal(editDistance('abc', 'abc'), 0);
  });

  it('returns length of other string when one is empty', () => {
    assert.equal(editDistance('', 'hello'), 5);
    assert.equal(editDistance('world', ''), 5);
  });

  it('counts single substitution', () => {
    assert.equal(editDistance('cat', 'bat'), 1);
  });

  it('counts single insertion', () => {
    assert.equal(editDistance('cat', 'cats'), 1);
  });

  it('counts single deletion', () => {
    assert.equal(editDistance('cats', 'cat'), 1);
  });

  it('handles multiple edits', () => {
    assert.equal(editDistance('kitten', 'sitting'), 3);
  });

  it('handles slug-like strings', () => {
    assert.equal(editDistance('as-review-code', 'as-review-cod'), 1);
    assert.equal(editDistance('as-review-code', 'as-reviews-code'), 1);
  });
});

describe('SOURCE_TYPE_WEIGHTS', () => {
  it('covers all 13 source types from spec §15.1', () => {
    const expected = [
      'git-branch', 'github-pr-open', 'github-pr-merged-recent',
      'github-issue-open-mine', 'commit-group',
      'doc-plan', 'doc-spec', 'doc-adr', 'roadmap-section',
      'memory-local-entry', 'memory-local-orphan',
      'memory-claude-auto', 'claude-mem-obs',
    ];
    const actual = Object.keys(SOURCE_TYPE_WEIGHTS).sort();
    assert.deepEqual(actual, expected.sort());
  });

  it('assigns specific weights per spec §15.1', () => {
    assert.equal(SOURCE_TYPE_WEIGHTS['git-branch'], 0.30);
    assert.equal(SOURCE_TYPE_WEIGHTS['github-pr-open'], 0.30);
    assert.equal(SOURCE_TYPE_WEIGHTS['github-pr-merged-recent'], 0.05);
    assert.equal(SOURCE_TYPE_WEIGHTS['github-issue-open-mine'], 0.15);
    assert.equal(SOURCE_TYPE_WEIGHTS['commit-group'], 0.05);
    assert.equal(SOURCE_TYPE_WEIGHTS['doc-plan'], 0.20);
    assert.equal(SOURCE_TYPE_WEIGHTS['doc-spec'], 0.20);
    assert.equal(SOURCE_TYPE_WEIGHTS['doc-adr'], 0.15);
    assert.equal(SOURCE_TYPE_WEIGHTS['roadmap-section'], 0.15);
    assert.equal(SOURCE_TYPE_WEIGHTS['memory-local-entry'], 0.10);
    assert.equal(SOURCE_TYPE_WEIGHTS['memory-local-orphan'], 0.05);
    assert.equal(SOURCE_TYPE_WEIGHTS['memory-claude-auto'], 0.10);
    assert.equal(SOURCE_TYPE_WEIGHTS['claude-mem-obs'], 0.10);
  });
});
