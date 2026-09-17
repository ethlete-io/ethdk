use serde_json::Value;

use crate::agent::{detail, AgentCli, AgentEvent};

pub struct ClaudeCli;

impl AgentCli for ClaudeCli {
    fn id(&self) -> &'static str {
        "claude"
    }

    fn label(&self) -> &'static str {
        "Claude Code"
    }

    fn binary(&self) -> &'static str {
        "claude"
    }

    fn suggested_models(&self) -> Vec<String> {
        ["opus", "sonnet", "haiku", "fable"].iter().map(|name| (*name).to_owned()).collect()
    }

    fn arguments(&self, prompt: &str, model: Option<&str>) -> Vec<String> {
        let mut arguments = vec![
            "--print".to_owned(),
            prompt.to_owned(),
            "--output-format".to_owned(),
            "stream-json".to_owned(),
            // stream-json prints nothing at all without it.
            "--verbose".to_owned(),
            // A run without this cannot write a file, so a drawing job produces nothing.
            "--permission-mode".to_owned(),
            "acceptEdits".to_owned(),
        ];

        if let Some(model) = model {
            arguments.push("--model".to_owned());
            arguments.push(model.to_owned());
        }

        arguments
    }

    fn read_line(&self, line: &str) -> Vec<AgentEvent> {
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            return Vec::new();
        };

        match value.get("type").and_then(Value::as_str) {
            Some("assistant") => blocks(&value),
            Some("result") => vec![AgentEvent::Finished {
                ok: !value.get("is_error").and_then(Value::as_bool).unwrap_or(false),
                summary: value.get("result").and_then(Value::as_str).unwrap_or_default().to_owned(),
            }],
            _ => Vec::new(),
        }
    }
}

fn blocks(value: &Value) -> Vec<AgentEvent> {
    let Some(blocks) = value.pointer("/message/content").and_then(Value::as_array) else {
        return Vec::new();
    };

    blocks
        .iter()
        .filter_map(|block| match block.get("type").and_then(Value::as_str) {
            Some("text") => block
                .get("text")
                .and_then(Value::as_str)
                .map(|text| AgentEvent::Message { text: text.to_owned() }),
            Some("tool_use") => Some(AgentEvent::Action {
                action: block.get("name").and_then(Value::as_str).unwrap_or("tool").to_owned(),
                detail: detail(block.get("input")),
            }),
            _ => None,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_run_may_write_a_file() {
        let arguments = ClaudeCli.arguments("draw it", None);
        let at = arguments.iter().position(|argument| argument == "--permission-mode");

        assert_eq!(at.map(|at| arguments[at + 1].as_str()), Some("acceptEdits"));
    }

    #[test]
    fn a_text_block_and_a_tool_call_read_as_two_events() {
        let line = concat!(
            r#"{"type":"assistant","message":{"content":["#,
            r#"{"type":"text","text":"ok"},"#,
            r#"{"type":"tool_use","name":"Read","input":{"file_path":"/tmp/a.ts"}}]}}"#
        );

        let events = ClaudeCli.read_line(line);

        assert!(matches!(&events[0], AgentEvent::Message { text } if text == "ok"));
        assert!(matches!(&events[1], AgentEvent::Action { action, detail } if action == "Read" && detail == "/tmp/a.ts"));
    }

    #[test]
    fn a_result_ends_the_run() {
        let line = r#"{"type":"result","subtype":"error_during_execution","is_error":true,"result":"it broke"}"#;

        assert!(matches!(&ClaudeCli.read_line(line)[0], AgentEvent::Finished { ok: false, summary } if summary == "it broke"));
    }

    #[test]
    fn a_rate_limit_line_says_nothing() {
        assert!(ClaudeCli.read_line(r#"{"type":"rate_limit_event","rate_limit_info":{}}"#).is_empty());
    }
}
