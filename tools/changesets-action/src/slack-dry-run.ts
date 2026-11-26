import { execFileSync } from "node:child_process";
import path from "node:path";
import { getReleasePlan } from "@changesets/get-release-plan";
import type { ReleasePlan } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import {
  type ChangeLevel,
  type PackageRelease,
  changelogLinkFor,
  createChange,
  createMainPayload,
  createThreadPayloads,
} from "./slack.ts";

const LEVELS: ChangeLevel[] = ["major", "minor", "patch"];
const HEADINGS: Record<ChangeLevel, string> = {
  major: "Major Changes",
  minor: "Minor Changes",
  patch: "Patch Changes",
};

function githubEnv(cwd: string): NodeJS.ProcessEnv {
  if (process.env.GITHUB_REPOSITORY) return process.env;
  const remote = execFileSync("git", ["remote", "get-url", "origin"], {
    cwd,
    encoding: "utf8",
  }).trim();
  const repo = /github\.com[:/](.+?)(\.git)?$/.exec(remote)?.[1];
  return {
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_REPOSITORY: repo,
  };
}

function releasesFromPlan(
  plan: ReleasePlan,
  relativeDirs: Map<string, string>,
  env: NodeJS.ProcessEnv,
): PackageRelease[] {
  const changesetsById = new Map(plan.changesets.map((c) => [c.id, c]));
  return plan.releases
    .filter((release) => release.type !== "none")
    .filter((release) => relativeDirs.has(release.name))
    .map((release) => {
      const changes = release.changesets.flatMap((id) => {
        const changeset = changesetsById.get(id);
        const own = changeset?.releases.find((r) => r.name === release.name);
        if (!changeset || !own || own.type === "none") return [];
        return [createChange(own.type, changeset.summary)];
      });
      const notes = LEVELS.map((level) => {
        const lines = changes
          .filter((change) => change.level === level)
          .map((change) => `- ${change.summary.replace(/\n/g, "\n  ")}`);
        return lines.length
          ? `### ${HEADINGS[level]}\n\n${lines.join("\n")}`
          : "";
      })
        .filter(Boolean)
        .join("\n\n");
      return {
        name: release.name,
        version: release.newVersion,
        changes,
        notes,
        url: changelogLinkFor({
          tag: `${release.name}@${release.newVersion}`,
          relativeDir: relativeDirs.get(release.name)!,
          githubReleases: true,
          env,
        }),
      };
    });
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const cwd = path.resolve(args.find((arg) => !arg.startsWith("--")) ?? ".");
const title = process.env.SLACK_TITLE ?? "New Release";

const { packages } = await getPackages(cwd);
const relativeDirs = new Map(
  packages
    .filter((pkg) => !pkg.packageJson.private)
    .map((pkg) => [pkg.packageJson.name, pkg.relativeDir]),
);
const releases = releasesFromPlan(
  await getReleasePlan(cwd),
  relativeDirs,
  githubEnv(cwd),
);
const main = createMainPayload(releases, { title, threaded: true });
const thread = createThreadPayloads(releases);

if (json) {
  console.log(JSON.stringify({ main, thread }, null, 2));
} else {
  const render = (blocks: unknown[]) =>
    blocks
      .map((block) => {
        const b = block as {
          text?: { text: string };
          elements?: { text: string }[];
        };
        return b.text?.text ?? b.elements?.map((e) => e.text).join(" ") ?? "";
      })
      .join("\n\n");
  console.log("=== Main message ===\n");
  console.log(render(main.blocks));
  console.log(`\n=== Thread: ${thread.length} replies ===\n`);
  for (const reply of thread) {
    const chars = JSON.stringify(reply.blocks).length;
    console.log(
      `- ${reply.text} (${reply.blocks.length} blocks, ${chars} chars)`,
    );
  }
}
