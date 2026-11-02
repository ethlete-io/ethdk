#!/usr/bin/env python3
"""PreToolUse hook: git safety in a checkout several agents share.

Denies, for a Bash call:
- `git add -A`, `git add --all` and `git add .` (they stage other sessions' work)
- any `git stash`
- `git commit --amend`
- `git commit` without a ` -- <paths>` pathspec
- any `git add` or `git commit` whose paths name an `.ethlete/**/go.json` (a go is granted
  in Studio, never committed by an agent)

`git commit-tree` and `git update-index` stay allowed, so a merge commit built on a temporary
GIT_INDEX_FILE works. Commit messages (`-m`, `--message`) and other quoted text are ignored for
the command checks, so a message that mentions `git stash` does not trip the hook.

Can be disabled per machine via a gitignored ethlete-agents.config.local.json at the repo
root: {"disableHooks": true} or {"disableHooks": ["git-safety"]}.

Fail-safe: any error exits 0 with no output.
"""

import json
import os
import re
import sys

HOOK_NAME = "git-safety"
LOCAL_CONFIG_FILE = "ethlete-agents.config.local.json"

MESSAGE_ARG = re.compile(
    r"""(?:^|(?<=\s))(?:-[a-zA-Z]*m|--message)(?:=|\s*)(?:"(?:\\.|[^"\\])*"|'[^']*'|[^\s;&|]*)"""
)
SEGMENT_SPLIT = re.compile(r"[;&|\n]+")
GLOBAL_OPTS_WITH_VALUE = ("-C", "-c", "--git-dir", "--work-tree", "--namespace")
ADD_ALL = ("-A", "--all", ".")
GO_JSON = re.compile(r"(?:^|/)go\.json$")

def agent_name(argv):
    for index, arg in enumerate(argv):
        if arg == "--agent" and index + 1 < len(argv):
            return argv[index + 1]
        if arg.startswith("--agent="):
            return arg.split("=", 1)[1]
    return "claude"


def repo_root(data):
    for variable in ("CLAUDE_PROJECT_DIR", "CODEX_PROJECT_DIR"):
        value = os.environ.get(variable)
        if value:
            return value
    here = os.path.abspath(__file__)
    derived = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(here))))
    if os.path.isfile(os.path.join(derived, LOCAL_CONFIG_FILE)):
        return derived
    cwd = data.get("cwd")
    return cwd if isinstance(cwd, str) and cwd else derived


def load_local_config(root):
    if not root:
        return {}
    try:
        with open(os.path.join(root, LOCAL_CONFIG_FILE), encoding="utf-8") as f:
            config = json.load(f)
    except (OSError, ValueError, AttributeError):
        return {}
    return config if isinstance(config, dict) else {}


def disabled_locally(config):
    disabled = config.get("disableHooks")
    return disabled is True or (isinstance(disabled, list) and HOOK_NAME in disabled)


def git_calls_in(command):
    """Yield (subcommand, args) for every command-position git call in the shell string."""
    stripped = MESSAGE_ARG.sub(" ", command)
    unquoted = stripped.replace('"', " ").replace("'", " ")
    for segment in SEGMENT_SPLIT.split(unquoted):
        words = segment.split()
        index = 0
        while index < len(words) and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", words[index]):
            index += 1
        if index < len(words) and (words[index] == "git" or words[index].endswith("/git")):
            rest = words[index + 1 :]
            while rest and rest[0].startswith("-"):
                skip = 2 if rest[0] in GLOBAL_OPTS_WITH_VALUE else 1
                rest = rest[skip:]
            if rest:
                yield rest[0], rest[1:]


def violation_in(command):
    """(rule, allowed form) for the first forbidden git call, or None."""
    for sub, args in git_calls_in(command):
        if sub == "add":
            if any(arg in ADD_ALL for arg in args):
                return (
                    "`git add -A`, `--all` and `.` stage other sessions' work",
                    "stage named paths: `git add <path> ...`, or skip staging and use `git commit -m \"...\" -- <paths>`",
                )
        if sub == "stash":
            return (
                "`git stash` hides other sessions' uncommitted work",
                "leave the working tree alone; commit your own paths with `git commit -m \"...\" -- <paths>`",
            )
        if sub == "commit":
            if "--amend" in args:
                return (
                    "`git commit --amend` rewrites a commit another session may have built on",
                    "make a new commit: `git commit -m \"...\" -- <paths>`",
                )
            if "--" not in args:
                return (
                    "`git commit` without a pathspec commits everything staged, including other sessions' work",
                    "name the paths: `git commit -m \"...\" -- <paths>`",
                )
        if sub in ("add", "commit") and any(GO_JSON.search(arg) for arg in args):
            return (
                "an agent never stages or commits a `go.json`; a go is granted in Studio",
                "leave `go.json` out of the paths",
            )
    return None


def reason_for(rule, allowed):
    return f"Denied: {rule}. Allowed form: {allowed}."


def main():
    if agent_name(sys.argv[1:]) != "claude":
        return

    data = json.load(sys.stdin)

    if data.get("tool_name") != "Bash":
        return

    tool_input = data.get("tool_input")
    command = tool_input.get("command") if isinstance(tool_input, dict) else None

    if not isinstance(command, str):
        return

    if disabled_locally(load_local_config(repo_root(data))):
        return

    found = violation_in(command)

    if not found:
        return

    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason_for(*found),
                }
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
