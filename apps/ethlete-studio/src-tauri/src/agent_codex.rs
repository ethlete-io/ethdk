use serde_json::Value;

use crate::agent::{clip, detail, AgentCli, AgentEvent};

pub struct CodexCli;

impl AgentCli for CodexCli {
    fn id(&self) -> &'static str {
        "codex"
    }

    fn label(&self) -> &'static str {
        "Codex"
    }

    fn binary(&self) -> &'static str {
        "codex"
    }

    /// Codex names no model in its help output, so Studio offers none and the run takes whatever the
    /// user types.
    fn suggested_models(&self) -> Vec<String> {
        Vec::new()
    }

    fn arguments(&self, prompt: &str, model: Option<&str>) -> Vec<String> {
        let mut arguments = vec![
            "exec".to_owned(),
            "--json".to_owned(),
            // A design checkout is not always a git repository, and the agent has to write into it.
            "--skip-git-repo-check".to_owned(),
            "--sandbox".to_owned(),
            "workspace-write".to_owned(),
        ];

        if let Some(model) = model {
            arguments.push("--model".to_owned());
            arguments.push(model.to_owned());
        }

        arguments.push(prompt.to_owned());
        arguments
    }

    fn read_line(&self, line: &str) -> Vec<AgentEvent> {
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            return Vec::new();
        };

        match value.get("type").and_then(Value::as_str) {
            Some("item.started") => item(&value, false),
            Some("item.completed") => item(&value, true),
            Some("turn.completed") => vec![AgentEvent::Finished {
                ok: true,
                summary: String::new(),
            }],
            Some("turn.failed") => stopped(value.pointer("/error/message").and_then(Value::as_str)),
            Some("error") => stopped(value.get("message").and_then(Value::as_str)),
            _ => Vec::new(),
        }
    }
}

fn stopped(message: Option<&str>) -> Vec<AgentEvent> {
    let message = message.unwrap_or("The agent stopped without a reason.").to_owned();

    vec![
        AgentEvent::Failed {
            message: message.clone(),
        },
        AgentEvent::Finished {
            ok: false,
            summary: message,
        },
    ]
}

fn item(value: &Value, complete: bool) -> Vec<AgentEvent> {
    let Some(item) = value.get("item") else {
        return Vec::new();
    };

    match (item.get("type").and_then(Value::as_str), complete) {
        (Some("agent_message"), true) => item
            .get("text")
            .and_then(Value::as_str)
            .map(|text| vec![AgentEvent::Message { text: text.to_owned() }])
            .unwrap_or_default(),
        (Some("command_execution"), false) => vec![AgentEvent::Action {
            action: "run".to_owned(),
            detail: detail(item.get("command")),
        }],
        (Some("file_change"), true) => vec![AgentEvent::Action {
            action: "edit".to_owned(),
            detail: changed(item),
        }],
        (Some("error"), _) => stopped(item.get("message").and_then(Value::as_str)),
        _ => Vec::new(),
    }
}

fn changed(item: &Value) -> String {
    let Some(changes) = item.get("changes").and_then(Value::as_array) else {
        return String::new();
    };

    let paths: Vec<&str> = changes
        .iter()
        .filter_map(|change| change.get("path").and_then(Value::as_str))
        .collect();

    clip(&paths.join(", "))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_completed_message_reads_as_text() {
        let line = r#"{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"ok"}}"#;

        assert!(matches!(&CodexCli.read_line(line)[0], AgentEvent::Message { text } if text == "ok"));
    }

    #[test]
    fn a_command_reads_as_an_action_when_it_starts_and_not_again_when_it_ends() {
        let line = r#"{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"ls -la"}}"#;
        let ended = r#"{"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"ls -la"}}"#;

        assert!(
            matches!(&CodexCli.read_line(line)[0], AgentEvent::Action { action, detail } if action == "run" && detail == "ls -la")
        );
        assert!(CodexCli.read_line(ended).is_empty());
    }

    #[test]
    fn a_completed_turn_ends_the_run() {
        let line = r#"{"type":"turn.completed","usage":{"input_tokens":1}}"#;

        assert!(matches!(
            &CodexCli.read_line(line)[0],
            AgentEvent::Finished { ok: true, .. }
        ));
    }

    #[test]
    fn a_failed_turn_reports_the_reason_and_ends_the_run() {
        let line = r#"{"type":"turn.failed","error":{"message":"it broke"}}"#;
        let events = CodexCli.read_line(line);

        assert!(matches!(&events[0], AgentEvent::Failed { message } if message == "it broke"));
        assert!(matches!(&events[1], AgentEvent::Finished { ok: false, .. }));
    }
}
