#!/usr/bin/env node
/**
 * CHANGELOG.md model (Keep a Changelog): parse, derive the next release level
 * from [Unreleased], promote [Unreleased] to a version, render release notes.
 *
 * Pure functions, plus a small CLI used by CI and the release scripts:
 *   node scripts/changelog.cjs plan                 → level=…, previous=…, next=…
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
/** A bullet starting with this marker makes the next release a major version. */
const BREAKING_MARKER = '**Breaking:**';
const SUBSECTIONS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
/** Ordered weakest to strongest; `none` means "nothing to release". */
const LEVELS = ['none', 'patch', 'minor', 'major'];

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

function deriveLevel(lines) {
  const items = bullets(lines);
  if (items.length === 0) return 'none';
  if (items.some((b) => b.text.startsWith(BREAKING_MARKER))) return 'major';
  if (items.some((b) => b.subsection === 'Added')) return 'minor';
  return 'patch';
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

/** What a release would do right now. Throws when the changelog and package versions disagree. */
function plan(text, packageVersion) {
  const parsed = parseChangelog(text);
  const latest = releases(parsed)[0];
  if (!latest || latest.label !== packageVersion) {
    throw new Error(
      `CHANGELOG.md top release is ${latest ? latest.label : 'missing'} but packages are at ${packageVersion}; they must match before a release.`,
    );
  }
  const level = deriveLevel(unreleasedSection(parsed).lines);
  return { level, previous: packageVersion, next: level === 'none' ? null : nextVersion(packageVersion, level) };
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

/** Move the [Unreleased] body under a new "## [version] - date" heading and fix the compare links. */
function promote(text, version, date) {
  const parsed = parseChangelog(text);
  const unreleased = unreleasedSection(parsed);
  if (deriveLevel(unreleased.lines) === 'none') {
    throw new Error(`Nothing to promote: [${UNRELEASED_LABEL}] has no bullets.`);
  }
  const previous = releases(parsed)[0];
  if (!previous) throw new Error('CHANGELOG.md needs at least one released version to link from.');
  if (parsed.sections.some((s) => s.label === version)) throw new Error(`CHANGELOG.md already has a [${version}] section.`);

  const out = [...parsed.head];
  for (const section of parsed.sections) {
    const dateSuffix = section.date ? ` - ${section.date}` : '';
    out.push(`## [${section.label}]${dateSuffix}`);
    if (section.label !== UNRELEASED_LABEL) {
      out.push(...section.lines);
      continue;
    }
    out.push('', `## [${version}] - ${date}`, '', ...trimBlankEdges(section.lines), '');
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
    case 'plan': {
      const p = plan(fs.readFileSync(CHANGELOG_PATH, 'utf8'), readPackageVersion());
      return `level=${p.level}\nprevious=${p.previous}\nnext=${p.next ?? ''}\n`;
    }
    case 'unreleased':
      return unreleased(fs.readFileSync(arg ?? CHANGELOG_PATH, 'utf8')) + '\n';
    case 'notes':
      if (!arg) throw new Error('Usage: changelog.cjs notes <version>');
      return notes(fs.readFileSync(CHANGELOG_PATH, 'utf8'), arg);
    default:
      throw new Error('Usage: node scripts/changelog.cjs <plan | unreleased [file] | notes <version>>');
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
  BREAKING_MARKER,
  SUBSECTIONS,
  LEVELS,
  parseChangelog,
  bullets,
  deriveLevel,
  nextVersion,
  plan,
  promote,
  notes,
  unreleased,
  readPackageVersion,
};
