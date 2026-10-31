use std::path::Path;

use serde_json::Value;

use crate::agent::{detail, AgentCli, AgentEvent, AgentRequest, ToolServer};
use crate::design_server::cli_entry;

pub struct ClaudeCli;

fn shell_quoted(path: &Path) -> String {
    let text = path.to_string_lossy();

    if text.chars().all(|c| c.is_ascii_alphanumeric() || "/._-+@:".contains(c)) {
        return text.into_owned();
    }

    format!("'{}'", text.replace('\'', "'\\''"))
}

fn et_command(entry: Option<&Path>) -> String {
    entry.map_or_else(|| "npx et".to_owned(), |entry| format!("node {}", shell_quoted(entry)))
}

fn studio_brief(entry: Option<&Path>) -> String {
    let et = et_command(entry);

    format!(
        "You work in Ethlete Studio on the design system in `.ethlete/design/<product>/`. \
After you change a part, run `{et} design check` and fix the problems it names in the parts you changed, not every problem, \
then draw the part with `{et} design shot <layer>/<name> --states` and look at the picture. \
A change to a merged part goes through a sketch: open one with `{et} design sketch new`. \
Files under `.ethlete/` need no changeset. For type, use the `text-ui-*` and `font-ui-*` utilities, for example \
`text-ui-sm`, `font-ui-medium` and `font-ui-strong`, which the product stylesheet defines, \
never raw font classes such as `text-sm` or `font-semibold`."
    )
}

fn allowed_commands(entry: Option<&Path>) -> Vec<String> {
    let et = et_command(entry);

    ["check", "shot", "sketch new"]
        .iter()
        .map(|command| format!("Bash({et} design {command}:*)"))
        .collect()
}

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

        if tools.is_none() {
            let entry = cli_entry(Path::new(&request.cwd));

            arguments.push("--append-system-prompt".to_owned());
            arguments.push(studio_brief(entry.as_deref()));
            // The user's own settings and CLAUDE.md steer a chat run away from the design brief.
            arguments.push("--setting-sources".to_owned());
            arguments.push("project".to_owned());
            // The permission mode accepts edits only, so a run in print mode is refused every
            // command the brief names.
            arguments.push("--allowedTools".to_owned());
            arguments.extend(allowed_commands(entry.as_deref()));
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

/// What the last request of the turn read: the fresh input, plus the part of the conversation the
/// cache wrote and the part it replayed. Together they are the size of the session the next turn
/// continues. The top-level usage of a result sums every request of the turn.
fn context(value: &Value) -> Vec<AgentEvent> {
    let Some(usage) = value
        .pointer("/usage/iterations")
        .and_then(Value::as_array)
        .and_then(|iterations| iterations.last())
        .or_else(|| value.get("usage"))
    else {
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
    fn a_chat_run_gets_the_studio_brief() {
        let arguments = ClaudeCli.arguments(&asking("draw it", None), None);
        let at = arguments
            .iter()
            .position(|argument| argument == "--append-system-prompt");
        let brief = &arguments[at.expect("the brief is passed") + 1];

        assert!(brief.contains("design check"));
        assert!(brief.contains("font-ui-medium"));
    }

    #[test]
    fn the_brief_runs_the_commands_through_the_entry() {
        let brief = studio_brief(Some(Path::new("/repo/dist/et.js")));

        assert!(brief.contains("`node /repo/dist/et.js design check`"));
        assert!(brief.contains("`node /repo/dist/et.js design shot <layer>/<name> --states`"));
        assert!(brief.contains("`node /repo/dist/et.js design sketch new`"));
        assert!(!brief.contains("npx et"));
    }

    #[test]
    fn the_brief_falls_back_to_npx_without_an_entry() {
        assert!(studio_brief(None).contains("`npx et design check`"));
    }

    #[test]
    fn the_brief_sends_a_merged_part_through_a_sketch_and_limits_the_fixes() {
        let brief = studio_brief(None);

        assert!(brief.contains("A change to a merged part goes through a sketch"));
        assert!(brief.contains("in the parts you changed, not every problem"));
    }

    #[test]
    fn the_brief_names_the_ui_type_utilities_the_product_defines() {
        let brief = studio_brief(None);

        assert!(brief.contains("`text-ui-*` and `font-ui-*`"));
        assert!(brief.contains("which the product stylesheet defines"));
        assert!(!brief.contains("foundations/type"));
    }

    #[test]
    fn a_path_with_a_space_is_quoted_in_the_command_and_the_rule() {
        let entry = Path::new("/my repo/et it's.js");

        assert!(studio_brief(Some(entry)).contains("`node '/my repo/et it'\\''s.js' design check`"));
        assert_eq!(
            allowed_commands(Some(entry))[0],
            "Bash(node '/my repo/et it'\\''s.js' design check:*)"
        );
    }

    #[test]
    fn the_allowed_commands_follow_the_entry() {
        assert_eq!(
            allowed_commands(Some(Path::new("/repo/et.js"))),
            [
                "Bash(node /repo/et.js design check:*)",
                "Bash(node /repo/et.js design shot:*)",
                "Bash(node /repo/et.js design sketch new:*)",
            ]
        );
    }

    #[test]
    fn the_allowed_commands_fall_back_to_npx_without_an_entry() {
        assert_eq!(
            allowed_commands(None),
            [
                "Bash(npx et design check:*)",
                "Bash(npx et design shot:*)",
                "Bash(npx et design sketch new:*)",
            ]
        );
    }

    #[test]
    fn a_chat_run_allows_the_commands_of_its_brief() {
        let arguments = ClaudeCli.arguments(&asking("draw it", None), None);
        let at = arguments.iter().position(|argument| argument == "--allowedTools");
        let allowed = &arguments[at.expect("tools are allowed") + 1..];
        let entry = cli_entry(Path::new("."));

        assert!(allowed.starts_with(&allowed_commands(entry.as_deref())));
    }

    #[test]
    fn a_chat_run_loads_project_settings_only() {
        let arguments = ClaudeCli.arguments(&asking("draw it", None), None);
        let at = arguments.iter().position(|argument| argument == "--setting-sources");

        assert_eq!(at.map(|at| arguments[at + 1].as_str()), Some("project"));
    }

    #[test]
    fn a_call_run_keeps_its_setting_sources() {
        assert!(!ClaudeCli
            .arguments(&asking("draw it", None), Some(&serving()))
            .contains(&"--setting-sources".to_owned()));
    }

    #[test]
    fn a_call_run_gets_no_studio_brief() {
        assert!(!ClaudeCli
            .arguments(&asking("draw it", None), Some(&serving()))
            .contains(&"--append-system-prompt".to_owned()));
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
    fn a_result_of_many_requests_reports_the_size_of_the_last_one() {
        let line = concat!(
            r#"{"type":"result","is_error":false,"result":"done","usage":{"input_tokens":4,"#,
            r#""cache_creation_input_tokens":10843,"cache_read_input_tokens":34353,"output_tokens":63,"#,
            r#""iterations":[{"input_tokens":2,"cache_creation_input_tokens":212,"cache_read_input_tokens":22492,"#,
            r#""output_tokens":4,"type":"message"}]}}"#
        );

        let events = ClaudeCli.read_line(line);

        assert!(matches!(&events[0], AgentEvent::Context { tokens } if *tokens == 22706));
    }

    #[test]
    fn a_rate_limit_line_says_nothing() {
        assert!(ClaudeCli
            .read_line(r#"{"type":"rate_limit_event","rate_limit_info":{}}"#)
            .is_empty());
    }
}
