/** Build a publishable npm CLI around an unchanged immutable release. */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRelease } from './release.mjs';

// Registry name. The release identity in produktiv-lock.json stays package.json's name.
const NPM_NAME = 'produktiv';
// Public source repository, used by npmjs.com to resolve README links.
const REPOSITORY_URL = 'https://github.com/jadrewniak/produktiv';
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/;

export async function buildNpmPackage({ source, output, name }) {
  source = path.resolve(source);
  output = path.resolve(output);
  if (existsSync(output)) throw new Error(`npm package destination already exists: ${output}`);

  const packageName = name ?? NPM_NAME;
  if (typeof packageName !== 'string' || !PACKAGE_NAME.test(packageName)) {
    throw new Error(`Invalid npm package name: ${JSON.stringify(packageName)}`);
  }

  try {
    mkdirSync(output, { recursive: true });
    const releaseRoot = path.join(output, 'release');
    const release = await buildRelease({ source, output: releaseRoot });
    const binDir = path.join(output, 'bin');
    mkdirSync(binDir, { recursive: true });
    const binPath = path.join(binDir, 'produktiv.mjs');
    cpSync(path.join(source, 'scripts', 'npm-cli.mjs'), binPath);
    chmodSync(binPath, 0o755);
    cpSync(path.join(source, 'LICENSE'), path.join(output, 'LICENSE'));
    // The release README has no install section. Put one right after its introduction.
    const readme = readFileSync(path.join(source, 'README.md'), 'utf8').trimEnd();
    const install =
      `## Install\n\n` +
      `Run in your project, with Node 22 or newer:\n\n` +
      `\`\`\`sh\n` +
      `npx --yes ${packageName}@${release.version} install --host claude-code --scope project --project .\n` +
      `\`\`\`\n\n` +
      `Use \`--host codex\` or \`--host cursor\` for the other hosts. ` +
      `The [quickstart](${REPOSITORY_URL}/blob/main/docs/quickstart.md) covers update and uninstall.\n\n`;
    const firstSection = readme.indexOf('\n## ');
    writeFileSync(
      path.join(output, 'README.md'),
      firstSection === -1
        ? `${readme}\n\n${install.trimEnd()}\n`
        : `${readme.slice(0, firstSection + 1)}${install}${readme.slice(firstSection + 1)}\n`,
    );

    const manifest = {
      name: packageName,
      version: release.version,
      description: 'One-command installer for the immutable Produktiv Agent Skills workflow release.',
      type: 'module',
      bin: { produktiv: 'bin/produktiv.mjs' },
      files: ['bin', 'release', 'README.md', 'LICENSE', '.produktiv-npm.json'],
      engines: { node: '>=22' },
      license: 'MIT',
      repository: { type: 'git', url: `git+${REPOSITORY_URL}.git` },
      homepage: `${REPOSITORY_URL}#readme`,
      bugs: { url: `${REPOSITORY_URL}/issues` },
      publishConfig: { access: 'public' },
    };
    writeFileSync(path.join(output, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    const transport = {
      kind: 'produktiv-npm-transport',
      schemaVersion: 1,
      package: packageName,
      version: release.version,
      releaseDigest: release.digest,
      command: `npx --yes ${packageName}@${release.version} install --host cursor --scope project --project .`,
    };
    writeFileSync(path.join(output, '.produktiv-npm.json'), `${JSON.stringify(transport, null, 2)}\n`);
    return { manifest, transport, release };
  } catch (error) {
    rmSync(output, { recursive: true, force: true });
    throw error;
  }
}

function usage() {
  console.error('Usage: node workflow/scripts/npm-package.mjs --output <new-directory> [--source <workflow>] [--name <npm-name>]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag) => {
    const index = args.indexOf(flag);
    return index === -1 ? null : args[index + 1];
  };
  const output = value('--output');
  if (!output || output.startsWith('--')) {
    usage();
    process.exitCode = 2;
  } else {
    try {
      const built = await buildNpmPackage({
        source: value('--source') ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
        output,
        name: value('--name') ?? undefined,
      });
      console.log(JSON.stringify({
        name: built.manifest.name,
        version: built.manifest.version,
        releaseDigest: built.transport.releaseDigest,
        command: built.transport.command,
      }, null, 2));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
