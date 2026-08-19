# Changesets

Read this fallback only when the repository has no more specific release workflow.

- Add a changeset for a consumer-visible change to a published package.
- Do not add one for formatting, comments, tests, or an internal refactor with no
  consumer-visible effect.
- Use `patch` for fixes, `minor` for backward-compatible API additions, and `major` for
  breaking API or behavior changes.
- Keep one logical release note focused. Split unrelated changes.
- Write the note for the package consumer: state what they now get, not how the change
  was implemented.
- Keep the note to one sentence, two at most, under 40 words.
- Do not run an interactive changeset command in a non-interactive agent environment;
  write the repository's changeset file format directly.

When a repository supplies its own release skill or policy, that local guidance wins.
