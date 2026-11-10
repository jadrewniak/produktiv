/**
 * One-time content-preservation check for moving instructions between files.
 *
 * Usage: node workflow/evals/budget/moved.mjs <move spec JSON>
 *
 * The spec names a base Git ref, the files the text came from and the files
 * it may now live in (paths relative to workflow/). The old files are cut
 * into units: headings, sentences, list item sentences and table cells.
 *
 * - A prose unit is compared as a whole unit, never as a substring, and it
 *   must occur in the new files exactly as often as it did in the old files
 *   and targets together. Fewer is `missing`, more is `duplicate`.
 * - A table cell needs `rows`: `target` is the file for the row's key (its
 *   first cell, as `{key}`) and `lines` the line prefix for each data column.
 *   The cell must be one whole line `<prefix><cell>` in that file and appear
 *   nowhere else, so a cell moved to another command or column is `missing`.
 *
 * - `place` (optional) lists `{ text, to }` for prose units: the unit must be
 *   a whole unit of that target file, so a sentence filed in the wrong file
 *   is `misplaced` even when its count is right.
 *
 * A unit that fails is accepted only with a reason under `missing` or
 * `duplicate`, and a reason that no longer applies fails too.
 *
 * It is not part of `run.mjs --all`: it compares against a fixed ref and is
 * run once in the PR that moves the text. The result goes in the plan. The
 * budget suite runs its negative controls on synthetic input.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workflowDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

/** Split prose into sentences without breaking inside inline code. */
export function sentences(text) {
  const spans = [];
  const masked = text.replace(/`[^`]*`/g, (span) => `\u0000${spans.push(span) - 1}\u0000`);
  return masked
    .split(/(?<=[.!?])\s+(?=[A-Z*\[(\u0000])/)
    .map((part) => normalize(part.replace(/\u0000(\d+)\u0000/g, (_, i) => spans[Number(i)])))
    .filter(Boolean);
}

/** Units of one Markdown document, in order: { text } or { text, key, column } for a table cell. */
export function units(markdown) {
  const found = [];
  let paragraph = [];
  let tableRow = 0;
  const prose = (texts) => found.push(...texts.map((text) => ({ text })));
  const flush = () => {
    if (paragraph.length) prose(sentences(paragraph.join(' ')));
    paragraph = [];
  };
  for (const raw of markdown.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('|')) {
      flush();
      tableRow += 1;
      if (tableRow === 1 || /^\|[\s|:-]+\|$/.test(line)) continue;
      const [key, ...cells] = line.split('|').slice(1, -1).map(normalize);
      cells.forEach((text, column) => text && found.push({ text, key, column }));
      continue;
    }
    tableRow = 0;
    if (!line) flush();
    else if (/^#{1,6} /.test(line)) {
      flush();
      prose([line]);
    } else if (/^(?:[-*]|\d+\.) /.test(line)) {
      flush();
      prose(sentences(line.replace(/^(?:[-*]|\d+\.) /, '')));
    } else paragraph.push(line);
  }
  flush();
  return found;
}

function substrings(haystack, needle) {
  let count = 0;
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + needle.length)) count += 1;
  return count;
}

function proseUnits(text) {
  return new Set(units(text).filter((unit) => !('key' in unit)).map((unit) => unit.text));
}

function proseCounts(texts) {
  const counts = new Map();
  for (const text of texts) for (const unit of units(text)) if (!('key' in unit)) counts.set(unit.text, (counts.get(unit.text) ?? 0) + 1);
  return counts;
}

/** readBase(file) returns '' for a file that did not exist at the base ref. */
export function check(spec, readBase, readTarget) {
  const targets = new Map(spec.to.map((file) => [file, readTarget(file)]));
  const after = proseCounts([...targets.values()]);
  const before = proseCounts([...new Set([...spec.from, ...spec.to])].map(readBase));
  const joined = normalize([...targets.values()].join('\n'));
  const missing = new Set();
  const duplicate = new Set();
  const problems = [];
  const seen = new Set();
  let total = 0;
  for (const file of spec.from) {
    for (const unit of units(readBase(file))) {
      if (seen.has(JSON.stringify(unit))) continue;
      seen.add(JSON.stringify(unit));
      total += 1;
      if (!('key' in unit)) {
        const now = after.get(unit.text) ?? 0;
        const then = before.get(unit.text) ?? 0;
        if (now < then) missing.add(unit.text);
        else if (now > then) duplicate.add(unit.text);
        continue;
      }
      if (!spec.rows) {
        problems.push(`table cell needs spec.rows: ${unit.text}`);
        continue;
      }
      const home = spec.rows.target.replaceAll('{key}', unit.key);
      const prefix = spec.rows.lines[unit.column];
      if (!targets.has(home) || typeof prefix !== 'string') {
        problems.push(`no target for row ${unit.key}, column ${unit.column}`);
        continue;
      }
      const lines = targets.get(home).replace(/\r/g, '').split('\n').filter((line) => line === prefix + unit.text).length;
      const anywhere = substrings(joined, unit.text);
      if (lines === 0) missing.add(unit.text);
      else if (lines > 1 || anywhere > 1) duplicate.add(unit.text);
    }
  }
  const sourceTexts = new Set(spec.from.flatMap((file) => units(readBase(file)).map((unit) => unit.text)));
  const placed = new Set();
  for (const { text, to } of spec.place ?? []) {
    if (placed.has(text)) problems.push(`placed twice: ${text}`);
    placed.add(text);
    if (!sourceTexts.has(text)) problems.push(`place names no source unit: ${text}`);
    else if (!targets.has(to)) problems.push(`place target is not in spec.to: ${to}`);
    else if (!missing.has(text) && !proseUnits(targets.get(to)).has(text)) problems.push(`misplaced: ${text} (expected in ${to})`);
  }
  for (const [kind, list] of [['missing', missing], ['duplicate', duplicate]]) {
    const explained = spec[kind] ?? {};
    for (const unit of list) if (!(unit in explained)) problems.push(`${kind}: ${unit}`);
    for (const [unit, reason] of Object.entries(explained)) {
      if (!list.has(unit)) problems.push(`stale ${kind} explanation: ${unit}`);
      else if (typeof reason !== 'string' || reason.length < 10) problems.push(`${kind} needs a reason: ${unit}`);
    }
  }
  return { base: spec.base, units: total, preserved: total - missing.size - duplicate.size, missing: missing.size, duplicate: duplicate.size, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const specPath = process.argv[2];
  if (!specPath) {
    console.error('usage: node workflow/evals/budget/moved.mjs <move spec JSON>');
    process.exit(2);
  }
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const repo = path.dirname(workflowDir);
  const show = (file) => execFileSync('git', ['show', `${spec.base}:workflow/${file}`], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  for (const file of spec.from) show(file); // a source file must exist at the base ref
  const readBase = (file) => {
    try {
      return show(file);
    } catch {
      return '';
    }
  };
  const readTarget = (file) => readFileSync(path.join(workflowDir, file), 'utf8');
  const result = check(spec, readBase, readTarget);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.problems.length ? 1 : 0);
}
