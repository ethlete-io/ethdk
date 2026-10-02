import type { Package } from "@manypkg/get-packages";
import { describe, expect, it, vi } from "vitest";
import {
  type PackageRelease,
  type ReleaseChange,
  changelogLinkFor,
  createChange,
  createMainPayload,
  createSlackMessages,
  createThreadPayloads,
  markdownToSlackMrkdwn,
  parseChangelogEntry,
  selectHighlights,
  splitText,
  truncateHighlight,
} from "./slack.ts";
import { postSlackMessages } from "./slack-post.ts";
import { testdir } from "./test-utils.ts";

vi.mock("@actions/core", () => ({ error: vi.fn(), warning: vi.fn() }));

const texts = (blocks: unknown[]) =>
  blocks.map((block) => (block as { text?: { text: string } }).text?.text);

const release = (
  overrides: Partial<PackageRelease> & { changes: ReleaseChange[] },
): PackageRelease => ({
  name: "pkg-a",
  version: "1.1.0",
  notes: "",
  url: "https://example.com/pkg-a",
  ...overrides,
});

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

  it("escapes the characters Slack reserves", () => {
    expect(markdownToSlackMrkdwn("a `</script>` & <b>")).toBe(
      "a `&lt;/script&gt;` &amp; &lt;b&gt;",
    );
  });
});

describe("parseChangelogEntry", () => {
  it("reads one change per bullet with its level and continuation lines", () => {
    expect(
      parseChangelogEntry(
        [
          "### Major Changes",
          "",
          "- Removed `x`.",
          "### Minor Changes",
          "",
          "- Breaking: renamed `y`.",
          "- Added z",
          "  with more detail",
          "### Patch Changes",
          "",
          "- Updated dependencies:",
          "  - pkg-b@1.0.0",
        ].join("\n"),
      ),
    ).toEqual([
      { level: "major", summary: "Removed `x`.", breaking: true },
      { level: "minor", summary: "Breaking: renamed `y`.", breaking: true },
      { level: "minor", summary: "Added z\nwith more detail", breaking: false },
      {
        level: "patch",
        summary: "Updated dependencies:\n- pkg-b@1.0.0",
        breaking: false,
      },
    ]);
  });
});

describe("selectHighlights", () => {
  it("picks breaking changes first, then minors, then patches, in source order", () => {
    const changes = [
      createChange("patch", "patch 1"),
      createChange("minor", "minor 1"),
      createChange("patch", "patch 2"),
      createChange("minor", "Breaking: minor 2"),
      createChange("major", "major 1"),
      createChange("minor", "minor 3"),
    ];
    const { highlights, remaining } = selectHighlights(changes);
    expect(highlights.map((c) => c.summary)).toEqual([
      "Breaking: minor 2",
      "major 1",
      "minor 1",
    ]);
    expect(remaining).toBe(3);
  });

  it("skips dependency bumps and internal changes and does not count them", () => {
    const changes = [
      createChange("patch", "Updated dependencies:\n- pkg-b@1.0.0"),
      createChange("patch", "Internal cleanup; no behaviour change."),
      createChange("patch", "Fix the thing"),
    ];
    expect(selectHighlights(changes)).toEqual({
      highlights: [changes[2]],
      remaining: 0,
    });
  });
});

describe("truncateHighlight", () => {
  it("keeps the first line and cuts long ones at a sentence or word", () => {
    expect(truncateHighlight("Short.\nMore detail")).toBe("Short.");
    const sentence = `${"a".repeat(80)}. ${"b ".repeat(100)}`;
    expect(truncateHighlight(sentence)).toBe(`${"a".repeat(80)}.`);
    const words = "word ".repeat(60);
    const cut = truncateHighlight(words, 50);
    expect(cut.length).toBeLessThanOrEqual(50);
    expect(cut.endsWith("word…")).toBe(true);
  });

  it("never leaves an inline code span open", () => {
    const cut = truncateHighlight(
      `${"x ".repeat(40)}\`${"y ".repeat(40)}\``,
      100,
    );
    expect((cut.match(/`/g) ?? []).length % 2).toBe(0);
  });
});

describe("splitText", () => {
  it("splits at newlines, then spaces, then hard", () => {
    expect(splitText("aaa\nbbb\nccc", 8)).toEqual(["aaa\nbbb", "ccc"]);
    expect(splitText("aaa bbb ccc", 8)).toEqual(["aaa bbb", "ccc"]);
    expect(splitText("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });
});

describe("createMainPayload", () => {
  it("shows at most three highlights, a counter, a link and a breaking marker", () => {
    const payload = createMainPayload(
      [
        release({
          changes: [
            createChange("patch", "Fix a"),
            createChange("patch", "Fix b"),
            createChange("major", "Remove c"),
            createChange("minor", "Add d"),
            createChange("patch", "Updated dependencies:\n- x@1"),
          ],
        }),
        release({
          name: "pkg-b",
          version: "2.0.1",
          url: null,
          changes: [createChange("patch", "Updated dependencies:\n- x@1")],
        }),
      ],
      { title: "*Release*", channel: "C123", threaded: true },
    );

    expect(payload.channel).toBe("C123");
    expect(payload.blocks[0]).toEqual({
      type: "header",
      text: { type: "plain_text", text: "Release", emoji: true },
    });
    expect(texts(payload.blocks.slice(1, 3))).toEqual([
      [
        "*pkg-a* `1.1.0`  :rotating_light: *1 breaking change*",
        "• :warning: *Breaking:* Remove c",
        "• Add d",
        "• Fix a",
        "_+1 more change_ · <https://example.com/pkg-a|Full changelog>",
      ].join("\n"),
      "_Dependency updates only:_ pkg-b 2.0.1",
    ]);
    expect(payload.blocks.at(-1)).toMatchObject({ type: "context" });
  });

  it("omits the channel and the thread hint when not needed", () => {
    const payload = createMainPayload([], { title: "Release" });
    expect(payload).not.toHaveProperty("channel");
    expect(payload.blocks).toHaveLength(1);
  });

  it("stays within 50 blocks however many packages are released", () => {
    const releases = Array.from({ length: 80 }, (_, i) =>
      release({
        name: `pkg-${i}`,
        changes: [createChange("patch", "x".repeat(2900))],
      }),
    );
    expect(
      createMainPayload(releases, { title: "Release" }).blocks.length,
    ).toBeLessThanOrEqual(50);
  });
});

describe("createThreadPayloads", () => {
  it("posts one reply per package with notes, none for dependency-only packages", () => {
    const replies = createThreadPayloads([
      release({
        notes: "### Patch Changes\n\n- Fix a",
        changes: [createChange("patch", "Fix a")],
      }),
      release({
        name: "pkg-b",
        changes: [createChange("patch", "Updated dependencies:")],
      }),
    ]);
    expect(replies).toHaveLength(1);
    expect(texts(replies[0].blocks)).toEqual([
      "*pkg-a@1.1.0*",
      "*Patch Changes*\n\n• Fix a",
    ]);
  });

  it("splits long notes into numbered replies and cuts after five", () => {
    const notes = Array.from(
      { length: 200 },
      (_, i) => `- ${String(i).padEnd(1400, "x")}`,
    ).join("\n");
    const replies = createThreadPayloads([
      release({ notes, changes: [createChange("patch", "Fix a")] }),
    ]);
    expect(replies).toHaveLength(5);
    expect(replies.map((r) => r.text)).toEqual(
      [1, 2, 3, 4, 5].map((n) => `pkg-a@1.1.0 release notes (${n}/5)`),
    );
    for (const reply of replies) {
      expect(reply.blocks.length).toBeLessThanOrEqual(50);
      for (const text of texts(reply.blocks)) {
        expect(text!.length).toBeLessThanOrEqual(3000);
      }
      expect(JSON.stringify(reply.blocks).length).toBeLessThan(40000);
    }
    expect(texts(replies[4].blocks).at(-1)).toBe(
      "_Cut to fit Slack. <https://example.com/pkg-a|Read the full changelog>._",
    );
  });
});

describe("changelogLinkFor", () => {
  const env = {
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_REPOSITORY: "org/repo",
    GITHUB_SHA: "abc",
  };

  it("links the GitHub release when the action creates one", () => {
    expect(
      changelogLinkFor({
        tag: "@s/a@1.0.0",
        relativeDir: "libs/a",
        githubReleases: true,
        env,
      }),
    ).toBe("https://github.com/org/repo/releases/tag/%40s%2Fa%401.0.0");
  });

  it("links the changelog on the tag, or on the commit without a tag", () => {
    expect(
      changelogLinkFor({
        tag: "a@1.0.0",
        relativeDir: "libs/a",
        githubReleases: false,
        env,
      }),
    ).toBe("https://github.com/org/repo/blob/a%401.0.0/libs/a/CHANGELOG.md");
    expect(
      changelogLinkFor({ relativeDir: "libs/a", githubReleases: true, env }),
    ).toBe("https://github.com/org/repo/blob/abc/libs/a/CHANGELOG.md");
    expect(
      changelogLinkFor({
        relativeDir: "libs/a",
        githubReleases: true,
        env: {},
      }),
    ).toBeNull();
  });
});

describe("createSlackMessages", () => {
  it("reads each package's changelog entry and skips missing ones", async () => {
    await using fixture = await testdir({
      "pkg-a/CHANGELOG.md":
        "# pkg-a\n\n## 1.1.0\n\n### Minor Changes\n\n- Added **x**\n\n## 1.0.0\n\n- old\n",
    });
    const pkg = (name: string, version: string) =>
      ({
        dir: fixture.getPath(name),
        relativeDir: name,
        packageJson: { name, version },
      }) as Package;

    const { main, thread } = await createSlackMessages(
      [
        { pkg: pkg("pkg-a", "1.1.0"), tag: "pkg-a@1.1.0" },
        { pkg: pkg("pkg-b", "2.0.0") },
      ],
      { title: "Release", githubReleases: true },
    );

    expect(texts(main.blocks)[1]).toMatch(
      /^\*pkg-a\* `1\.1\.0`\n• Added \*x\*/,
    );
    expect(texts(thread[0].blocks)).toEqual([
      "*pkg-a@1.1.0*",
      "*Minor Changes*\n\n• Added *x*",
    ]);
  });
});

describe("postSlackMessages", () => {
  const messages = {
    main: createMainPayload([], { title: "Release" }),
    thread: [
      { ...createMainPayload([], { title: "a" }), text: "a" },
      { ...createMainPayload([], { title: "b" }), text: "b" },
    ],
  };

  it("posts the main message, then replies in its thread", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      bodies.push(JSON.parse(init!.body as string));
      return Response.json({ ok: true, ts: "111.222" });
    });

    const ok = await postSlackMessages(messages, {
      token: "xoxb",
      fetch,
      delayMs: 0,
    });

    expect(ok).toBe(true);
    expect(bodies.map((b) => [b.text, b.thread_ts])).toEqual([
      ["Release", undefined],
      ["a", "111.222"],
      ["b", "111.222"],
    ]);
  });

  it("never throws when Slack fails", async () => {
    const failing = vi.fn(async () =>
      Response.json({ ok: false, error: "not_in_channel" }),
    );
    await expect(
      postSlackMessages(messages, {
        token: "xoxb",
        fetch: failing,
        delayMs: 0,
      }),
    ).resolves.toBe(false);
    expect(failing).toHaveBeenCalledTimes(1);

    const throwing = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(
      postSlackMessages(messages, {
        token: "xoxb",
        fetch: throwing,
        delayMs: 0,
      }),
    ).resolves.toBe(false);
  });

  it("keeps posting replies after one fails", async () => {
    let call = 0;
    const fetch = vi.fn(async () =>
      call++ === 1
        ? Response.json({ ok: false, error: "msg_too_long" })
        : Response.json({ ok: true, ts: "1.2" }),
    );
    await expect(
      postSlackMessages(messages, { token: "xoxb", fetch, delayMs: 0 }),
    ).resolves.toBe(false);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
