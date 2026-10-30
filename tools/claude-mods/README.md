# Claude Code mods

A local Claude Code plugin marketplace, `tom-mods`, for this team's own mods. Nothing here is published.

| Mod            | What it does                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `e2e-progress` | Shows the progress of a Playwright run log under `.claude/handoffs` in the status line and in a pane (`/e2e`). Reads the `@ethlete/cli` failure reporter's file if the log names it. |

Install, in Claude Code:

```
/plugin marketplace add ./tools/claude-mods
/plugin install e2e-progress@tom-mods
```

After an edit, bump `version` in the mod's `.claude-plugin/plugin.json` and reinstall it with `/plugin`.
