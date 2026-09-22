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
});
