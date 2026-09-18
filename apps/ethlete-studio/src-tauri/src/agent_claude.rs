use serde_json::Value;

use crate::agent::{detail, AgentCli, AgentEvent, AgentRequest, ToolServer};

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
        ["opus", "sonnet", "haiku", "fable"]
            .iter()
            .map(|name| (*name).to_owned())
            .collect()
    }

    fn arguments(&self, request: &AgentRequest, tools: Option<&ToolServer>) -> Vec<String> {
        let mut arguments = vec![
            "--print".to_owned(),
            request.prompt.clone(),
            "--output-format".to_owned(),
            "stream-json".to_owned(),
            // stream-json prints nothing at all without it.
            "--verbose".to_owned(),
            // A run without this cannot write a file, so a drawing job produces nothing.
            "--permission-mode".to_owned(),
            "acceptEdits".to_owned(),
        ];

        if let Some(model) = &request.model {
            arguments.push("--model".to_owned());
            arguments.push(model.clone());
        }

        if let Some(session) = &request.resume {
            arguments.push("--resume".to_owned());
            arguments.push(session.clone());
        }

        if let Some(tools) = tools {
            arguments.push("--mcp-config".to_owned());
            arguments.push(mcp_config(tools));
            // The permission mode accepts edits, not a tool of a server, so the set is named here.
            arguments.push("--allowedTools".to_owned());
            arguments.push(format!("mcp__{}", tools.name));
            // A design run pays for no server the checkout happens to configure.
            arguments.push("--strict-mcp-config".to_owned());
        }

        arguments
    }

    fn read_line(&self, line: &str) -> Vec<AgentEvent> {
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            return Vec::new();
        };

        match value.get("type").and_then(Value::as_str) {
            Some("assistant") => blocks(&value),
            Some("result") => {
                let mut events = context(&value);

                events.push(AgentEvent::Finished {
                    ok: !value.get("is_error").and_then(Value::as_bool).unwrap_or(false),
                    summary: value
                        .get("result")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_owned(),
                });

                events
            }
            _ => Vec::new(),
        }
    }
}

fn mcp_config(tools: &ToolServer) -> String {
    serde_json::json!({
        "mcpServers": {
            tools.name: { "command": tools.command, "args": tools.arguments },
        },
    })
    .to_string()
}

/// What the turn read: the fresh input, plus the part of the conversation the cache wrote and the
/// part it replayed. Together they are the size of the session the next turn continues.
fn context(value: &Value) -> Vec<AgentEvent> {
    let Some(usage) = value.get("usage") else {
        return Vec::new();
    };

    let tokens: u64 = ["input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"]
        .iter()
        .filter_map(|key| usage.get(key).and_then(Value::as_u64))
        .sum();

    if tokens == 0 {
        return Vec::new();
    }

    vec![AgentEvent::Context { tokens }]
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

    fn asking(prompt: &str, resume: Option<&str>) -> AgentRequest {
        AgentRequest {
            cli: "claude".to_owned(),
            model: None,
            prompt: prompt.to_owned(),
            cwd: ".".to_owned(),
            resume: resume.map(str::to_owned),
            tools: None,
        }
    }

    fn serving() -> ToolServer {
        ToolServer {
            name: "studio",
            command: "/tmp/ethlete-studio".to_owned(),
            arguments: vec!["mcp".to_owned(), "--call".to_owned(), "studio/01-workbench".to_owned()],
        }
    }

    #[test]
    fn a_run_may_write_a_file() {
        let arguments = ClaudeCli.arguments(&asking("draw it", None), None);
        let at = arguments.iter().position(|argument| argument == "--permission-mode");

        assert_eq!(at.map(|at| arguments[at + 1].as_str()), Some("acceptEdits"));
    }

    #[test]
    fn suggests_the_available_claude_models() {
        assert_eq!(ClaudeCli.suggested_models(), ["opus", "sonnet", "haiku", "fable"]);
    }

    #[test]
    fn a_named_session_is_continued() {
        let arguments = ClaudeCli.arguments(&asking("draw it again", Some("s-7")), None);
        let at = arguments.iter().position(|argument| argument == "--resume");

        assert_eq!(at.map(|at| arguments[at + 1].as_str()), Some("s-7"));
    }

    #[test]
    fn a_run_without_a_session_starts_a_new_one() {
        assert!(!ClaudeCli
            .arguments(&asking("draw it", None), None)
            .contains(&"--resume".to_owned()));
    }

    #[test]
    fn a_run_without_a_tool_server_configures_none() {
        assert!(!ClaudeCli
            .arguments(&asking("draw it", None), None)
            .contains(&"--mcp-config".to_owned()));
    }

    #[test]
    fn a_tool_server_is_configured_and_allowed() {
        let serving = serving();
        let arguments = ClaudeCli.arguments(&asking("draw it", None), Some(&serving));
        let at = arguments.iter().position(|argument| argument == "--mcp-config");
        let configured: Value =
            serde_json::from_str(&arguments[at.expect("the config is passed") + 1]).expect("the config is JSON");

        assert_eq!(
            configured.pointer("/mcpServers/studio/command").and_then(Value::as_str),
            Some("/tmp/ethlete-studio")
        );
        assert!(arguments.contains(&"mcp__studio".to_owned()));
        assert!(arguments.contains(&"--strict-mcp-config".to_owned()));
    }

    #[test]
    fn a_line_names_the_session_it_belongs_to() {
        assert_eq!(
            ClaudeCli
                .session_of(r#"{"type":"system","session_id":"s-7"}"#)
                .as_deref(),
            Some("s-7")
        );
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
        assert!(
            matches!(&events[1], AgentEvent::Action { action, detail } if action == "Read" && detail == "/tmp/a.ts")
        );
    }

    #[test]
    fn a_result_ends_the_run() {
        let line = r#"{"type":"result","subtype":"error_during_execution","is_error":true,"result":"it broke"}"#;

        assert!(
            matches!(&ClaudeCli.read_line(line)[0], AgentEvent::Finished { ok: false, summary } if summary == "it broke")
        );
    }

    #[test]
    fn a_result_reports_the_size_of_the_session_before_it_ends_the_run() {
        let line = concat!(
            r#"{"type":"result","is_error":false,"result":"done","usage":{"input_tokens":10,"#,
            r#""cache_creation_input_tokens":8834,"cache_read_input_tokens":13983,"output_tokens":39}}"#
        );

        let events = ClaudeCli.read_line(line);

        assert!(matches!(&events[0], AgentEvent::Context { tokens } if *tokens == 22827));
        assert!(matches!(&events[1], AgentEvent::Finished { ok: true, .. }));
    }

    #[test]
    fn a_rate_limit_line_says_nothing() {
        assert!(ClaudeCli
            .read_line(r#"{"type":"rate_limit_event","rate_limit_info":{}}"#)
            .is_empty());
    }
}
