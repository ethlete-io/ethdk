#!/usr/bin/env python3
"""PostToolUse hook: hold a changeset note to the bar the moment it is written.

`yarn lint:changesets` also runs in CI, but a failure there arrives long after the note was
written and the context that produced it is gone. This runs the same script on the single file
that was just written or edited, so an over-long note comes straight back as feedback.

Exits 2 with the linter's output on stderr when the note violates the bar, which is what feeds
it back to the model. Any other situation - a non-changeset file, a missing linter, a crash -
exits 0: the hook must never block unrelated work.
"""

import json
import os
import subprocess
import sys

LINTER = "tools/scripts/lint-changesets.js"
WATCHED_TOOLS = ("Write", "Edit", "MultiEdit", "NotebookEdit")


def main() -> int:
    payload = json.load(sys.stdin)

    if payload.get("tool_name") not in WATCHED_TOOLS:
        return 0

    file_path = (payload.get("tool_input") or {}).get("file_path") or ""
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or os.getcwd()

    normalized = os.path.normpath(os.path.join(project_dir, file_path))
    changeset_dir = os.path.join(os.path.normpath(project_dir), ".changeset")

    if os.path.dirname(normalized) != changeset_dir or not normalized.endswith(".md"):
        return 0

    if os.path.basename(normalized) == "README.md":
        return 0

    linter = os.path.join(project_dir, LINTER)

    if not os.path.isfile(linter) or not os.path.isfile(normalized):
        return 0

    result = subprocess.run(
        ["node", linter, normalized],
        capture_output=True,
        text=True,
        cwd=project_dir,
        timeout=20,
    )

    if result.returncode == 0:
        return 0

    sys.stderr.write((result.stdout + result.stderr).strip() + "\n")

    return 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
