#!/usr/bin/env python3
"""Stop hook: logs the chat text of a builder turn and blocks a turn that ends with more than one line.

Only runs in a session started with `--role builder` (ETHLETE_AGENT_ROLE=builder). Appends one
JSON line to .claude/builder-chat-words.jsonl: timestamp, session_id, words, lines, committed, reported, blocked.
It blocks the stop once (not again while stop_hook_active is set) when the turn's text blocks and
last_assistant_message hold more than one non-empty line, or when the turn ran `git commit` or `git push` and sent
no report (no SendMessage, no `agent-sessions send`). It always exits 0.
"""

import json
import os
import re
import sys
from datetime import datetime, timezone

LOG_FILE = os.path.join(".claude", "builder-chat-words.jsonl")
BLOCK_REASON = (
    "builder: no chat text. Send the report with SendMessage to the grill session; "
    "end the turn with at most one line."
)
REPORT_REASON = (
    "builder: this turn committed or pushed and sent no report. Send it to the grill session with SendMessage "
    "or `agent-sessions.mjs send`, then end the turn."
)
COMMIT_PATTERN = re.compile(r"\bgit\b[^\n;&|]*?\s(?:commit|push)\b")
SEND_PATTERN = re.compile(r"(?:agent-sessions\.mjs|agents:sessions)\s+send\b")


def is_prompt(entry):
    if entry.get("type") != "user":
        return False
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return True
    return isinstance(content, list) and not any(
        isinstance(block, dict) and block.get("type") == "tool_result" for block in content
    )


def turn_entries(path):
    texts = []
    tools = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            if not isinstance(entry, dict):
                continue
            if is_prompt(entry):
                texts = []
                tools = []
            elif entry.get("type") == "assistant":
                content = (entry.get("message") or {}).get("content")
                if isinstance(content, str):
                    texts.append(content)
                elif isinstance(content, list):
                    for block in content:
                        if not isinstance(block, dict):
                            continue
                        if block.get("type") == "text":
                            texts.append(str(block.get("text", "")))
                        elif block.get("type") == "tool_use":
                            tools.append(block)
    return texts, tools


def bash_commands(tools):
    for tool in tools:
        if tool.get("name") == "Bash":
            command = (tool.get("input") or {}).get("command")
            if isinstance(command, str):
                yield command


def has_commit(tools):
    return any(COMMIT_PATTERN.search(command) for command in bash_commands(tools))


def has_report(tools):
    return any(tool.get("name") == "SendMessage" for tool in tools) or any(
        SEND_PATTERN.search(command) for command in bash_commands(tools)
    )


def with_final(texts, final):
    if not isinstance(final, str) or not final.strip():
        return texts
    if texts and texts[-1].strip() == final.strip():
        return texts
    return [*texts, final]


def main():
    if os.environ.get("ETHLETE_AGENT_ROLE") != "builder":
        return
    payload = json.load(sys.stdin)
    path = payload.get("transcript_path")
    final = payload.get("last_assistant_message")
    has_transcript = bool(path) and os.path.isfile(path)
    if not has_transcript and not isinstance(final, str):
        return
    root = os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or os.getcwd()
    log = os.path.join(root, LOG_FILE)
    os.makedirs(os.path.dirname(log), exist_ok=True)
    # Claude Code calls the Stop hook before the final text block reaches the transcript.
    texts, tools = turn_entries(path) if has_transcript else ([], [])
    texts = with_final(texts, final)
    lines = sum(1 for text in texts for row in text.splitlines() if row.strip())
    committed = has_commit(tools)
    reported = has_report(tools)
    unreported = committed and not reported
    blocked = (lines > 1 or unreported) and not payload.get("stop_hook_active")
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": payload.get("session_id"),
        "words": sum(len(text.split()) for text in texts),
        "lines": lines,
        "committed": committed,
        "reported": reported,
        "blocked": blocked,
    }
    with open(log, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(record) + "\n")
    if blocked:
        reason = REPORT_REASON if unreported else BLOCK_REASON
        print(json.dumps({"decision": "block", "reason": reason}))


try:
    main()
except Exception:
    pass
sys.exit(0)
