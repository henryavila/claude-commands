/**
 * Deterministic helpers for project-status bootstrap mode.
 * All functions are pure; no I/O, no globals.
 */

const BRANCH_PREFIXES = ['feat/', 'fix/', 'refactor/', 'chore/', 'docs/', 'test/'];
const ARTICLE_PREFIXES = ['the-', 'a-', 'an-'];
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}-/;

export function normalizeSlug(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.trim();

  // Strip branch prefix
  for (const p of BRANCH_PREFIXES) {
    if (s.startsWith(p)) { s = s.slice(p.length); break; }
  }

  // Convert remaining slashes to hyphens (handles org-namespaced paths like "org/repo")
  s = s.replace(/\//g, '-');

  // Strip date prefix
  s = s.replace(DATE_PREFIX, '');

  // Drop .md extension
  if (s.endsWith('.md')) s = s.slice(0, -3);

  // Must run before toLowerCase so uppercase boundaries are detectable
  // Camel/Pascal case to kebab: insert hyphen before uppercase letters (not at start)
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1-$2');

  // Lowercase
  s = s.toLowerCase();

  // Replace whitespace and underscores with hyphens
  s = s.replace(/[\s_]+/g, '-');

  // Remove non-alphanumeric except hyphens
  s = s.replace(/[^a-z0-9-]/g, '');

  // Collapse multiple hyphens
  s = s.replace(/-+/g, '-');

  // Strip leading article
  for (const p of ARTICLE_PREFIXES) {
    if (s.startsWith(p)) { s = s.slice(p.length); break; }
  }

  // Trim leading/trailing hyphens
  s = s.replace(/^-+|-+$/g, '');

  // Truncate to 40 chars + trim trailing hyphen again
  if (s.length > 40) s = s.slice(0, 40).replace(/-+$/, '');

  return s;
}
