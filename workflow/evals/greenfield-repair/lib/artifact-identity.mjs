const COMMENT = /<!--\s*produktiv:\s*([\s\S]*?)-->/g;
const STATUS_KEYS = new Set(['status', 'approved', 'ready', 'stage', 'verdict', 'session', 'commit', 'pull_request', 'pr', 'timestamp', 'host', 'sha']);
const ALLOWED = {
  issue: new Set(['feature']),
  spec: new Set(['feature', 'issue']),
  plan: new Set(['feature', 'issue', 'spec']),
  ticket: new Set(['feature', 'slice', 'plan', 'issue', 'spec']),
};

function parseLegacy(markdown) {
  let source = markdown;
  const currentPrefix = /^\s*<!--\s*produktiv:[\s\S]*?-->\s*\n/.exec(source);
  if (currentPrefix) source = source.slice(currentPrefix[0].length);
  if (!source.startsWith('---\n')) return null;
  const end = source.indexOf('\n---\n', 4);
  if (end < 0) throw new Error('legacy-yaml-unclosed');
  const values = {};
  for (const raw of source.slice(4, end).split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Za-z0-9_-]+):\s*(.*?)\s*$/.exec(raw);
    if (!match) throw new Error('legacy-yaml-invalid');
    const [, key, value] = match;
    if (Object.hasOwn(values, key)) throw new Error(`duplicate-key:${key}`);
    if (!value) throw new Error(`empty-key:${key}`);
    values[key] = value.replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function parseCurrent(markdown) {
  const matches = [...markdown.matchAll(COMMENT)];
  if (matches.length === 0) return null;
  if (matches.length > 1) throw new Error('duplicate-produktiv-comment');
  if (matches[0].index !== 0) throw new Error('produktiv-comment-not-first');
  let value;
  try {
    value = JSON.parse(matches[0][1].trim());
  } catch {
    throw new Error('invalid-produktiv-json');
  }
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('invalid-produktiv-object');
  if (value.version !== 1) throw new Error('unsupported-produktiv-version');
  const { version, ...semantic } = value;
  return semantic;
}

function validate(values, kind) {
  if (!values) return;
  if (!ALLOWED[kind]) throw new Error(`unknown-kind:${kind}`);
  for (const [key, value] of Object.entries(values)) {
    if (STATUS_KEYS.has(key) || !ALLOWED[kind].has(key)) throw new Error(`disallowed-key:${key}`);
    if (typeof value !== 'string' || value.length === 0) throw new Error(`invalid-value:${key}`);
  }
  if (!values.feature) throw new Error('missing-feature');
  if (kind === 'ticket' && (!values.slice || !values.plan)) throw new Error('missing-ticket-identity');
  if (kind === 'issue' && values.slice) throw new Error('issue-has-slice');
}

export function parseArtifactIdentity(markdown, kind) {
  const current = parseCurrent(markdown);
  const legacy = parseLegacy(markdown);
  validate(current, kind);
  validate(legacy, kind);
  if (!current && !legacy) return { identity: null, encoding: 'none' };
  if (current && legacy) {
    for (const key of new Set([...Object.keys(current), ...Object.keys(legacy)])) {
      if (current[key] !== legacy[key]) throw new Error(`identity-conflict:${key}`);
    }
    return { identity: current, encoding: 'both' };
  }
  return { identity: current ?? legacy, encoding: current ? 'comment' : 'yaml' };
}

export function resolveUnique(documents, kind, expected) {
  const matches = [];
  for (const document of documents) {
    const parsed = parseArtifactIdentity(document.markdown, kind);
    if (!parsed.identity) continue;
    if (Object.entries(expected).every(([key, value]) => parsed.identity[key] === value)) matches.push({ ...document, ...parsed });
  }
  if (matches.length > 1) throw new Error('duplicate-artifact-identity');
  return matches[0] ?? null;
}
