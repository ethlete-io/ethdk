import * as core from "@actions/core";
import { GitHub } from "./github.ts";
import { planRun } from "./plan.ts";
import readChangesetState from "./readChangesetState.ts";
import { runPublish, runVersion } from "./run.ts";
import { postSlackMessages } from "./slack-post.ts";
import {
  getOptionalInput,
  getRequiredInput,
  throwOnRemovedCommitModeInput,
  throwOnRenamedInputs,
  validateChangesetsCliVersion,
} from "./utils.ts";

try {
  await main();
} catch (err) {
  core.setFailed((err as Error).message);
}

async function main() {
  const cwd = getOptionalInput("cwd") || process.cwd();
  await validateChangesetsCliVersion(cwd);

  throwOnRenamedInputs({
    publish: "publish-script",
    version: "version-script",
    commit: "commit-message",
    title: "pr-title",
    branch: "pr-base-branch",
    prDraft: "pr-draft",
    createGithubReleases: "create-github-releases",
    slackTitle: "slack-title",
    slackChannel: "slack-channel",
  });
  throwOnRemovedCommitModeInput();

  const githubToken = getRequiredInput("github-token");
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN !== githubToken) {
    throw new Error(
      'The GITHUB_TOKEN environment variable is set and does not match the "github-token" input. ' +
        'Please pass the custom GitHub token to the "github-token" input and ' +
        "remove the GITHUB_TOKEN environment variable to avoid conflicts.",
    );
  }

  const pushWithGitCli = core.getBooleanInput("push-with-git-cli");
  const prDraft = getOptionalInput("pr-draft");
  if (prDraft !== undefined && prDraft !== "always" && prDraft !== "create") {
    core.setFailed(`Invalid pr-draft: ${prDraft}`);
    return;
  }
  const github = new GitHub({
    cwd,
    githubToken,
    pushWithGitCli,
  });

  let { changesets } = await readChangesetState(cwd);

  let publishScript = core.getInput("publish-script");
  let hasChangesets = changesets.length !== 0;
  let hasPublishScript = !!publishScript;
  const plan = planRun({ changesets, hasPublishScript });

  core.setOutput("published", "false");
  core.setOutput("published-packages", "[]");
  core.setOutput("has-changesets", String(hasChangesets));
  core.setOutput("slack-payload", "null");

  let publishError: Error | undefined;

  if (plan.publish) {
    core.info("Attempting to publish any unpublished packages to npm");

    const createGithubReleases = core.getBooleanInput(
      "create-github-releases",
    );
    const pushGitTags = core.getBooleanInput("push-git-tags");
    if (createGithubReleases && !pushGitTags) {
      throw new Error(
        "The input 'create-github-releases' is set to true, but 'push-git-tags' is set to false. " +
          "Creating GitHub releases requires pushing git tags. Please set 'push-git-tags' to true " +
          "or set 'create-github-releases' to false.",
      );
    }
    const slackChannel = getOptionalInput("slack-channel");
    let slackToken = getOptionalInput("slack-token");
    if (slackToken && !slackChannel) {
      core.warning("slack-token needs slack-channel; skipping the Slack post.");
      slackToken = undefined;
    }
    const result = await runPublish({
      script: publishScript,
      github,
      createGithubReleases,
      pushGitTags,
      cwd,
      slackTitle: getOptionalInput("slack-title"),
      slackChannel,
      slackThreaded: !!slackToken,
    });

    if (result.published) {
      core.setOutput("published", "true");
      core.setOutput(
        "published-packages",
        JSON.stringify(result.publishedPackages),
      );
      core.setOutput(
        "slack-payload",
        JSON.stringify(result.slackMessages?.main ?? null),
      );
      if (slackToken && result.slackMessages) {
        await postSlackMessages(result.slackMessages, { token: slackToken });
      }
    }

    if (result.exitCode !== 0) {
      publishError = new Error(
        `Publish command exited with code ${result.exitCode}${
          result.published
            ? `, but some packages were published: ${result.publishedPackages
                .map((p) => `${p.name}@${p.version}`)
                .join(", ")}`
            : ""
        }`,
      );
    }
  } else if (!hasChangesets) {
    core.info(
      "No changesets present or were removed by merging version PR. Not publishing because publish-script is not set.",
    );
  }

  if (plan.version) {
    const { pullRequestNumber } = await runVersion({
      script: getOptionalInput("version-script"),
      github,
      cwd,
      prTitle: getOptionalInput("pr-title"),
      commitMessage: getOptionalInput("commit-message"),
      hasPublishScript,
      prDraft,
      branch: getOptionalInput("pr-base-branch"),
    });

    core.setOutput("pr-number", String(pullRequestNumber));
  } else if (hasChangesets) {
    core.info("No changeset bumps a package. Not creating PR");
  }

  if (publishError) {
    throw publishError;
  }
}
