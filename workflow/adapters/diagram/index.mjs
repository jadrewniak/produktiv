/**
 * Workflow diagram adapter.
 *
 * Skills are the only allowed importers. They strip the workflow envelope
 * and pass Archify IR. Status is the separate CURRENT or PROPOSED argument
 * the skill already read. This module does not read the envelope and does
 * not import skill text.
 *
 * Renderers are CLIs that run on import, so they are spawned:
 * execFile(node, [renderer, input, output]). compareArchitecture is imported.
 * The artifact checker is spawned the same way. Nothing is written under
 * workflow/vendor/archify/. Ordinary IR omits meta.quality_profile. Child
 * processes do not receive ARCHIFY_QUALITY_PROFILE, ARCHIFY_REPO_ROOT, or
 * ARCHIFY_BRAND_* variables.
 */

import { execFile } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readlinkSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ArchitectureDeltaError, compareArchitecture } from '../../vendor/archify/delta/architecture-delta.mjs';

const execFileAsync = promisify(execFile);

const DIAGRAM_TYPES = new Set(['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle']);

const RENDERERS = Object.freeze({
  architecture: 'renderers/architecture/render-architecture.mjs',
  workflow: 'renderers/workflow/render-workflow.mjs',
  sequence: 'renderers/sequence/render-sequence.mjs',
  dataflow: 'renderers/dataflow/render-dataflow.mjs',
  lifecycle: 'renderers/lifecycle/render-lifecycle.mjs',
});

const GEOMETRY_STATUSES = new Set(['moved', 'rerouted', 'geometry-changed']);
const GEOMETRY_SUMMARY_KEYS = ['moved', 'rerouted', 'geometryChanged'];

const adapterDir = path.dirname(fileURLToPath(import.meta.url));
const vendorRoot = path.resolve(adapterDir, '../../vendor/archify');
const checkerPath = path.join(vendorRoot, 'scripts/check-render-output.mjs');

export function supports(type) {
  return DIAGRAM_TYPES.has(type);
}

export async function validate_ir(type, ir, status = 'CURRENT') {
  const rejected = rejection(type, ir, status);
  if (rejected) return { ok: false, diagnostics: rejected };

  const dir = createTempDir();
  if (!dir) return { ok: false, diagnostics: [tempInsideVendor()] };
  try {
    const rendered = await runRenderer(type, writeInput(dir, ir), path.join(dir, 'output.html'));
    return { ok: rendered.ok, diagnostics: rendered.diagnostics };
  } catch (error) {
    return { ok: false, diagnostics: [unexpected(error)] };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function render_ir(type, ir, outputPath, status = 'CURRENT') {
  const rejected = rejection(type, ir, status);
  if (rejected) return { ok: false, path: null, diagnostics: rejected };
  const outputProblem = outputRejection(outputPath);
  if (outputProblem) return { ok: false, path: null, diagnostics: outputProblem };

  const absoluteOutput = path.resolve(outputPath);
  const dir = createTempDir();
  if (!dir) return { ok: false, path: null, diagnostics: [tempInsideVendor()] };
  try {
    const rendered = await runRenderer(type, writeInput(dir, ir), absoluteOutput);
    if (!rendered.ok) {
      removeFile(absoluteOutput);
      return { ok: false, path: null, diagnostics: rendered.diagnostics };
    }
    if (!existsSync(absoluteOutput)) {
      return {
        ok: false,
        path: null,
        diagnostics: [diagnostic('diagram/renderer-failed', 'Renderer exited without an HTML artifact.')],
      };
    }
    const checked = await verify_artifact(absoluteOutput);
    if (!checked.ok) {
      removeFile(absoluteOutput);
      return { ok: false, path: null, diagnostics: diagnosticsFromChecks(checked.checks) };
    }
    return { ok: true, path: absoluteOutput, diagnostics: [] };
  } catch (error) {
    removeFile(absoluteOutput);
    return { ok: false, path: null, diagnostics: [unexpected(error)] };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function compare_architecture(currentIr, proposedIr) {
  const evidence = proposedEvidenceDiagnostic(proposedIr);
  if (evidence) return { ok: false, receipt: null, semantic: null, diagnostics: [evidence] };
  try {
    const receipt = compareArchitecture(currentIr, proposedIr);
    return { ok: true, receipt, semantic: semanticReceipt(receipt), diagnostics: [] };
  } catch (error) {
    const failure = error instanceof ArchitectureDeltaError ? deltaDiagnostic(error) : unexpected(error);
    return { ok: false, receipt: null, semantic: null, diagnostics: [failure] };
  }
}

export async function verify_artifact(htmlPath) {
  if (!existsSync(checkerPath)) {
    return {
      ok: false,
      checks: [{ name: 'runtime', ok: false, details: ['diagram checker is not in the workflow package'] }],
    };
  }
  try {
    const { stdout } = await execFileAsync(process.execPath, [checkerPath, htmlPath], spawnOptions(tmpdir()));
    return parseChecks(stdout);
  } catch (error) {
    const raw = String(error?.stdout || '').trim() || String(error?.stderr || '').trim();
    try {
      const parsed = parseChecks(raw);
      return { ok: false, checks: parsed.checks };
    } catch {
      return {
        ok: false,
        checks: [{ name: 'checker', ok: false, details: [raw.slice(0, 500) || error.message] }],
      };
    }
  }
}

function rejection(type, ir, status) {
  if (status !== 'CURRENT' && status !== 'PROPOSED') {
    return [diagnostic('diagram/status-invalid', 'Status must be CURRENT or PROPOSED.', { status: typeof status })];
  }
  if (!supports(type)) {
    return [diagnostic(
      'diagram/unsupported-type',
      `Diagram type ${JSON.stringify(type)} is not one of the five supported types.`,
      { type },
      ['choose architecture, workflow, sequence, dataflow, or lifecycle'],
    )];
  }
  if (!ir || typeof ir !== 'object' || Array.isArray(ir)) {
    return [diagnostic('diagram/ir-invalid', 'IR must be an object.')];
  }
  if (status === 'PROPOSED') {
    const evidence = proposedEvidenceDiagnostic(ir);
    if (evidence) return [evidence];
  }
  return null;
}

function proposedEvidenceDiagnostic(ir) {
  const paths = evidencePaths(ir);
  if (!paths.length) return null;
  return diagnostic(
    'diagram/proposed-evidence',
    'PROPOSED IR must not carry repository evidence. Remove meta.repository and sources; authority stays on the workflow envelope.',
    { status: 'PROPOSED', paths },
    ['remove meta.repository and component sources from the PROPOSED IR'],
    { paths },
  );
}

function evidencePaths(ir) {
  if (!ir || typeof ir !== 'object' || Array.isArray(ir)) return [];
  const paths = [];
  if (ir.meta && typeof ir.meta === 'object' && !Array.isArray(ir.meta) && ir.meta.repository != null) {
    paths.push('/meta/repository');
  }
  if (Array.isArray(ir.components)) {
    ir.components.forEach((component, index) => {
      if (component && typeof component === 'object' && component.sources != null) {
        paths.push(`/components/${index}/sources`);
      }
    });
  }
  return paths;
}

function outputRejection(outputPath) {
  if (typeof outputPath !== 'string' || outputPath.length === 0) {
    return [diagnostic('diagram/output-missing', 'render_ir requires an output path.')];
  }
  const absolute = path.resolve(outputPath);
  if (path.extname(absolute).toLowerCase() !== '.html') {
    return [diagnostic('diagram/output-extension', 'Diagram output must be an .html file.', { output: absolute })];
  }
  if (outputInsideVendor(absolute)) {
    return [diagnostic(
      'diagram/output-inside-vendor',
      'Diagram output must be outside workflow/vendor/archify/.',
      { output: absolute },
      ['choose an output path outside the vendored diagram runtime'],
    )];
  }
  return null;
}

function outputInsideVendor(targetPath) {
  let vendor;
  try {
    vendor = realpathSync(vendorRoot);
  } catch {
    return false;
  }
  return resolvesInside(vendor, path.resolve(targetPath), 0);
}

function resolvesInside(vendor, target, depth) {
  if (depth > 8) return true;
  if (isWithin(vendor, target)) return true;
  let cursor = target;
  const suffix = [];
  for (;;) {
    let stat;
    try {
      stat = lstatSync(cursor);
    } catch (error) {
      if (error?.code !== 'ENOENT') return true;
      stat = null;
    }
    if (stat?.isSymbolicLink()) {
      let link;
      try {
        link = readlinkSync(cursor);
      } catch {
        return true;
      }
      const linkTarget = path.resolve(path.dirname(cursor), link);
      return resolvesInside(vendor, path.join(linkTarget, ...suffix), depth + 1);
    }
    if (stat) {
      try {
        return isWithin(vendor, path.join(realpathSync(cursor), ...suffix));
      } catch {
        return true;
      }
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) return false;
    suffix.unshift(path.basename(cursor));
    cursor = parent;
  }
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function createTempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'produktiv-diagram-'));
  if (!outputInsideVendor(dir)) return dir;
  rmSync(dir, { recursive: true, force: true });
  return null;
}

function tempInsideVendor() {
  return diagnostic(
    'diagram/temp-inside-vendor',
    'Temporary diagram files resolved inside workflow/vendor/archify/.',
    {},
    ['point TMPDIR outside the vendored diagram runtime'],
  );
}

function writeInput(dir, ir) {
  const inputPath = path.join(dir, 'input.json');
  writeFileSync(inputPath, JSON.stringify(ir));
  return inputPath;
}

async function runRenderer(type, inputPath, outputPath) {
  const renderer = path.join(vendorRoot, RENDERERS[type]);
  if (!existsSync(renderer)) {
    return { ok: false, diagnostics: [unavailable('Diagram renderer is not in the workflow package.')] };
  }
  try {
    await execFileAsync(process.execPath, [renderer, inputPath, outputPath], spawnOptions(path.dirname(inputPath)));
    return { ok: true, diagnostics: [] };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { ok: false, diagnostics: [unavailable('Node is not available to render diagrams.')] };
    }
    return { ok: false, diagnostics: parseRendererDiagnostics(error?.stderr) };
  }
}

function spawnOptions(cwd) {
  return {
    cwd,
    encoding: 'utf8',
    env: childEnv(),
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  };
}

function childEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('ARCHIFY_')) delete env[key];
  }
  env.ARCHIFY_DIAGNOSTIC_FORMAT = 'json';
  return env;
}

function parseRendererDiagnostics(stderr) {
  const text = String(stderr || '').trim();
  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed?.diagnostics) && parsed.diagnostics.length) return parsed.diagnostics;
      if (typeof parsed?.error === 'string') {
        return [diagnostic('diagram/renderer-failed', parsed.error)];
      }
    } catch {
      return [diagnostic('diagram/renderer-failed', text.slice(0, 2000))];
    }
  }
  return [diagnostic('diagram/renderer-failed', 'Renderer failed without a diagnostic.')];
}

function parseChecks(raw) {
  const parsed = JSON.parse(String(raw || '').trim());
  return {
    ok: parsed.ok === true,
    checks: Array.isArray(parsed.checks) ? parsed.checks : [],
  };
}

function diagnosticsFromChecks(checks) {
  const failed = (checks || []).filter((check) => !check.ok);
  if (!failed.length) {
    return [diagnostic('diagram/artifact-check', 'Rendered HTML failed the artifact checker.')];
  }
  return failed.map((check) => diagnostic(
    `artifact/${check.name}`,
    Array.isArray(check.details) && check.details.length ? check.details.join('; ') : `${check.name} failed`,
    { check: check.name },
    [],
    { details: check.details || [] },
  ));
}

function semanticReceipt(receipt) {
  const semantic = structuredClone(receipt);
  for (const bucket of ['components', 'connections', 'boundaries']) {
    if (Array.isArray(semantic.changes?.[bucket])) {
      semantic.changes[bucket] = semantic.changes[bucket].filter((change) => !GEOMETRY_STATUSES.has(change.status));
    }
    const summary = semantic.summary?.[bucket];
    if (summary && typeof summary === 'object') {
      for (const key of GEOMETRY_SUMMARY_KEYS) delete summary[key];
    }
  }
  return semantic;
}

function deltaDiagnostic(error) {
  const details = error.details && typeof error.details === 'object' ? error.details : {};
  const { supportedFixes = [], side, path: detailPath, ...evidence } = details;
  return diagnostic(
    error.code || 'delta/failed',
    error.message,
    {
      ...(side ? { side } : {}),
      ...(detailPath ? { path: detailPath } : {}),
    },
    Array.isArray(supportedFixes) ? supportedFixes : [],
    evidence,
  );
}

function unavailable(message) {
  return diagnostic(
    'diagram/unavailable',
    message,
    {},
    ['use the diagram runtime shipped in the workflow package'],
  );
}

function unexpected(error) {
  return diagnostic(
    'diagram/failed',
    error?.message || 'Diagram adapter failed.',
    {},
    [],
    { errorName: error?.name || 'Error' },
  );
}

function diagnostic(code, message, subject = {}, supportedFixes = [], evidence = {}) {
  return {
    code,
    severity: 'error',
    message,
    subject,
    evidence,
    supportedFixes,
  };
}

function removeFile(filePath) {
  rmSync(filePath, { force: true });
}
