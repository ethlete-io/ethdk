import type { Package } from "@manypkg/get-packages";
import { describe, expect, it, vi } from "vitest";
import { createSlackPayload, markdownToSlackMrkdwn } from "./slack.ts";
import { testdir } from "./test-utils.ts";

vi.mock("@actions/core", () => ({ error: vi.fn() }));

describe("markdownToSlackMrkdwn", () => {
  it("converts headings, emphasis, links and lists but leaves code alone", () => {
    expect(
      markdownToSlackMrkdwn(
        [
          "### Minor Changes",
          "- **bold** and *italic* and ~~gone~~",
          "- [PR](https://example.com) and `**not bold**`",
          "```ts",
          "const a = **b**;",
          "```",
        ].join("\n"),
      ),
    ).toBe(
      [
        "*Minor Changes*",
        "• *bold* and _italic_ and ~gone~",
        "• <https://example.com|PR> and `**not bold**`",
        "```ts",
        "const a = **b**;",
        "```",
      ].join("\n"),
    );
  });
});

describe("createSlackPayload", () => {
  it("builds a header plus one block group per released package", async () => {
    await using fixture = await testdir({
      "pkg-a/CHANGELOG.md":
        "# pkg-a\n\n## 1.1.0\n\n### Minor Changes\n\n- Added **x**\n\n## 1.0.0\n\n- old\n",
    });
    const pkg = {
      dir: fixture.getPath("pkg-a"),
      relativeDir: "pkg-a",
      packageJson: { name: "pkg-a", version: "1.1.0" },
    } as Package;
    const missing = {
      dir: fixture.getPath("pkg-b"),
      relativeDir: "pkg-b",
      packageJson: { name: "pkg-b", version: "2.0.0" },
    } as Package;

    const payload = await createSlackPayload([pkg, missing], {
      title: "Release",
      channel: "C123",
    });

    expect(payload).toEqual({
      channel: "C123",
      unfurl_links: false,
      unfurl_media: false,
      text: "Release",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Release", emoji: true },
        },
        { type: "divider" },
        { type: "section", text: { type: "mrkdwn", text: "*pkg-a@1.1.0*" } },
        {
          type: "section",
          text: { type: "mrkdwn", text: "*Minor Changes*\n\n• Added *x*" },
        },
      ],
    });
  });

  it("omits the channel when none is given", async () => {
    const payload = await createSlackPayload([], { title: "Release" });
    expect(payload).not.toHaveProperty("channel");
  });

  it("keeps every package title and cuts the notes to 50 blocks", async () => {
    const longNotes = Array.from(
      { length: 40 },
      (_, i) => `- ${String(i).padEnd(2990, "x")}`,
    ).join("\n");
    const changelog = (name: string) =>
      `# ${name}\n\n## 1.0.0\n\n${longNotes}\n`;
    await using fixture = await testdir({
      "pkg-a/CHANGELOG.md": changelog("pkg-a"),
      "pkg-b/CHANGELOG.md": changelog("pkg-b"),
    });
    const pkgs = ["pkg-a", "pkg-b"].map(
      (name) =>
        ({
          dir: fixture.getPath(name),
          relativeDir: name,
          packageJson: { name, version: "1.0.0" },
        }) as Package,
    );
    vi.stubEnv("GITHUB_SERVER_URL", "https://github.com");
    vi.stubEnv("GITHUB_REPOSITORY", "org/repo");
    vi.stubEnv("GITHUB_SHA", "abc");

    const { blocks } = await createSlackPayload(pkgs, { title: "Release" });
    vi.unstubAllEnvs();

    expect(blocks).toHaveLength(50);
    const texts = blocks.map(
      (block) => (block as { text?: { text: string } }).text?.text,
    );
    expect(texts).toContain("*pkg-a@1.0.0*");
    expect(texts).toContain("*pkg-b@1.0.0*");
    expect(texts.at(-1)).toBe(
      "_Cut to fit Slack. Full notes: <https://github.com/org/repo/blob/abc/pkg-a/CHANGELOG.md|pkg-a>, <https://github.com/org/repo/blob/abc/pkg-b/CHANGELOG.md|pkg-b>_",
    );
  });
});
