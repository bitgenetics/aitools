#!/usr/bin/env node
/**
 * Bump workspace versions, commit, tag v<version>, and push branch + tags.
 * Runs npm run verify (typecheck + test) before npm version bumps package.json files.
 * Cross-platform (Windows + macOS). Used by npm run version:patch|minor|major.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_PKG = path.join(REPO_ROOT, 'packages', 'core', 'package.json');
const VALID_LEVELS = new Set(['patch', 'minor', 'major']);
const COMMIT_MESSAGE = 'chore: bump';

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return (result.stdout ?? '').trim();
}

function runNpm(args) {
  // Windows: npm is npm.cmd — must use shell; execFileSync('npm.cmd') throws EINVAL.
  const result = spawnSync('npm', args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed`);
  }
}

function readCoreVersion() {
  const pkg = JSON.parse(fs.readFileSync(CORE_PKG, 'utf8'));
  if (!pkg.version) {
    throw new Error(`Missing version in ${CORE_PKG}`);
  }
  return pkg.version;
}

function main() {
  const level = process.argv[2];
  if (!level || !VALID_LEVELS.has(level)) {
    console.error('Usage: node scripts/version-release.cjs <patch|minor|major>');
    process.exit(1);
  }

  runGit(['rev-parse', '--git-dir']);

  const branch = runGit(['branch', '--show-current']);
  if (!branch) {
    throw new Error('Detached HEAD — checkout a branch before releasing.');
  }

  console.log('Running verify before version bump (typecheck + test)...');
  runNpm(['run', 'verify']);

  console.log(`Bumping ${level} across workspaces...`);
  runNpm(['version', level, '--workspaces', '--no-git-tag-version']);

  const version = readCoreVersion();
  const tag = `v${version}`;

  for (const pkgName of ['cli', 'core']) {
    const pkgPath = path.join(REPO_ROOT, 'packages', pkgName, 'package.json');
    const pkgVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
    if (pkgVersion !== version) {
      throw new Error(
        `packages/${pkgName}/package.json is ${pkgVersion}; expected ${version} after bump`,
      );
    }
  }

  console.log('Staging changes...');
  runGit(['add', '.']);

  const porcelain = runGit(['status', '--porcelain']);
  if (!porcelain) {
    throw new Error('No changes to commit after version bump.');
  }

  console.log(`Committing as "${COMMIT_MESSAGE}"...`);
  runGit(['commit', '-m', COMMIT_MESSAGE]);

  const existingTag = spawnSync('git', ['rev-parse', tag], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (existingTag.status === 0) {
    throw new Error(`Tag ${tag} already exists locally. Delete it or choose a new version.`);
  }

  console.log(`Creating tag ${tag}...`);
  runGit(['tag', tag]);

  const hasUpstream =
    spawnSync('git', ['rev-parse', '--abbrev-ref', '@{u}'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).status === 0;

  const pushArgs = hasUpstream
    ? ['push', 'origin', branch, '--tags']
    : ['push', '-u', 'origin', branch, '--tags'];

  console.log(`Pushing ${branch} and tags to origin...`);
  runGit(pushArgs, { stdio: 'inherit' });

  console.log(`Done: ${tag} pushed on ${branch}.`);
  console.log('npm publish CI runs on the new tag; E2E runs on the branch push.');
}

try {
  main();
} catch (err) {
  console.error((err instanceof Error ? err.message : String(err)));
  process.exit(1);
}
