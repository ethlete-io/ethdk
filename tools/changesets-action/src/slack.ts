import fs from "node:fs/promises";
import path from "node:path";
import * as core from "@actions/core";
import type { Package } from "@manypkg/get-packages";
import { getChangelogEntry } from "./utils.ts";

type SlackSection = { type: "section"; text: { type: "mrkdwn"; text: string } };

const SLACK_SECTION_MAX_CHARACTERS = 3000;

export function markdownToSlackMrkdwn(markdown: string): string {
  const codeBlocks: string[] = [];
  let result = markdown.replace(/```[\s\S]*?```/g, (match) => {
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

export function splitIntoSlackSections(text: string): SlackSection[] {
  const blocks: SlackSection[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= SLACK_SECTION_MAX_CHARACTERS) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: remaining },
      });
      break;
    }
    const slice = remaining.slice(0, SLACK_SECTION_MAX_CHARACTERS);
    const splitAt = Math.max(slice.lastIndexOf("\n"), 1);
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: remaining.slice(0, splitAt).trimEnd() },
    });
    remaining = remaining.slice(splitAt).trimStart();
  }
  return blocks;
}

async function getPackageBlocks(pkg: Package) {
  const { name, version } = pkg.packageJson;
  let changelog: string;
  try {
    changelog = await fs.readFile(path.join(pkg.dir, "CHANGELOG.md"), "utf8");
  } catch {
    core.error(
      `Error reading changelog for ${name}. Is the changelog file missing?`,
    );
    return [];
  }

  const changelogEntry = getChangelogEntry(changelog, version);
  if (!changelogEntry) {
    core.error(`Could not find changelog entry for ${name}@${version}`);
    return [];
  }

  return [
    { type: "divider" } as const,
    {
      type: "section" as const,
      text: { type: "mrkdwn" as const, text: `*${name}@${version}*` },
    },
    ...splitIntoSlackSections(markdownToSlackMrkdwn(changelogEntry.content)),
  ];
}

export type SlackPayload = {
  channel?: string;
  unfurl_links: false;
  unfurl_media: false;
  text: string;
  blocks: unknown[];
};

export async function createSlackPayload(
  packages: Package[],
  { title, channel }: { title: string; channel?: string },
): Promise<SlackPayload> {
  const packageBlocks = (
    await Promise.all(packages.map(getPackageBlocks))
  ).flat();

  return {
    ...(channel ? { channel } : {}),
    unfurl_links: false,
    unfurl_media: false,
    text: title,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: title, emoji: true },
      },
      ...packageBlocks,
    ],
  };
}
