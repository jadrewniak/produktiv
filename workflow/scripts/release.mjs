/** Prepare a self-contained release; dependencies are resolved on the build machine. */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  activeAgentResources,
  buildPackageImage,
  finalizeRelease,
  historicalAgentInventory,
} from './package-image.mjs';
import { listSkillDirs, loadInstalledGraph, exerciseInstalledLibraries } from './bootstrap.mjs';

export async function buildRelease({ source, output }) {
  source = path.resolve(source);
  output = path.resolve(output);
  if (existsSync(output)) throw new Error(`Release destination already exists: ${output}`);
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Full release build and WASM proof require Node >=22.');
  const skills = listSkillDirs(path.join(source, 'skills'));
  if (!skills.length) throw new Error('No public skills/ inventory.');
  try {
    const image = buildPackageImage({ source, dest: output });
    for (const name of ['core', 'graph', 'diagram']) {
      if (!image.surfaces[name].ok) throw new Error(`Incomplete release: ${name} ${image.surfaces[name].reason}: ${image.surfaces[name].detail ?? ''}`);
    }
    const require = createRequire(path.join(source, 'vendor/understand-anything/package.json'));
    const ts = require('typescript');
    for (const file of ['graph/assemble.ts', 'graph/store.ts', 'graph/reconcile.ts', 'graph/neighborhood.ts', 'graph/queries.ts', 'graph/impact.ts', 'adapters/graph/index.ts']) {
      const emitted = ts.transpileModule(readFileSync(path.join(source, file), 'utf8'), { fileName: file, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
      if (emitted.diagnostics?.length) throw new Error(`Cannot emit ${file}`);
      writeFileSync(path.join(output, file.replace(/\.ts$/, '.js')), emitted.outputText);
    }
    await import(pathToFileURL(path.join(output, 'adapters/graph/index.js')).href);
    const plugin = path.join(output, 'vendor/understand-anything/dist/plugins/tree-sitter-plugin.js');
    const grammarProof = await loadInstalledGraph(plugin);
    await exerciseInstalledLibraries(plugin);
    for (const skill of skills) cpSync(skill.dir, path.join(output, 'skills', skill.name), { recursive: true });
    mkdirSync(path.join(output, 'scripts'), { recursive: true });
    for (const script of ['bootstrap.mjs', 'package-image.mjs']) cpSync(path.join(source, 'scripts', script), path.join(output, 'scripts', script));
    // Eval fixtures, upstream source and dependency installation are never delivery inputs.
    const receipt = finalizeRelease(output, {
      version: image.packageVersion,
      skills: skills.map((skill) => skill.name),
      activeAgentResources: activeAgentResources(source),
      legacyAgentInventory: historicalAgentInventory(source),
      surfaces: ['core', 'graph', 'diagram'],
      grammarSpecs: grammarProof.specs.length,
    });
    return receipt;
  } catch (error) {
    rmSync(output, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = flag => args[args.indexOf(flag) + 1];
  if (!args.includes('--output') || !value('--output') || value('--output').startsWith('--')) {
    console.error('Usage: node workflow/scripts/release.mjs --output <new-directory> [--source <workflow>]');
    process.exitCode = 2;
  } else {
    try {
      const receipt = await buildRelease({
        source: args.includes('--source') ? value('--source') : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
        output: value('--output'),
      });
      console.log(JSON.stringify({
        kind: receipt.kind,
        version: receipt.version,
        digest: receipt.digest,
        skills: receipt.skills.length,
        activeAgentResources: receipt.activeAgentResources.length,
        files: receipt.inventory.filter((entry) => entry.type === 'file').length,
        surfaces: receipt.surfaces,
        grammarSpecs: receipt.grammarSpecs,
      }, null, 2));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
