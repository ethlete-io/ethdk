#!/usr/bin/env python3
"""UserPromptSubmit hook: switch an interactive session into "user is away" mode on its own.

A session opts in through `awayMode` in ethlete-agents.config.json (the local config file
overrides it): {"awayMode": {"skills": ["doc-agent"], "thresholdMinutes": 15}}. Without `skills`
the hook does nothing. A session becomes active when a prompt starts with `/<skill>` or with
`/handoff resume <skill>-`.

Prompts the agent sessions send themselves (mailbox messages, cross-session messages, task
notifications, system reminders, the restart prompt) are not human input. The last human-typed
prompt is stored per session; when a non-human prompt arrives after the threshold, the hook injects
the away message once and a one-line reminder afterwards. The next human-typed prompt injects the
back message; with `awayMode.reportCommand` (e.g. `node dist/libs/agent-rules/src/index.js report`)
it also carries that command's table for the time away (`--since <last typed input>`), left out when the
command fails or takes over 10 s. A human prompt that is exactly `afk` marks the session away at once.

State lives in `<git common dir>/ethlete/away/<session_id>.json`, so it is never committed.

Can be disabled per machine via a gitignored ethlete-agents.config.local.json at the repo root:
{"disableHooks": true} or {"disableHooks": ["away-mode"]}.

Fail-safe: any error exits 0 with no output - the hook must never block work because it could
not read its own input.
"""

import json
import os
import re
import shlex
import subprocess
import sys
from datetime import datetime, timezone

HOOK_NAME = "away-mode"
CONFIG_FILE = "ethlete-agents.config.json"
LOCAL_CONFIG_FILE = "ethlete-agents.config.local.json"
DEFAULT_THRESHOLD_MINUTES = 15
AGENT_SESSIONS_SUFFIX = "[typed by agent-sessions]"

BACK_MESSAGE = (
    "The user is back (typed input after {minutes} min away). Leave away mode: put every question you "
    "collected while they were away once, in full, in your round format."
)
AWAY_MESSAGE = (
    "The user is away (no typed input for {minutes} min). Work by your skill's away rules: collect "
    "questions, one short line per event, no round. Typed input switches back on its own."
)
BACK_REPORT_MESSAGE = (
    " Paste this report for the time away unchanged, then the collected questions:\n\n{report}"
)
REPORT_TIMEOUT_SECONDS = 10
STILL_AWAY_MESSAGE = "The user is still away (no typed input for {minutes} min)."


def agent_name(argv):
    """The --agent value, defaulting to claude — older registrations pass no flag."""
    for index, arg in enumerate(argv):
        if arg == "--agent" and index + 1 < len(argv):
            return argv[index + 1]
        if arg.startswith("--agent="):
            return arg.split("=", 1)[1]
    return "claude"


def repo_root(data):
    """Repo root: the env var the agent sets, else the script's own location, else the cwd."""
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


def load_config(root, file_name):
    """Parsed JSON object at the repo root, or {} if missing/unreadable."""
    if not root:
        return {}
    try:
        with open(os.path.join(root, file_name), encoding="utf-8") as f:
            config = json.load(f)
    except (OSError, ValueError, AttributeError):
        return {}
    return config if isinstance(config, dict) else {}


def load_local_config(root):
    return load_config(root, LOCAL_CONFIG_FILE)


def disabled_locally(config):
    """True when the local config disables this hook (or all hooks) on this machine."""
    disabled = config.get("disableHooks")
    return disabled is True or (isinstance(disabled, list) and HOOK_NAME in disabled)


def away_settings(root, local_config):
    """(skills, threshold in minutes); the local config's `awayMode` replaces the shared one."""
    setting = local_config.get("awayMode")
    if not isinstance(setting, dict):
        setting = load_config(root, CONFIG_FILE).get("awayMode")
    if not isinstance(setting, dict):
        return [], DEFAULT_THRESHOLD_MINUTES
    skills = setting.get("skills")
    skills = [s for s in skills if isinstance(s, str) and s] if isinstance(skills, list) else []
    threshold = setting.get("thresholdMinutes")
    if isinstance(threshold, bool) or not isinstance(threshold, (int, float)) or threshold <= 0:
        threshold = DEFAULT_THRESHOLD_MINUTES
    return skills, threshold


def report_command(root, local_config):
    """The configured report command; the local config's `awayMode` replaces the shared one."""
    setting = local_config.get("awayMode")
    if not isinstance(setting, dict):
        setting = load_config(root, CONFIG_FILE).get("awayMode")
    command = setting.get("reportCommand") if isinstance(setting, dict) else None
    return command.strip() if isinstance(command, str) and command.strip() else None


def away_report(root, command, since):
    """The report table since `since`, or None when the command is missing, fails or is too slow."""
    if not command or not since:
        return None
    try:
        result = subprocess.run(
            shlex.split(command) + ["--since", since],
            cwd=root,
            capture_output=True,
            text=True,
            timeout=REPORT_TIMEOUT_SECONDS,
        )
    except Exception:
        return None
    output = result.stdout.strip()
    return output if result.returncode == 0 and output else None


def is_human_typed(prompt):
    stripped = prompt.strip()
    return not (
        stripped.startswith("Mailbox message from ")
        or "<cross-session-message" in stripped
        or stripped.endswith(AGENT_SESSIONS_SUFFIX)
        or stripped.startswith("<task-notification")
        or stripped.startswith("<system-reminder")
    )


def invokes_skill(prompt, skills):
    text = prompt.strip()
    if text.endswith(AGENT_SESSIONS_SUFFIX):
        text = text[: -len(AGENT_SESSIONS_SUFFIX)].strip()
    for skill in skills:
        name = re.escape(skill)
        if re.match(rf"/{name}(?![\w-])", text) or re.match(rf"/handoff\s+resume\s+{name}-", text):
            return True
    return False


def state_path(root, session_id):
    result = subprocess.run(
        ["git", "-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"],
        capture_output=True,
        text=True,
        timeout=3,
    )
    common_dir = result.stdout.strip() if result.returncode == 0 else ""
    if not common_dir:
        return None
    safe_id = re.sub(r"[^\w.-]", "_", str(session_id))
    return os.path.join(common_dir, "ethlete", "away", f"{safe_id}.json")


def read_state(path):
    try:
        with open(path, encoding="utf-8") as f:
            state = json.load(f)
    except (OSError, ValueError):
        return None
    return state if isinstance(state, dict) else None


def write_state(path, state):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f)


def minutes_since(iso, now):
    try:
        then = datetime.fromisoformat(iso)
    except (TypeError, ValueError):
        return None
    if then.tzinfo is None:
        then = then.replace(tzinfo=timezone.utc)
    return max(0, int((now - then).total_seconds() // 60))


def emit(message):
    print(
        json.dumps(
            {"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": message}}
        )
    )


def main():
    if agent_name(sys.argv[1:]) != "claude":
        return

    data = json.load(sys.stdin)
    prompt = data.get("prompt")
    session_id = data.get("session_id")

    if not isinstance(prompt, str) or not session_id:
        return

    root = repo_root(data)
    local_config = load_local_config(root)

    if disabled_locally(local_config):
        return

    skills, threshold = away_settings(root, local_config)

    if not skills:
        return

    path = state_path(root, session_id)

    if not path:
        return

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat(timespec="seconds")
    state = read_state(path)
    human = is_human_typed(prompt)

    if not state or not state.get("active"):
        if not invokes_skill(prompt, skills):
            return
        state = {"active": True, "lastHumanInput": now_iso if human else None, "away": False}
        write_state(path, state)
        return

    if human:
        was_away = state.get("away") is True
        since = state.get("lastHumanInput")
        minutes = minutes_since(since, now)
        state["lastHumanInput"] = now_iso
        state["away"] = prompt.strip().lower() == "afk"
        write_state(path, state)
        if was_away and not state["away"]:
            message = BACK_MESSAGE.format(minutes=minutes if minutes is not None else threshold)
            report = away_report(root, report_command(root, local_config), since)
            if report:
                message += BACK_REPORT_MESSAGE.format(report=report)
            emit(message)
        return

    minutes = minutes_since(state.get("lastHumanInput"), now)

    if minutes is not None and minutes < threshold:
        return

    shown = minutes if minutes is not None else int(threshold)

    if state.get("away") is True:
        emit(STILL_AWAY_MESSAGE.format(minutes=shown))
        return

    state["away"] = True
    write_state(path, state)
    emit(AWAY_MESSAGE.format(minutes=shown))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
