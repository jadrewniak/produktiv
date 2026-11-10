/**
 * structural assembler.
 *
 * A tiny committed repo produces a known function and an import edge.
 * A second run on the same HEAD keeps those ids. Parser-backed nodes,
 * ambiguous calls, and the offline import surface are asserted here
 * until the small graph fixture exists.
 */

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const workflowDir = path.join(repoRoot, 'workflow');
const vendorDist = path.join(workflowDir, 'vendor/understand-anything/dist');
const tsc = path.join(workflowDir, 'vendor/understand-anything/node_modules/typescript/bin/tsc');

execFileSync(process.execPath, [tsc, '-p', path.join(workflowDir, 'tsconfig.json'), '--noEmit'], {
  cwd: workflowDir,
  stdio: 'inherit',
});

const require = createRequire(import.meta.url);
const ts = require('../../../vendor/understand-anything/node_modules/typescript/lib/typescript.js');
const assembleTs = path.join(workflowDir, 'graph/assemble.ts');
const assembleJs = path.join(workflowDir, 'graph/assemble.js');
const transpiled = ts.transpileModule(readFileSync(assembleTs, 'utf8'), {
  fileName: assembleTs,
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
writeFileSync(assembleJs, transpiled.outputText);

const { assemble, ASSEMBLER_VERSION } = await import(
  pathToFileURL(path.join(workflowDir, 'graph/assemble.js')).href
);
const { validateGraph } = await import(pathToFileURL(path.join(vendorDist, 'schema.js')).href);
const { MarkdownParser } = await import(pathToFileURL(path.join(vendorDist, 'plugins/parsers/markdown-parser.js')).href);
const { SQLParser } = await import(pathToFileURL(path.join(vendorDist, 'plugins/parsers/sql-parser.js')).href);
const { DockerfileParser } = await import(pathToFileURL(path.join(vendorDist, 'plugins/parsers/dockerfile-parser.js')).href);
const { GraphQLParser } = await import(pathToFileURL(path.join(vendorDist, 'plugins/parsers/graphql-parser.js')).href);
const { TerraformParser } = await import(pathToFileURL(path.join(vendorDist, 'plugins/parsers/terraform-parser.js')).href);
const { EnvParser } = await import(pathToFileURL(path.join(vendorDist, 'plugins/parsers/env-parser.js')).href);

const scanScript = path.join(workflowDir, 'vendor/understand-anything/scripts/scan-project.mjs');
const extractScript = path.join(workflowDir, 'vendor/understand-anything/scripts/extract-structure.mjs');
const importScript = path.join(workflowDir, 'vendor/understand-anything/scripts/extract-import-map.mjs');

const FORBIDDEN_EDGES = ['reads_from', 'writes_to', 'configures', 'triggers', 'depends_on', 'related', 'similar_to'];

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function initRepo() {
  const cwd = mkdtempSync(path.join(tmpdir(), 'produktiv-graph-assemble-'));
  git(cwd, ['init', '-b', 'main']);
  git(cwd, ['config', 'user.email', 'eval@produktiv.invalid']);
  git(cwd, ['config', 'user.name', 'Produktiv Eval']);
  git(cwd, ['config', 'commit.gpgsign', 'false']);
  return cwd;
}

function write(cwd, rel, text) {
  const abs = path.join(cwd, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, text);
}

function runNode(args, cwd) {
  return execFileSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

function analysisFromExtract(result) {
  return {
    functions: (result.functions ?? []).map((fn) => ({
      name: fn.name,
      lineRange: [fn.startLine, fn.endLine],
      params: fn.params ?? [],
    })),
    classes: (result.classes ?? []).map((cls) => ({
      name: cls.name,
      lineRange: [cls.startLine, cls.endLine],
      methods: cls.methods ?? [],
      properties: cls.properties ?? [],
    })),
    imports: [],
    exports: (result.exports ?? []).map((exp) => ({
      name: exp.name,
      lineNumber: exp.line,
      isDefault: exp.isDefault === true,
    })),
  };
}

function identity(graph) {
  return {
    hash: graph.project.gitCommitHash,
    nodes: graph.nodes.map((node) => node.id).sort(),
    edges: graph.edges.map((edge) => `${edge.type}|${edge.source}|${edge.target}`).sort(),
  };
}

function assertStructural(graph) {
  const validated = validateGraph(graph);
  assert.equal(validated.success, true, validated.fatal ?? 'validateGraph rejected the document');
  assert.equal(validated.data.project.gitCommitHash, graph.project.gitCommitHash);
  for (const node of validated.data.nodes) {
    assert.ok(node.evidence === 'structural' || node.evidence === 'docs', `${node.id} lost evidence`);
    assert.equal(Object.hasOwn(node, 'inference'), false, `${node.id} has an inference field`);
  }
  const edgeTypes = new Set(graph.edges.map((edge) => edge.type));
  for (const forbidden of FORBIDDEN_EDGES) {
    assert.equal(edgeTypes.has(forbidden), false, `invented edge ${forbidden}`);
  }
  return validated;
}

describe('structural assembler', { concurrency: false }, () => {
  test('committed function and import edge stay stable on an unchanged HEAD', { timeout: 120_000 }, async () => {
    const cwd = initRepo();
    const outDir = mkdtempSync(path.join(tmpdir(), 'produktiv-graph-assemble-out-'));
    try {
      write(cwd, 'src/lib.ts', 'export function knownSymbol(): number {\n  return 1;\n}\n');
      write(cwd, 'src/app.ts', 'import { knownSymbol } from "./lib";\n\nexport function main(): number {\n  return knownSymbol();\n}\n');
      git(cwd, ['add', '.']);
      git(cwd, ['commit', '-m', 'initial']);
      const head = git(cwd, ['rev-parse', 'HEAD']);

      write(cwd, 'src/lib.ts', 'export function dirtySymbol(): number {\n  return 2;\n}\n');

      const scanPath = path.join(outDir, 'scan.json');
      runNode([scanScript, cwd, scanPath], cwd);
      const scan = JSON.parse(readFileSync(scanPath, 'utf8'));
      const batchFiles = scan.files.filter((file) => file.path.startsWith('src/'));

      const extractInput = path.join(outDir, 'extract-input.json');
      const extractOutput = path.join(outDir, 'extract-output.json');
      writeFileSync(extractInput, JSON.stringify({ projectRoot: cwd, batchFiles }));
      runNode([extractScript, extractInput, extractOutput], cwd);
      const extracted = JSON.parse(readFileSync(extractOutput, 'utf8'));
      const byPath = new Map(extracted.results.map((result) => [result.path, result]));
      assert.deepEqual(byPath.get('src/lib.ts').functions.map((fn) => fn.name), ['knownSymbol']);

      const importInput = path.join(outDir, 'import-input.json');
      const importOutput = path.join(outDir, 'import-output.json');
      writeFileSync(importInput, JSON.stringify({ projectRoot: cwd, files: batchFiles }));
      runNode([importScript, importInput, importOutput], cwd);
      const imported = JSON.parse(readFileSync(importOutput, 'utf8'));
      assert.deepEqual(imported.importMap['src/app.ts'], ['src/lib.ts']);

      const files = batchFiles.map((file) => {
        const result = byPath.get(file.path);
        return {
          path: file.path,
          language: file.language,
          fileCategory: file.fileCategory,
          analysis: analysisFromExtract(result),
          calls: result.callGraph ?? [],
          structureOutcome: 'succeeded',
        };
      });

      const first = await assemble({
        projectRoot: cwd,
        files,
        importMap: imported.importMap,
      });
      const second = await assemble({
        projectRoot: cwd,
        files,
        importMap: imported.importMap,
      });

      assert.equal(first.graph.project.gitCommitHash, head);
      assert.equal(first.graph.project.description, '');
      assert.equal(first.partial, false, JSON.stringify(first.droppedCalls));
      assert.ok(first.graph.nodes.some((node) => node.id === 'function:src/lib.ts:knownSymbol'));
      assert.equal(
        first.graph.nodes.some((node) => node.name === 'dirtySymbol'),
        false,
      );
      assert.ok(first.graph.edges.some((edge) => (
        edge.type === 'imports'
        && edge.source === 'file:src/app.ts'
        && edge.target === 'file:src/lib.ts'
      )));
      assert.ok(first.graph.edges.some((edge) => (
        edge.type === 'calls'
        && edge.source === 'function:src/app.ts:main'
        && edge.target === 'function:src/lib.ts:knownSymbol'
      )));
      const known = first.graph.nodes.find((node) => node.id === 'function:src/lib.ts:knownSymbol');
      assert.equal(known.evidence, 'structural');
      assert.equal(known.summary, 'knownSymbol');
      assert.deepEqual(identity(first.graph), identity(second.graph));
      const validated = assertStructural(first.graph);
      assert.ok(validated.data.nodes.some((node) => node.id === 'function:src/lib.ts:knownSymbol'));
      assert.ok(validated.data.edges.some((edge) => (
        edge.type === 'imports'
        && edge.source === 'file:src/app.ts'
        && edge.target === 'file:src/lib.ts'
      )));
      assert.equal(ASSEMBLER_VERSION, '1');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  test('parser nodes, documents, and ambiguous calls', async () => {
    const cwd = initRepo();
    try {
      write(cwd, 'keep.txt', 'anchor\n');
      git(cwd, ['add', '.']);
      git(cwd, ['commit', '-m', 'anchor']);
      const head = git(cwd, ['rev-parse', 'HEAD']);

      const readme = '# Title\n\nSee [lib](./src/lib.ts) and [web](https://example.com).\n';
      const markdown = new MarkdownParser();
      const sql = new SQLParser().analyzeFile('schema.sql', 'CREATE TABLE users (id int);\nCREATE VIEW active AS SELECT id FROM users;\n');
      const docker = new DockerfileParser().analyzeFile('Dockerfile', 'FROM node:22\nEXPOSE 3000\nRUN npm test\n');
      const graphql = new GraphQLParser().analyzeFile('api.graphql', [
        'type User {',
        '  id: ID!',
        '}',
        'input UserInput {',
        '  id: ID!',
        '}',
        'interface Named {',
        '  id: ID!',
        '}',
        'union Result = User',
        'scalar DateTime',
        'type Query {',
        '  user: User',
        '}',
        '',
      ].join('\n'));
      const terraform = new TerraformParser().analyzeFile('main.tf', 'resource "aws_s3_bucket" "logs" {\n}\n');
      const env = new EnvParser().analyzeFile('.env.example', 'PORT=3000\nSECRET=hunter2\n');

      const built = await assemble({
        projectRoot: cwd,
        files: [
          {
            path: 'src/lib.ts',
            fileCategory: 'code',
            analysis: {
              functions: [
                { name: 'knownSymbol', lineRange: [1, 3], params: [], owner: 'Lib' },
              ],
              classes: [{ name: 'Widget', lineRange: [5, 8], methods: ['draw'], properties: [] }],
              imports: [],
              exports: [
                { name: 'knownSymbol', lineNumber: 1 },
                { name: 'Widget', lineNumber: 5 },
              ],
            },
            calls: [{ caller: 'knownSymbol', callee: 'Widget', lineNumber: 2 }],
            structureOutcome: 'succeeded',
          },
          {
            path: 'src/app.ts',
            fileCategory: 'code',
            analysis: {
              functions: [{ name: 'main', lineRange: [1, 3], params: [] }],
              classes: [],
              imports: [],
              exports: [{ name: 'main', lineNumber: 1 }],
            },
            calls: [
              { caller: 'main', callee: 'knownSymbol', lineNumber: 2 },
              { caller: 'main', callee: 'console.log', lineNumber: 3 },
            ],
            structureOutcome: 'succeeded',
          },
          {
            path: 'src/overloads.ts',
            fileCategory: 'code',
            analysis: {
              functions: [
                { name: 'run', lineRange: [1, 2], params: [] },
                { name: 'run', lineRange: [10, 12], params: ['x'] },
                { name: 'caller', lineRange: [14, 16], params: [] },
              ],
              classes: [],
              imports: [],
              exports: [],
            },
            calls: [{ caller: 'caller', callee: 'run', lineNumber: 15 }],
            structureOutcome: 'succeeded',
          },
          {
            path: 'README.md',
            fileCategory: 'docs',
            analysis: markdown.analyzeFile('README.md', readme),
            references: markdown.extractReferences('README.md', readme),
            structureOutcome: 'succeeded',
          },
          { path: 'schema.sql', fileCategory: 'data', analysis: sql, structureOutcome: 'succeeded' },
          { path: 'Dockerfile', fileCategory: 'infra', analysis: docker, structureOutcome: 'succeeded' },
          { path: 'api.graphql', fileCategory: 'data', analysis: graphql, structureOutcome: 'succeeded' },
          { path: 'main.tf', fileCategory: 'infra', analysis: terraform, structureOutcome: 'succeeded' },
          { path: '.env.example', fileCategory: 'config', analysis: env, structureOutcome: 'succeeded' },
          {
            path: 'notes.lua',
            fileCategory: 'code',
            analysis: null,
            structureOutcome: 'skipped',
          },
        ],
        importMap: {
          'src/app.ts': ['src/lib.ts'],
        },
        manifests: {
          'package.json': '{ "dependencies": { "react": "19.0.0" } }\n',
        },
      });

      assert.equal(built.graph.project.gitCommitHash, head);
      assert.deepEqual(built.graph.project.frameworks, ['react']);
      assert.equal(built.partial, true);
      assert.deepEqual(built.partialFiles, ['notes.lua']);
      assert.equal(built.droppedCalls.length, 1);
      assert.equal(built.droppedCalls[0].filePath, 'src/overloads.ts');
      assert.equal(built.droppedCalls[0].reason, 'ambiguous');

      const ids = new Set(built.graph.nodes.map((node) => node.id));
      assert.ok(ids.has('function:src/lib.ts:knownSymbol'));
      assert.ok(ids.has('class:src/lib.ts:Widget'));
      assert.ok(ids.has('document:README.md'));
      assert.equal([...ids].filter((id) => id.startsWith('document:')).length, 1);
      assert.equal(built.graph.nodes.some((node) => node.name === 'Title'), false);
      assert.ok(ids.has('table:schema.sql:users'));
      assert.ok(built.graph.nodes.some((node) => node.id === 'view:schema.sql:active' && node.type === 'table'));
      assert.ok([...ids].some((id) => id.startsWith('service:Dockerfile:')));
      assert.ok([...ids].some((id) => id.startsWith('step:Dockerfile:') || built.graph.nodes.some((node) => node.type === 'pipeline')));
      assert.ok(built.graph.nodes.some((node) => node.id === 'type:api.graphql:User' && node.type === 'schema'));
      assert.ok(built.graph.nodes.some((node) => node.id === 'input:api.graphql:UserInput' && node.type === 'schema'));
      assert.ok(built.graph.nodes.some((node) => node.id === 'interface:api.graphql:Named' && node.type === 'schema'));
      assert.ok(built.graph.nodes.some((node) => node.id === 'union:api.graphql:Result' && node.type === 'schema'));
      assert.ok(built.graph.nodes.some((node) => node.id === 'scalar:api.graphql:DateTime' && node.type === 'schema'));
      assert.equal(built.graph.nodes.some((node) => node.type === 'concept'), false);
      assert.ok(built.graph.nodes.some((node) => node.type === 'endpoint' && node.filePath === 'api.graphql'));
      assert.ok(ids.has('resource:main.tf:aws_s3_bucket.logs'));
      assert.ok(ids.has('config:.env.example'));
      assert.equal(JSON.stringify(built.graph).includes('hunter2'), false);
      assert.equal(built.graph.nodes.find((node) => node.id === 'function:src/lib.ts:knownSymbol').owner, 'Lib');
      assert.equal(built.graph.nodes.find((node) => node.id === 'document:README.md').evidence, 'docs');
      assert.equal(built.graph.nodes.find((node) => node.id === 'file:notes.lua').evidence, 'structural');

      assert.ok(built.graph.edges.some((edge) => (
        edge.type === 'calls'
        && edge.source === 'function:src/lib.ts:knownSymbol'
        && edge.target === 'class:src/lib.ts:Widget'
      )));
      assert.ok(built.graph.edges.some((edge) => (
        edge.type === 'calls'
        && edge.source === 'function:src/app.ts:main'
        && edge.target === 'function:src/lib.ts:knownSymbol'
      )));
      assert.equal(
        built.graph.edges.some((edge) => edge.type === 'calls' && edge.source.startsWith('function:src/overloads.ts')),
        false,
      );
      assert.ok(ids.has('function:src/overloads.ts:run'));
      assert.ok(ids.has('function:src/overloads.ts:run#10'));
      assert.ok(built.graph.edges.some((edge) => (
        edge.type === 'documents'
        && edge.source === 'document:README.md'
        && edge.target === 'file:src/lib.ts'
      )));
      assert.equal(built.graph.edges.some((edge) => edge.target.includes('example.com')), false);

      const validated = assertStructural(built.graph);
      const owner = validated.data.nodes.find((node) => node.id === 'function:src/lib.ts:knownSymbol');
      assert.equal(owner.owner, 'Lib');
      assert.equal(owner.evidence, 'structural');
      const document = validated.data.nodes.find((node) => node.id === 'document:README.md');
      assert.equal(document.evidence, 'docs');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('two imported namesakes are dropped, and a same-file match wins', async () => {
    const cwd = initRepo();
    try {
      write(cwd, 'keep.txt', 'anchor\n');
      git(cwd, ['add', '.']);
      git(cwd, ['commit', '-m', 'anchor']);

      const shared = (name) => ({
        functions: [{ name, lineRange: [1, 2], params: [] }],
        classes: [],
        imports: [],
        exports: [{ name, lineNumber: 1 }],
      });

      const ambiguous = await assemble({
        projectRoot: cwd,
        files: [
          { path: 'src/a.ts', fileCategory: 'code', analysis: shared('helper'), calls: [{ caller: 'helper', callee: 'other', lineNumber: 2 }], structureOutcome: 'succeeded' },
          { path: 'src/b.ts', fileCategory: 'code', analysis: shared('other'), structureOutcome: 'succeeded' },
          { path: 'src/c.ts', fileCategory: 'code', analysis: shared('other'), structureOutcome: 'succeeded' },
        ],
        importMap: { 'src/a.ts': ['src/b.ts', 'src/c.ts'] },
      });
      assert.equal(ambiguous.partial, true);
      assert.equal(ambiguous.droppedCalls.length, 1);
      assert.equal(ambiguous.graph.edges.some((edge) => edge.type === 'calls'), false);

      const local = await assemble({
        projectRoot: cwd,
        files: [
          {
            path: 'src/a.ts',
            fileCategory: 'code',
            analysis: {
              functions: [
                { name: 'helper', lineRange: [1, 2], params: [] },
                { name: 'other', lineRange: [4, 5], params: [] },
              ],
              classes: [],
              imports: [],
              exports: [],
            },
            calls: [{ caller: 'helper', callee: 'other', lineNumber: 2 }],
            structureOutcome: 'succeeded',
          },
          { path: 'src/b.ts', fileCategory: 'code', analysis: shared('other'), structureOutcome: 'succeeded' },
        ],
        importMap: { 'src/a.ts': ['src/b.ts'] },
      });
      assert.equal(local.partial, false);
      assert.ok(local.graph.edges.some((edge) => (
        edge.type === 'calls'
        && edge.source === 'function:src/a.ts:helper'
        && edge.target === 'function:src/a.ts:other'
      )));
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('the module stays offline and does not import a model, Figma, or skill markdown', () => {
    const source = readFileSync(path.join(workflowDir, 'graph/assemble.ts'), 'utf8');
    const compiled = readFileSync(path.join(workflowDir, 'graph/assemble.js'), 'utf8');
    const specifiers = [...new Set([...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]))].sort();
    assert.deepEqual(specifiers, [
      '../adapters/host/git.mjs',
      '../vendor/understand-anything/dist/index.js',
      'node:path',
    ]);
    for (const text of [source, compiled]) {
      assert.equal(/\bfetch\s*\(/.test(text), false);
      assert.equal(/llm-analyzer|openai|anthropic|figma|SKILL\.md/.test(text), false);
    }
  });
});
