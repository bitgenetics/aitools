#!/usr/bin/env node
/**
 * CHANGELOG.md model (Keep a Changelog): parse, validate against the package version,
 * promote [Unreleased] to a version, render release notes. The release *level* is not
 * decided here — see scripts/commits.cjs and scripts/release/plan.cjs.
 *
 * Pure functions, plus a small CLI used by CI and the release scripts:
 *   node scripts/changelog.cjs validate             → top release matches packages/core version
 *   node scripts/changelog.cjs unreleased [file]    → the [Unreleased] body (LF-normalised)
 *   node scripts/changelog.cjs notes <version>      → release notes for that version
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_URL = 'https://github.com/bitgenetics/aitools';
const CHANGELOG_PATH = path.join(__dirname, '..', 'CHANGELOG.md');
const CORE_PACKAGE_JSON = path.join(__dirname, '..', 'packages', 'core', 'package.json');

const UNRELEASED_LABEL = 'Unreleased';
const SUBSECTIONS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
/** Written into a release section when a releasing commit landed without release notes. */
const NO_NOTES_LINES = ['### Changed', '- No release notes were recorded for this version; see the commit history.'];

const SECTION_HEADING = /^## \[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2}))?\s*$/;
const SUBSECTION_HEADING = /^### (.+?)\s*$/;
const LINK_DEFINITION = /^\[([^\]]+)\]: (\S+)\s*$/;
const BULLET = /^- /;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function detectEol(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/**
 * @returns {{ eol: string, head: string[], sections: {label: string, date: string|null, lines: string[]}[], links: {label: string, url: string}[] }}
 */
function parseChangelog(text) {
  const eol = detectEol(text);
  const head = [];
  const sections = [];
  const links = [];
  let current = null;

  for (const line of text.split(eol)) {
    const heading = SECTION_HEADING.exec(line);
    if (heading) {
      current = { label: heading[1], date: heading[2] ?? null, lines: [] };
      sections.push(current);
      continue;
    }
    const link = LINK_DEFINITION.exec(line);
    if (link) {
      links.push({ label: link[1], url: link[2] });
      continue;
    }
    if (!current) {
      head.push(line);
      continue;
    }
    const subsection = SUBSECTION_HEADING.exec(line);
    if (subsection && !SUBSECTIONS.includes(subsection[1])) {
      throw new Error(`Unknown subsection "### ${subsection[1]}" under [${current.label}]; use one of ${SUBSECTIONS.join(', ')}.`);
    }
    current.lines.push(line);
  }

  return { eol, head, sections, links };
}

function unreleasedSection(parsed) {
  const section = parsed.sections.find((s) => s.label === UNRELEASED_LABEL);
  if (!section) throw new Error(`CHANGELOG.md has no "## [${UNRELEASED_LABEL}]" section.`);
  return section;
}

function releases(parsed) {
  return parsed.sections.filter((s) => s.label !== UNRELEASED_LABEL);
}

/** Bullets of a section body, each tagged with the subsection it sits under. */
function bullets(lines) {
  const out = [];
  let subsection = null;
  for (const line of lines) {
    const heading = SUBSECTION_HEADING.exec(line);
    if (heading) {
      subsection = heading[1];
      continue;
    }
    if (BULLET.test(line)) out.push({ subsection, text: line.slice(2) });
  }
  return out;
}

function hasBullets(lines) {
  return bullets(lines).length > 0;
}

function nextVersion(current, level) {
  const match = SEMVER.exec(current);
  if (!match) throw new Error(`Not a semver version: "${current}"`);
  const [major, minor, patch] = match.slice(1).map(Number);
  switch (level) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Cannot compute the next version for level "${level}".`);
  }
}

/** Parses and checks that the newest released section is the version the packages carry. */
function validate(text, packageVersion) {
  const parsed = parseChangelog(text);
  const latest = releases(parsed)[0];
  if (!latest || latest.label !== packageVersion) {
    throw new Error(
      `CHANGELOG.md top release is ${latest ? latest.label : 'missing'} but packages are at ${packageVersion}; they must match before a release.`,
    );
  }
  return parsed;
}

function trimBlankEdges(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') start++;
  while (end > start && lines[end - 1].trim() === '') end--;
  return lines.slice(start, end);
}

function compareUrl(from, to) {
  return `${REPO_URL}/compare/${from}...${to}`;
}

/**
 * Move the [Unreleased] body under a new "## [version] - date" heading and fix the compare
 * links. An empty [Unreleased] yields a placeholder note, so a release that the commits
 * require never blocks on missing prose.
 */
function promote(text, version, date) {
  const parsed = parseChangelog(text);
  const unreleased = unreleasedSection(parsed);
  const previous = releases(parsed)[0];
  if (!previous) throw new Error('CHANGELOG.md needs at least one released version to link from.');
  if (parsed.sections.some((s) => s.label === version)) throw new Error(`CHANGELOG.md already has a [${version}] section.`);
  const body = hasBullets(unreleased.lines) ? trimBlankEdges(unreleased.lines) : NO_NOTES_LINES;

  const out = [...parsed.head];
  for (const section of parsed.sections) {
    const dateSuffix = section.date ? ` - ${section.date}` : '';
    out.push(`## [${section.label}]${dateSuffix}`);
    if (section.label !== UNRELEASED_LABEL) {
      out.push(...section.lines);
      continue;
    }
    out.push('', `## [${version}] - ${date}`, '', ...body, '');
  }

  const links = parsed.links.map((l) =>
    l.label === UNRELEASED_LABEL ? { label: l.label, url: compareUrl(`v${version}`, 'HEAD') } : l,
  );
  const unreleasedIndex = links.findIndex((l) => l.label === UNRELEASED_LABEL);
  links.splice(unreleasedIndex + 1, 0, { label: version, url: compareUrl(`v${previous.label}`, `v${version}`) });
  for (const l of links) out.push(`[${l.label}]: ${l.url}`);
  out.push('');
  return out.join(parsed.eol);
}

/** Release-notes body for one version (used for the GitHub Release). Always LF. */
function notes(text, version) {
  const parsed = parseChangelog(text);
  const all = releases(parsed);
  const index = all.findIndex((s) => s.label === version);
  if (index < 0) throw new Error(`CHANGELOG.md has no [${version}] section.`);
  const older = all[index + 1];
  const link = older ? compareUrl(`v${older.label}`, `v${version}`) : `${REPO_URL}/releases/tag/v${version}`;
  return [...trimBlankEdges(all[index].lines), '', `Full changelog: ${link}`, ''].join('\n');
}

/** The [Unreleased] body, LF-normalised, for change detection across revisions. */
function unreleased(text) {
  return trimBlankEdges(unreleasedSection(parseChangelog(text)).lines).join('\n');
}

function readPackageVersion() {
  return JSON.parse(fs.readFileSync(CORE_PACKAGE_JSON, 'utf8')).version;
}

function cli(argv) {
  const [verb, arg] = argv;
  switch (verb) {
    case 'validate': {
      const version = readPackageVersion();
      validate(fs.readFileSync(CHANGELOG_PATH, 'utf8'), version);
      return `CHANGELOG.md is consistent with version ${version}.\n`;
    }
    case 'unreleased':
      return unreleased(fs.readFileSync(arg ?? CHANGELOG_PATH, 'utf8')) + '\n';
    case 'notes':
      if (!arg) throw new Error('Usage: changelog.cjs notes <version>');
      return notes(fs.readFileSync(CHANGELOG_PATH, 'utf8'), arg);
    default:
      throw new Error('Usage: node scripts/changelog.cjs <validate | unreleased [file] | notes <version>>');
  }
}

if (require.main === module) {
  try {
    process.stdout.write(cli(process.argv.slice(2)));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

module.exports = {
  REPO_URL,
  CHANGELOG_PATH,
  CORE_PACKAGE_JSON,
  SUBSECTIONS,
  parseChangelog,
  bullets,
  hasBullets,
  nextVersion,
  validate,
  promote,
  notes,
  unreleased,
  readPackageVersion,
};
