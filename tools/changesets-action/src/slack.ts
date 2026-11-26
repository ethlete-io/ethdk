import fs from "node:fs/promises";
import path from "node:path";
import * as core from "@actions/core";
import type { Package } from "@manypkg/get-packages";
import { getChangelogEntry } from "./utils.ts";

type SlackSection = { type: "section"; text: { type: "mrkdwn"; text: string } };

const SLACK_SECTION_MAX_CHARACTERS = 3000;
const SLACK_MAX_BLOCKS = 50;
const HIGHLIGHT_MAX_CHARACTERS = 200;
const THREAD_SECTIONS_PER_MESSAGE = 10;
const THREAD_MAX_MESSAGES_PER_PACKAGE = 5;

export const MAX_HIGHLIGHTS = 3;

export type ChangeLevel = "major" | "minor" | "patch";

export type ReleaseChange = {
  level: ChangeLevel;
  summary: string;
  breaking: boolean;
};

export type PackageRelease = {
  name: string;
  version: string;
  changes: ReleaseChange[];
  notes: string;
  url: string | null;
};

export type SlackPayload = {
  channel?: string;
  unfurl_links: false;
  unfurl_media: false;
  text: string;
  blocks: unknown[];
};

export type SlackMessages = { main: SlackPayload; thread: SlackPayload[] };

export function escapeSlackText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function markdownToSlackMrkdwn(markdown: string): string {
  const codeBlocks: string[] = [];
  let result = escapeSlackText(markdown).replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  const inlineCodes: string[] = [];
  result = result.replace(/`[^`\n]+`/g, (match) => {
    inlineCodes.push(match);
    return `\x00IC${inlineCodes.length - 1}\x00`;
  });

  // Bold is marked with \x01 until the italic pass has run, which would otherwise read the Slack `*bold*` as markdown italic.
  result = result.replace(/^#{1,6}\s+(.+)$/gm, "\x01$1\x01");
  result = result.replace(/\*\*(.+?)\*\*/gs, "\x01$1\x01");
  result = result.replace(/__(.+?)__/gs, "\x01$1\x01");
  result = result.replace(/(?<![*_])\*([^*\n]+)\*(?![*_])/g, "_$1_");
  result = result.replace(/\x01/g, "*");
  result = result.replace(/~~(.+?)~~/g, "~$1~");
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");
  result = result.replace(/^[ \t]*[-*]\s+/gm, "• ");

  result = result.replace(
    /\x00IC(\d+)\x00/g,
    (_, i) => inlineCodes[parseInt(i)],
  );
  result = result.replace(
    /\x00CB(\d+)\x00/g,
    (_, i) => codeBlocks[parseInt(i)],
  );

  return result.trim();
}

function splitPoint(slice: string): number {
  const newline = slice.lastIndexOf("\n");
  if (newline > 0) return newline;
  const space = slice.lastIndexOf(" ");
  if (space > 0) return space;
  return slice.length;
}

export function splitText(text: string, max: number): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining.length > 0) {
    if (remaining.length <= max) {
      chunks.push(remaining);
      break;
    }
    const splitAt = splitPoint(remaining.slice(0, max));
    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}

function section(text: string): SlackSection {
  return { type: "section", text: { type: "mrkdwn", text } };
}

export function splitIntoSlackSections(text: string): SlackSection[] {
  return splitText(text, SLACK_SECTION_MAX_CHARACTERS).map(section);
}

const LEVEL_HEADINGS: Record<string, ChangeLevel> = {
  major: "major",
  minor: "minor",
  patch: "patch",
};

const BREAKING_PREFIX = /^\**breaking( change)?\**:?\**\s*/i;

export function parseChangelogEntry(content: string): ReleaseChange[] {
  const changes: ReleaseChange[] = [];
  let level: ChangeLevel | null = null;
  let current: ReleaseChange | null = null;
  const flush = () => {
    if (current) changes.push({ ...current, summary: current.summary.trim() });
    current = null;
  };

  for (const line of content.split("\n")) {
    const heading = /^#{1,6}\s+(major|minor|patch)\b/i.exec(line);
    if (heading) {
      flush();
      level = LEVEL_HEADINGS[heading[1].toLowerCase()];
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flush();
      level = null;
      continue;
    }
    if (!level) continue;
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      current = createChange(level, bullet[1]);
    } else if (current && line.trim()) {
      current.summary += `\n${line.replace(/^ {2}/, "")}`;
    }
  }
  flush();
  return changes;
}

export function createChange(
  level: ChangeLevel,
  summary: string,
): ReleaseChange {
  const breaking = level === "major" || BREAKING_PREFIX.test(summary.trim());
  return { level, summary: summary.trim(), breaking };
}

export function isNoiseChange(change: ReleaseChange): boolean {
  const firstLine = change.summary.split("\n")[0].trim();
  return (
    /^updated dependencies\b/i.test(firstLine) ||
    /^internal\b/i.test(firstLine) ||
    /no (behaviou?r|functional|user-facing) change/i.test(firstLine)
  );
}

const LEVEL_RANK: Record<ChangeLevel, number> = {
  major: 0,
  minor: 1,
  patch: 2,
};

function rank(change: ReleaseChange): number {
  return change.breaking ? -1 : LEVEL_RANK[change.level];
}

export function selectHighlights(
  changes: ReleaseChange[],
  max: number = MAX_HIGHLIGHTS,
): { highlights: ReleaseChange[]; remaining: number } {
  const relevant = changes
    .filter((change) => !isNoiseChange(change))
    .map((change, index) => ({ change, index }))
    .sort((a, b) => rank(a.change) - rank(b.change) || a.index - b.index)
    .map(({ change }) => change);
  return {
    highlights: relevant.slice(0, max),
    remaining: Math.max(relevant.length - max, 0),
  };
}

export function truncateHighlight(
  text: string,
  max: number = HIGHLIGHT_MAX_CHARACTERS,
): string {
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length <= max) return firstLine;
  const sentenceEnd = firstLine.slice(0, max).search(/[.;](?=\s)[^.;]*$/);
  if (sentenceEnd > max / 3) {
    const end = firstLine[sentenceEnd] === "." ? "." : "…";
    return `${firstLine.slice(0, sentenceEnd)}${end}`;
  }
  let cut = firstLine.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  if (space > max / 2) cut = cut.slice(0, space);
  if ((cut.match(/`/g) ?? []).length % 2 === 1) {
    cut = cut.slice(0, cut.lastIndexOf("`")).trimEnd();
  }
  return `${cut.replace(/[\s,;:.(-]+$/, "")}…`;
}

function highlightLine(change: ReleaseChange): string {
  const summary = markdownToSlackMrkdwn(
    truncateHighlight(change.summary.replace(BREAKING_PREFIX, "")),
  );
  return change.breaking
    ? `• :warning: *Breaking:* ${summary}`
    : `• ${summary}`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function packageSummary(release: PackageRelease): string {
  const { highlights, remaining } = selectHighlights(release.changes);
  const breakingCount = release.changes.filter((c) => c.breaking).length;
  const title = `*${escapeSlackText(release.name)}* \`${release.version}\``;
  const marker = breakingCount
    ? `  :rotating_light: *${plural(breakingCount, "breaking change")}*`
    : "";
  const footer = [
    remaining ? `_+${plural(remaining, "more change")}_` : "",
    release.url ? `<${release.url}|Full changelog>` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return [title + marker, ...highlights.map(highlightLine), footer]
    .filter(Boolean)
    .join("\n");
}

function hasRelevantChanges(release: PackageRelease): boolean {
  return release.changes.some((change) => !isNoiseChange(change));
}

function dependencyOnlyLine(releases: PackageRelease[]): string {
  const names = releases.map((release) => {
    const label = `${escapeSlackText(release.name)} ${release.version}`;
    return release.url ? `<${release.url}|${label}>` : label;
  });
  return `_Dependency updates only:_ ${names.join(", ")}`;
}

function capBlocks(blocks: unknown[], max: number): unknown[] {
  if (blocks.length <= max) return blocks;
  return [
    ...blocks.slice(0, max - 1),
    section(`_+${blocks.length - max + 1} more blocks cut to fit Slack._`),
  ];
}

function payload(
  text: string,
  blocks: unknown[],
  channel: string | undefined,
): SlackPayload {
  return {
    ...(channel ? { channel } : {}),
    unfurl_links: false,
    unfurl_media: false,
    text,
    blocks: capBlocks(blocks, SLACK_MAX_BLOCKS),
  };
}

export function createMainPayload(
  releases: PackageRelease[],
  {
    title,
    channel,
    threaded = false,
  }: { title: string; channel?: string; threaded?: boolean },
): SlackPayload {
  const relevant = releases.filter(hasRelevantChanges);
  const dependencyOnly = releases.filter((r) => !hasRelevantChanges(r));
  const packageSections = relevant.flatMap((release) =>
    splitIntoSlackSections(packageSummary(release)),
  );
  const dependencySections = dependencyOnly.length
    ? splitIntoSlackSections(dependencyOnlyLine(dependencyOnly))
    : [];
  const context =
    threaded && relevant.length
      ? [
          {
            type: "context",
            elements: [
              { type: "mrkdwn", text: "Full release notes in the thread." },
            ],
          },
        ]
      : [];

  return payload(
    title,
    [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: title.replace(/\*/g, ""),
          emoji: true,
        },
      },
      ...packageSections,
      ...dependencySections,
      ...context,
    ],
    channel,
  );
}

export function createThreadPayloads(
  releases: PackageRelease[],
  { channel }: { channel?: string } = {},
): SlackPayload[] {
  return releases.filter(hasRelevantChanges).flatMap((release) => {
    const label = `${release.name}@${release.version}`;
    const sections = splitIntoSlackSections(
      markdownToSlackMrkdwn(release.notes),
    );
    const pages: SlackSection[][] = [];
    for (let i = 0; i < sections.length; i += THREAD_SECTIONS_PER_MESSAGE) {
      pages.push(sections.slice(i, i + THREAD_SECTIONS_PER_MESSAGE));
    }
    const shown = pages.slice(0, THREAD_MAX_MESSAGES_PER_PACKAGE);
    const cut = pages.length > shown.length;

    return shown.map((page, i) => {
      const part = shown.length > 1 ? ` (${i + 1}/${shown.length})` : "";
      const blocks: unknown[] = [section(`*${escapeSlackText(label)}*${part}`)];
      blocks.push(...page);
      if (cut && i === shown.length - 1) {
        blocks.push(
          section(
            release.url
              ? `_Cut to fit Slack. <${release.url}|Read the full changelog>._`
              : "_Cut to fit Slack. Read the full changelog on GitHub._",
          ),
        );
      }
      return payload(`${label} release notes${part}`, blocks, channel);
    });
  });
}

export function changelogLinkFor({
  tag,
  relativeDir,
  githubReleases,
  env = process.env,
}: {
  tag?: string;
  relativeDir: string;
  githubReleases: boolean;
  env?: NodeJS.ProcessEnv;
}): string | null {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_SHA } = env;
  if (!GITHUB_SERVER_URL || !GITHUB_REPOSITORY) return null;
  const repo = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}`;
  if (tag && githubReleases) {
    return `${repo}/releases/tag/${encodeURIComponent(tag)}`;
  }
  const ref = tag ? encodeURIComponent(tag) : GITHUB_SHA;
  if (!ref) return null;
  return `${repo}/blob/${ref}/${relativeDir}/CHANGELOG.md`;
}

export async function readPackageRelease(
  pkg: Package,
  url: string | null,
): Promise<PackageRelease | null> {
  const { name, version } = pkg.packageJson;
  let changelog: string;
  try {
    changelog = await fs.readFile(path.join(pkg.dir, "CHANGELOG.md"), "utf8");
  } catch {
    core.error(
      `Error reading changelog for ${name}. Is the changelog file missing?`,
    );
    return null;
  }

  const entry = getChangelogEntry(changelog, version);
  if (!entry) {
    core.error(`Could not find changelog entry for ${name}@${version}`);
    return null;
  }

  return {
    name,
    version,
    changes: parseChangelogEntry(entry.content),
    notes: entry.content,
    url,
  };
}

export async function createSlackMessages(
  published: { pkg: Package; tag?: string }[],
  {
    title,
    channel,
    githubReleases = false,
    threaded = false,
  }: {
    title: string;
    channel?: string;
    githubReleases?: boolean;
    threaded?: boolean;
  },
): Promise<SlackMessages> {
  const releases = (
    await Promise.all(
      published.map(({ pkg, tag }) =>
        readPackageRelease(
          pkg,
          changelogLinkFor({
            tag,
            relativeDir: pkg.relativeDir,
            githubReleases,
          }),
        ),
      ),
    )
  ).filter((release): release is PackageRelease => release !== null);

  return {
    main: createMainPayload(releases, { title, channel, threaded }),
    thread: createThreadPayloads(releases, { channel }),
  };
}
