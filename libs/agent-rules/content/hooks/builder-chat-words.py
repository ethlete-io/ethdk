#!/usr/bin/env python3
"""Stop hook: logs how many chat words a builder session wrote in the turn that just ended.

Only runs in a session started with `--role builder` (ETHLETE_AGENT_ROLE=builder). Appends one
JSON line to .claude/builder-chat-words.jsonl: timestamp, session_id, words. It never blocks,
never prints and always exits 0.
"""

import json
import os
import sys
from datetime import datetime, timezone

LOG_FILE = os.path.join(".claude", "builder-chat-words.jsonl")


def is_prompt(entry):
    if entry.get("type") != "user":
        return False
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return True
    return isinstance(content, list) and not any(
        isinstance(block, dict) and block.get("type") == "tool_result" for block in content
    )


def count_words(path):
    words = 0
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            if not isinstance(entry, dict):
                continue
            if is_prompt(entry):
                words = 0
            elif entry.get("type") == "assistant":
                content = (entry.get("message") or {}).get("content")
                if isinstance(content, str):
                    words += len(content.split())
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            words += len(str(block.get("text", "")).split())
    return words


def main():
    if os.environ.get("ETHLETE_AGENT_ROLE") != "builder":
        return
    payload = json.load(sys.stdin)
    path = payload.get("transcript_path")
    if not path or not os.path.isfile(path):
        return
    root = os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or os.getcwd()
    log = os.path.join(root, LOG_FILE)
    os.makedirs(os.path.dirname(log), exist_ok=True)
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": payload.get("session_id"),
        "words": count_words(path),
    }
    with open(log, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(record) + "\n")


try:
    main()
except Exception:
    pass
sys.exit(0)
