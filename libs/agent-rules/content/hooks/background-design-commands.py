#!/usr/bin/env python3
"""PreToolUse hook: long design commands and wait loops run in the background.

`design check`, `design compare`, `design ready`, `design sketch ready`, `design harness`
and the `studio:e2e` target each take minutes. A `--help` or `-h`
call of a `design` command only prints usage and passes; `studio:e2e --help` runs the suite. In the foreground
they block the whole session, so a Bash call that runs one without `run_in_background: true`
is allowed with that flag set, and the agent reads the output when the completion notice arrives.

A wait loop gets the same flag: an `until` or `while` loop whose body runs `sleep`. In the
foreground it holds the session for the whole wait and ends at the Bash timeout.

Matches the `yarn design ...`, `node dist/libs/cli/src/index.js design ...` and
`npx nx ... studio:e2e` forms at command position only. Quoted text, heredoc bodies and
arguments of other commands (`echo`, `git commit`, `grep`) are ignored, so free text that
mentions a command does not trip the hook.

Can be disabled per machine via a gitignored ethlete-agents.config.local.json at the repo
root: {"disableHooks": true} or {"disableHooks": ["background-design-commands"]}.

Fail-safe: any error exits 0 with no output.
"""

import json
import os
import re
import sys

HOOK_NAME = "background-design-commands"
LOCAL_CONFIG_FILE = "ethlete-agents.config.local.json"

LONG_COMMANDS = (
    ("design check", re.compile(r"\bdesign\s+check(?=\s|$)")),
    ("design compare", re.compile(r"\bdesign\s+compare(?=\s|$)")),
    ("design ready", re.compile(r"\bdesign\s+ready(?=\s|$)")),
    ("design sketch ready", re.compile(r"\bdesign\s+sketch\s+ready(?=\s|$)")),
    ("design harness", re.compile(r"\bdesign\s+harness(?=\s|$)")),
    ("studio:e2e", re.compile(r"studio:e2e(?=\s|$|:)")),
)

LAUNCHERS = frozenset(
    ("yarn", "npx", "pnpm", "pnpx", "npm", "node", "nx", "bun", "bunx", "et", "ethlete-agents", "bash", "sh", "zsh", "time", "env", "nohup", "timeout", "sudo", "exec", "xargs")
)

QUOTED = re.compile(r"\"(?:\\.|[^\"\\])*\"|'[^']*'")
HEREDOC = re.compile(r"<<-?\s*(?:\"(\w+)\"|'(\w+)'|\\?(\w+))")
SEPARATORS = re.compile(r"&&|\|\||[;&|\n(){}`]")
ASSIGNMENT = re.compile(r"^[A-Za-z_]\w*=")
HELP_PRINTS_USAGE = frozenset(("design check", "design compare", "design ready", "design sketch ready", "design harness"))
HELP_FLAG = re.compile(r"(?:^|\s)(?:--help|-h)(?=\s|$)")
WAIT_LOOP = "wait loop"
LOOP_KEYWORDS = frozenset(("until", "while"))
LOOP_BODY_KEYWORDS = frozenset(("do", "then", "else"))


def without_heredoc_bodies(command):
    lines = command.split("\n")
    kept = []
    delimiter = None
    for line in lines:
        if delimiter is not None:
            if line.strip() == delimiter:
                delimiter = None
            continue
        kept.append(line)
        match = HEREDOC.search(line)
        if match:
            delimiter = match.group(1) or match.group(2) or match.group(3)
    return "\n".join(kept)


def command_segments(command):
    """The shell string split into simple commands, with heredoc bodies and quoted text removed."""
    text = QUOTED.sub(" ", without_heredoc_bodies(command))
    text = text.replace("$(", ";")
    return [segment.strip() for segment in SEPARATORS.split(text) if segment.strip()]


def at_command_position(segment):
    words = [word for word in segment.split() if not ASSIGNMENT.match(word)]
    return bool(words) and os.path.basename(words[0]) in LAUNCHERS


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


def long_command_in(command):
    """The name of the first long command the shell string runs at a command position, or None."""
    for segment in command_segments(command):
        if not at_command_position(segment):
            continue
        for name, pattern in LONG_COMMANDS:
            if pattern.search(segment) and not (name in HELP_PRINTS_USAGE and HELP_FLAG.search(segment)):
                return name
    return None


def command_words(segment):
    words = [word for word in segment.split() if not ASSIGNMENT.match(word)]
    while words and words[0] in LOOP_BODY_KEYWORDS:
        words = words[1:]
    return words


def wait_loop_in(command):
    """True when the shell string runs an `until` or `while` loop that sleeps."""
    loop_open = False
    for segment in command_segments(command):
        words = command_words(segment)
        if not words:
            continue
        if words[0] in LOOP_KEYWORDS:
            loop_open = True
            words = words[1:]
        if loop_open and words and os.path.basename(words[0]) == "sleep":
            return True
        if words and words[0] == "done":
            loop_open = False
    return False


def reason_for(name):
    if name == WAIT_LOOP:
        return (
            "A loop that sleeps until a condition holds blocks the session, so this call runs with "
            "`run_in_background: true`. Go on with other work; the completion notice wakes you."
        )
    return (
        f"`{name}` takes minutes, so this call runs with `run_in_background: true`. "
        "Read its output when the completion notice arrives; pass the flag yourself next time."
    )


def main():
    if agent_name(sys.argv[1:]) != "claude":
        return

    data = json.load(sys.stdin)

    if data.get("tool_name") != "Bash":
        return

    tool_input = data.get("tool_input")

    if not isinstance(tool_input, dict) or tool_input.get("run_in_background") is True:
        return

    command = tool_input.get("command")

    if not isinstance(command, str):
        return

    if disabled_locally(load_local_config(repo_root(data))):
        return

    name = long_command_in(command) or (WAIT_LOOP if wait_loop_in(command) else None)

    if not name:
        return

    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "allow",
                    "permissionDecisionReason": reason_for(name),
                    "updatedInput": {**tool_input, "run_in_background": True},
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
