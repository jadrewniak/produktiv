/**
 * REWRITE of Archify 5289f6867f048a7450ec5718f58459613a84cf41 brand-marks.mjs.
 * Frozen reason: the brand catalog is not copied. Any node with `brand` throws.
 * Otherwise the renderer receives empty marks and does not capture or draw a logo.
 */
import { throwDiagnosticError } from './diagnostics.mjs';

const COLLECTIONS = Object.freeze({
  architecture: 'components',
  workflow: 'nodes',
  sequence: 'participants',
  dataflow: 'nodes',
  lifecycle: 'states',
});

function hasBrand(node) {
  return Boolean(node && node.brand);
}

function rejectBrand(diagramType, collection, nodes) {
  const hits = nodes.filter(hasBrand);
  if (!hits.length) return;
  const diagnostics = hits.map((node) => ({
    code: 'brand/rejected',
    severity: 'error',
    message: `${collection} node ${JSON.stringify(node?.id)} sets brand, which this runtime does not render`,
    subject: { diagramType, collection, id: node?.id },
    evidence: {},
    supportedFixes: ['remove the brand field'],
  }));
  throwDiagnosticError(
    `Brand marks are not available:\n- ${diagnostics.map((item) => item.message).join('\n- ')}`,
    diagnostics,
  );
}

export async function prepareDiagramBrandMarks(diagramType, diagram) {
  const collection = COLLECTIONS[diagramType];
  const nodes = collection && diagram && Array.isArray(diagram[collection]) ? diagram[collection] : [];
  rejectBrand(diagramType, collection || String(diagramType), nodes);
}

function assertNoBrand(node) {
  if (!hasBrand(node)) return;
  throwDiagnosticError('Brand marks are not available.', [{
    code: 'brand/rejected',
    severity: 'error',
    message: `Node ${JSON.stringify(node.id)} sets brand, which this runtime does not render`,
    subject: { id: node.id },
    evidence: {},
    supportedFixes: ['remove the brand field'],
  }]);
}

export function brandMarkFor(node) {
  assertNoBrand(node);
  return null;
}

export function brandMetadataFor(node) {
  assertNoBrand(node);
  return {};
}

export function brandLabelFitWidth(node, width) {
  assertNoBrand(node);
  return width;
}

export function brandTopRailProblem(node) {
  assertNoBrand(node);
  return null;
}

export function renderBrandMark(node) {
  assertNoBrand(node);
  return '';
}
