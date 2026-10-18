#!/usr/bin/env node
/**
 * CI release (the `cut` job): bump + promote CHANGELOG.md (shared with the manual path),
 * then create the release commit and tag through the GitHub API so the commit is signed.
 * The level comes from the Conventional Commits since the last tag; CHANGELOG.md supplies the notes.
 * Checks already passed via job dependencies.
 */
'use strict';

const { prepareRelease } = require('./release/prepare.cjs');
const { commitViaApi } = require('./release/commit-api.cjs');

async function main() {
  const release = prepareRelease();
  const { tag, url } = await commitViaApi(release);
  console.log(`Created ${tag} (${release.level} from ${release.previous}): ${url}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
