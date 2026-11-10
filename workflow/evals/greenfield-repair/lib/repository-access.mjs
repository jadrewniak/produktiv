export function classifyRepositoryAccess(input) {
  const remotes = input.remotes ?? [];
  const base = {
    git: input.gitRepo ? 'repository' : 'absent',
    head: input.head ? 'present' : 'missing',
    graph: input.gitRepo && input.head ? 'eligible' : 'unavailable',
    issues: { read: false, write: 'unknown', reason: null },
  };
  if (!input.gitRepo || remotes.length === 0) return { ...base, issues: { ...base.issues, reason: 'no-remote' } };
  if (remotes.length !== 1) return { ...base, issues: { ...base.issues, reason: 'ambiguous-remote' } };
  if (input.issuesConnector) {
    if (input.connectorRead === 'ok') return { ...base, repository: remotes[0], issues: { ...base.issues, read: true } };
    return { ...base, repository: remotes[0], issues: { ...base.issues, reason: input.connectorRead } };
  }
  if (!input.shell || !input.ghFound) return { ...base, repository: remotes[0], issues: { ...base.issues, reason: 'tool-absent' } };
  if (input.ghRead === 'ok') return { ...base, repository: remotes[0], issues: { ...base.issues, read: true } };
  return { ...base, repository: remotes[0], issues: { ...base.issues, reason: input.ghRead } };
}

