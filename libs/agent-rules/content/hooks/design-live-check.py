#!/usr/bin/env python3
"""PostToolUse hook: each design file the agent writes gets the design check's findings at once.

After an Edit, Write or MultiEdit of a `.ts`, `.css` or `.html` file under `.ethlete/design/`, it runs
`et design lint <file>`: the static design rules of the file's part or sketch variant, and eslint on it.
No draw, no type check. A finding comes back to the agent as a blocking message, one line each, so it fixes
the file before it hands the design to a human. A clean file stays silent.

It runs `et` the way the repo's `ethlete-design` MCP server in `.mcp.json` does, with `lint` in place
of `mcp`, else `node_modules/.bin/et`. A repo with neither gets no check.

Can be disabled per machine via a gitignored ethlete-agents.config.local.json at the repo
root: {"disableHooks": true} or {"disableHooks": ["design-live-check"]}.

Fail-safe: any error exits 0 with no output.
"""

import json
import os
import subprocess
import sys

HOOK_NAME = "design-live-check"
LOCAL_CONFIG_FILE = "ethlete-agents.config.local.json"
TOOLS = frozenset(("Edit", "Write", "MultiEdit"))
DESIGN_DIR = os.path.join(".ethlete", "design")
CHECKED_EXTENSIONS = (".ts", ".mts", ".css", ".html")
RUN_SECONDS = 50


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
    cwd = data.get("cwd")
    return cwd if isinstance(cwd, str) and cwd else os.getcwd()


def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            value = json.load(f)
    except (OSError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


def disabled_locally(root):
    disabled = load_json(os.path.join(root, LOCAL_CONFIG_FILE)).get("disableHooks")
    return disabled is True or (isinstance(disabled, list) and HOOK_NAME in disabled)


def design_file_of(root, path):
    if not isinstance(path, str) or not path.endswith(CHECKED_EXTENSIONS):
        return None
    file = os.path.normpath(os.path.join(root, path))
    relative = os.path.relpath(file, root)
    if relative.startswith("..") or not relative.startswith(DESIGN_DIR + os.sep):
        return None
    return file if os.path.isfile(file) else None


def lint_command_of(root):
    servers = load_json(os.path.join(root, ".mcp.json")).get("mcpServers", {})
    design = servers.get("ethlete-design") if isinstance(servers, dict) else None
    if isinstance(design, dict) and isinstance(design.get("command"), str):
        args = design.get("args") if isinstance(design.get("args"), list) else []
        words = [design["command"], *[str(arg) for arg in args]]
        if words[-1] == "mcp":
            return [*words[:-1], "lint"]
    local = os.path.join(root, "node_modules", ".bin", "et")
    return [local, "design", "lint"] if os.path.isfile(local) else None


def message_of(relative, findings):
    return (
        f"The design check finds this in {relative}. Fix each finding now, before you hand the design back; "
        "every line says what to change:\n" + findings
    )


def main():
    if agent_name(sys.argv[1:]) != "claude":
        return

    data = json.load(sys.stdin)

    if data.get("tool_name") not in TOOLS:
        return

    tool_input = data.get("tool_input")
    root = repo_root(data)

    if not isinstance(tool_input, dict) or disabled_locally(root):
        return

    file = design_file_of(root, tool_input.get("file_path"))
    command = lint_command_of(root) if file else None

    if not command:
        return

    run = subprocess.run(
        [*command, file],
        cwd=root,
        capture_output=True,
        text=True,
        timeout=RUN_SECONDS,
    )
    findings = run.stdout.strip()

    if run.returncode != 1 or not findings:
        return

    sys.stderr.write(message_of(os.path.relpath(file, root), findings) + "\n")
    sys.exit(2)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        pass
    sys.exit(0)
