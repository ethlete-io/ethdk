# Changesets GitHub Action

> [!NOTE]
> Vendored from [`changesets/action`](https://github.com/changesets/action) at `0138f456ec3d73906fcd11169ce59502d8d241c1` (v2.1.2), plus the Slack release notification (`src/slack*.ts`, the `slack-title`, `slack-channel` and `slack-token` inputs, the `slack-payload` output; see [Slack release notification](#slack-release-notification)), first added in the former `TomTomB/changesets-action` fork. `.github/workflows/publish.yml` builds it with `nx build changesets-action` and runs it from `dist/`. Keep upstream's formatting (the folder is Prettier-ignored) so upstream commits still apply.

## Slack release notification

After a publish, the action builds a short main message and one detailed reply per package:

- **Main message**: per released package its name, version and at most three highlights, read from the package's new `CHANGELOG.md` entry. Breaking changes come first (a `### Major Changes` entry, or any entry that starts with `Breaking:`), then minors, then patches. `Updated dependencies` and `Internal …` / `no behaviour change` entries are never picked or counted. Then `+N more changes` and a link to the full changelog: the GitHub release when `create-github-releases` is on, otherwise `CHANGELOG.md` on the tag (or the commit). A package with a breaking change shows a `:rotating_light: N breaking changes` marker, and each breaking highlight a `:warning: Breaking:` prefix. Packages released only for dependency bumps share one line.
- **Thread**: the full changelog entry of each package, posted with `thread_ts` as replies to the main message. A long entry is split into sections of at most 3,000 characters, ten sections per reply, at most five replies per package; the last one then links the full changelog.

Posting needs `slack-token`: a Slack **bot** token (`xoxb-…`) with the `chat:write` scope whose app is a member of `slack-channel` (the Web API's `chat.postMessage`; an incoming webhook cannot reply in a thread). Without `slack-token` the action posts nothing and only sets `slack-payload` to the main message. Any Slack error (building or posting) is logged as a warning and never fails the publish.

Preview the message for the pending changesets (`.changeset/*.md` minus the ones `pre.json` already released) without posting anything:

```bash
yarn workspace changesets-action slack:dry-run          # rendered text
yarn workspace changesets-action slack:dry-run --json   # the chat.postMessage payloads
```

`SLACK_TITLE` sets the header. Links point at `origin`'s GitHub repository.

> [!IMPORTANT]
> This is the development branch for `changesets/action` v2 compatible with Changesets v3. For the v1 code compatible with Changesets v2, check out the [`maintenance/v1`](https://github.com/changesets/action/tree/maintenance/v1) branch.

This repo contains a collection of GitHub Actions for [Changesets](https://changesets.dev). Check out the [Automating Changesets](https://changesets.dev/guide/automating) guide to learn how to use these actions to automate your workflow.

- [changesets/action](./README.md): (This README. See below for details.)
- [changesets/action/select-mode](./select-mode/README.md): Select the mode to run a Changesets workflow.
- [changesets/action/version](./version/README.md): Version packages and create or update a pull request with the changes.
- [changesets/action/pack](./pack/README.md): Pack publishable packages into tarballs.
- [changesets/action/publish](./publish/README.md): Publish packages to npm.
- [changesets/action/pr-status](./pr-status/README.md): Generate changeset status in PRs.
- [changesets/action/pr-comment](./pr-comment/README.md): Create or update comments on PRs.

## changesets/action

This action handles versioning and publishing of packages. It's the equivalent of setting up the `changesets/action/select-mode`, `changesets/action/version`, and `changesets/action/publish` actions in a workflow, but with the required permissions combined.

If using [trusted publishing](https://docs.npmjs.com/trusted-publishers), it's recommended to set up the individual sub-actions instead to tighten publish permissions.

### Requirements

- Needs repo checked out and `@changesets/cli` installed
- [Job permissions][job-permissions]:
  - `contents: write`: to commit version changes
  - `pull-requests: write`: to create pull request
  - `id-token: write`: if using [trusted publishing](https://docs.npmjs.com/trusted-publishers)
- [Workflow triggers][workflow-triggers]: _any_

> [!NOTE]
> In your repository settings, in `Actions > General`, also ensure the `Allow GitHub Actions to create and approve pull requests` option is enabled

### Usage

> [!TIP]
> Check out [the docs](https://changesets.dev/guide/automating#how-do-i-run-the-version-and-publish-commands) to learn how to set up the version and publish workflow.

> [!IMPORTANT]
> To use a custom GitHub token, pass it explicitly through the `github-token` input:
>
> ```yaml
> with:
>   github-token: ${{ secrets.CUSTOM_GITHUB_TOKEN }}
> ```
>
> Setting the `GITHUB_TOKEN` environment variable does not configure the action. This applies whether release changes are pushed using the GitHub API or the Git CLI.

### API

<!-- api-start -->

| Inputs                   | Description                                                                                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github-token`           | The GitHub token to use for authentication. Defaults to the GitHub-provided token. To use a custom token, pass it explicitly to this input.                                                                                                               |
| `publish-script`         | The command to use to build and publish packages                                                                                                                                                                                                          |
| `version-script`         | The command to update version, edit CHANGELOG, read and delete changesets. Default to `changeset version` if not provided                                                                                                                                 |
| `commit-message`         | The commit message. Default to `Version Packages`                                                                                                                                                                                                         |
| `pr-title`               | The pull request title. Default to `Version Packages`                                                                                                                                                                                                     |
| `pr-draft`               | Controls draft PR behavior. Use 'create' to create new version PRs as draft, or 'always' to also convert existing version PRs back to draft when updating them.                                                                                           |
| `pr-base-branch`         | Sets the base branch of the PR. Defaults to `github.ref_name`.                                                                                                                                                                                            |
| `create-github-releases` | Whether to create Github releases after publish                                                                                                                                                                                                           |
| `push-git-tags`          | Whether to create git tags after publish. If `create-github-releases` is set to `true`, this option will also always be `true`.                                                                                                                           |
| `push-with-git-cli`      | Whether to use the Git CLI instead of the GitHub API to push release commits and tags. Defaults to `false`. When using the GitHub API, commits and tags are signed using GitHub's GPG key and attributed to the user or app that owns the `github-token`. |
| `slack-title`            | The title shown in the Slack release notification. Defaults to `New Release`                                                                                                                                                                              |
| `slack-token`            | A Slack bot token with the `chat:write` scope. When set, the action posts the release message and each package's full notes as replies in its thread. A Slack failure only logs a warning.                                                                |
| `slack-channel`          | The Slack channel ID or name to post the release notification to (e.g. `C1234567890` or `#releases`). If not set, the channel must be configured in the Slack app or workflow.                                                                            |
| `cwd`                    | The working directory to execute Changesets in. Defaults to the root of the repository.                                                                                                                                                                   |

| Outputs              | Description                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `published`          | A "true" or "false" string value to indicate whether a publishing is happened or not                                                             |
| `published-packages` | A JSON array to present the published packages. The format is `[{"name": "@xx/xx", "version": "1.2.0"}, {"name": "@xx/xy", "version": "0.8.9"}]` |
| `has-changesets`     | A "true" or "false" string value about whether there were changesets. Useful if you want to create your own publishing functionality.            |
| `pr-number`          | The pull request number that was created or updated                                                                                              |
| `slack-payload`      | The main Slack release message (channel, text, blocks) as a `chat.postMessage` payload, for posting it yourself. `null` when nothing was published. |

<!-- api-end -->

[job-permissions]: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idpermissions
[workflow-triggers]: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
