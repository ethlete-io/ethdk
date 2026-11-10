#!/usr/bin/env python3
"""PreToolUse hook: git safety in a checkout several agents share.

Denies, for a Bash call:
- `git add -A`, `git add --all` and `git add .` (they stage other sessions' work)
- every `git stash` that writes (bare, `push`, `save`, `pop`, `apply`, `drop`, `clear`, `branch`,
  `create`, `store`); `git stash list` and `git stash show` stay allowed
- `git commit --amend`
- `git commit` without a ` -- <paths>` pathspec, except the commit that concludes a merge: while
  `MERGE_HEAD` exists and every staged path changed between HEAD and MERGE_HEAD or is conflicted

`git commit-tree` and `git update-index` stay allowed, so a merge commit built on a temporary
GIT_INDEX_FILE works. Only real command positions count: commit messages (`-m`, `--message`), quoted text and heredoc
bodies are ignored, so a grep pattern or message that mentions `git stash` does not trip the hook.

Can be disabled per machine via a gitignored ethlete-agents.config.local.json at the repo
root: {"disableHooks": true} or {"disableHooks": ["git-safety"]}.

Fail-safe: any error exits 0 with no output.
"""

import json
import os
import re
import subprocess
import sys

HOOK_NAME = "git-safety"
LOCAL_CONFIG_FILE = "ethlete-agents.config.local.json"

MESSAGE_ARG = re.compile(
    r"""(?:^|(?<=\s))(?:-[a-zA-Z]*m|--message)(?:=|\s*)(?:"(?:\\.|[^"\\])*"|'[^']*'|[^\s;&|]*)"""
)
SEGMENT_SPLIT = re.compile(r"[;&|\n()`]+")
HEREDOC = re.compile(r"<<-?[ \t]*(['\"]?)(\w+)\1([^\n]*)\n(?:.*?\n)?[ \t]*\2[ \t]*(?=\n|$)", re.DOTALL)
QUOTED = re.compile(r"\"(?:\\.|[^\"\\])*\"|'[^']*'")
GLOBAL_OPTS_WITH_VALUE = ("-C", "-c", "--git-dir", "--work-tree", "--namespace")
ADD_ALL = ("-A", "--all", ".")

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
    stripped = MESSAGE_ARG.sub(" ", HEREDOC.sub(r"<<\3", command))
    unquoted = QUOTED.sub(lambda m: re.sub(r"[\s;&|(`]", "_", m.group(0)[1:-1]), stripped)
    for segment in SEGMENT_SPLIT.split(unquoted):
        words = segment.split()
        index = 0
        while index < len(words) and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", words[index]):
            index += 1
        if index < len(words) and (words[index] == "git" or words[index].endswith("/git")):
            rest = words[index + 1 :]
            directory = None
            while rest and rest[0].startswith("-"):
                if rest[0] == "-C" and len(rest) > 1:
                    directory = rest[1]
                skip = 2 if rest[0] in GLOBAL_OPTS_WITH_VALUE else 1
                rest = rest[skip:]
            if rest:
                yield rest[0], rest[1:], directory


STASH_READS = ("list", "show")


def stash_subcommand_of(args):
    """The stash subcommand `args` run; a bare `git stash` or one starting with an option is `push`."""
    return args[0] if args and not args[0].startswith("-") else "push"


def git_lines(cwd, *args):
    result = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=10, check=True)
    return {line for line in result.stdout.splitlines() if line}


def concludes_merge(cwd):
    """True while MERGE_HEAD exists and every staged path belongs to the merge. Any error is False."""
    try:
        merge_head = git_lines(cwd, "rev-parse", "--git-path", "MERGE_HEAD")
        if not merge_head or not os.path.isfile(os.path.join(cwd, next(iter(merge_head)))):
            return False
        staged = git_lines(cwd, "diff", "--cached", "--name-only")
        merge_paths = git_lines(cwd, "diff", "--name-only", "HEAD", "MERGE_HEAD") | git_lines(
            cwd, "diff", "--name-only", "--diff-filter=U"
        )
        return staged <= merge_paths
    except Exception:
        return False


def stages_everything(args):
    return any(arg == "--all" or re.fullmatch(r"-[a-zA-Z]*a[a-zA-Z]*", arg) for arg in args if arg != "--")


def violation_in(command, cwd=None):
    """(rule, allowed form) for the first forbidden git call, or None."""
    for sub, args, directory in git_calls_in(command):
        if sub == "add":
            if any(arg in ADD_ALL for arg in args):
                return (
                    "`git add -A`, `--all` and `.` stage other sessions' work",
                    "stage named paths: `git add <path> ...`, or skip staging and use `git commit -m \"...\" -- <paths>`",
                )
        if sub == "stash" and stash_subcommand_of(args) not in STASH_READS:
            return (
                f"`git stash {stash_subcommand_of(args)}` hides or rewrites other sessions' uncommitted work",
                "leave the working tree alone; commit your own paths with `git commit -m \"...\" -- <paths>`",
            )
        if sub == "commit":
            if "--amend" in args:
                return (
                    "`git commit --amend` rewrites a commit another session may have built on",
                    "make a new commit: `git commit -m \"...\" -- <paths>`",
                )
            if "--" not in args and not (
                not stages_everything(args)
                and concludes_merge(os.path.join(cwd or os.getcwd(), directory) if directory else cwd or os.getcwd())
            ):
                return (
                    "`git commit` without a pathspec commits everything staged, including other sessions' work",
                    "name the paths: `git commit -m \"...\" -- <paths>`",
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

    cwd = data.get("cwd")
    found = violation_in(command, cwd if isinstance(cwd, str) and cwd else None)

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
