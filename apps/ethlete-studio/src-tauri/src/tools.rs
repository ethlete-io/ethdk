use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// The MCP server name the agent sees. A Claude Code tool therefore reads as `mcp__studio__…`.
pub const SERVER_NAME: &str = "studio";

/// The argument that turns the Studio binary into the tool server instead of the window.
pub const SERVE_ARGUMENT: &str = "mcp";

const PROTOCOL_VERSION: &str = "2025-06-18";

/// Where the design tool lives once a checkout installs it, and where this repository builds it.
/// The first entry that exists wins, and `ETHLETE_CLI` overrules all of them.
const CLI_ENTRIES: [&str; 2] = [
    "node_modules/@ethlete/cli/src/index.js",
    "dist/libs/cli/src/index.js",
];

/// What the run works on. Studio knows every one of these, so no tool takes an argument and no run
/// can name the wrong call.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ToolContext {
    pub checkout: PathBuf,
    pub call: String,
    pub variant: String,
    pub port: u16,
    pub calls_root: String,
    /// Where the result of the last check is written, so Studio can see that the check ran.
    pub receipt: PathBuf,
}

impl ToolContext {
    /// Reads the context out of the command line Studio wrote. The first argument is
    /// [`SERVE_ARGUMENT`]; `None` means the binary was started as the app.
    pub fn from_arguments<I: IntoIterator<Item = String>>(arguments: I) -> Option<Self> {
        let mut arguments = arguments.into_iter();

        if arguments.next().as_deref() != Some(SERVE_ARGUMENT) {
            return None;
        }

        let mut named: Vec<(String, String)> = Vec::new();
        let mut key: Option<String> = None;

        for argument in arguments {
            match key.take() {
                Some(key) => named.push((key, argument)),
                None => key = argument.strip_prefix("--").map(str::to_owned),
            }
        }

        let value = |wanted: &str| {
            named
                .iter()
                .find(|(key, _)| key == wanted)
                .map(|(_, value)| value.clone())
        };

        Some(Self {
            checkout: PathBuf::from(value("checkout")?),
            call: value("call")?,
            variant: value("variant")?,
            port: value("port")?.parse().ok()?,
            calls_root: value("calls-root")?,
            receipt: PathBuf::from(value("receipt")?),
        })
    }

    /// The command line that starts this same context again, without the binary path.
    pub fn to_arguments(&self) -> Vec<String> {
        vec![
            SERVE_ARGUMENT.to_owned(),
            "--checkout".to_owned(),
            self.checkout.to_string_lossy().into_owned(),
            "--call".to_owned(),
            self.call.clone(),
            "--variant".to_owned(),
            self.variant.clone(),
            "--port".to_owned(),
            self.port.to_string(),
            "--calls-root".to_owned(),
            self.calls_root.clone(),
            "--receipt".to_owned(),
            self.receipt.to_string_lossy().into_owned(),
        ]
    }

    fn dir(&self) -> PathBuf {
        self.checkout.join(&self.calls_root).join(&self.call)
    }

    fn variant_file(&self) -> PathBuf {
        self.dir().join(format!("option-{}.ts", self.variant))
    }

    fn frame_url(&self) -> String {
        format!(
            "http://localhost:{}/frame.html?call={}&option={}",
            self.port, self.call, self.variant
        )
    }
}

/// Where the result of a check on one variant is kept. The path is built from the call and the
/// variant alone, so Studio finds it again without tracking the run that wrote it.
pub fn receipt_path(checkout: &str, call: &str, variant: &str) -> PathBuf {
    std::env::temp_dir()
        .join("ethlete-studio-checks")
        .join(format!("{}.json", flattened(&format!("{checkout} {call} {variant}"))))
}

fn flattened(value: &str) -> String {
    value
        .chars()
        .map(|letter| if letter.is_ascii_alphanumeric() { letter } else { '-' })
        .collect()
}

/// What the last check said about one variant. Studio reads it to see that the check ran at all.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckReceipt {
    pub ok: bool,
    /// When the check ran, in seconds since the epoch.
    pub at: u64,
    pub said: String,
}

/// What the last check said about one variant, or `None` when no run ever checked it.
#[tauri::command]
pub fn design_check(checkout: String, slug: String, option: String) -> Option<CheckReceipt> {
    let source = std::fs::read_to_string(receipt_path(&checkout, &slug, &option)).ok()?;

    serde_json::from_str(&source).ok()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Tool {
    name: &'static str,
    description: &'static str,
}

const TOOLS: [Tool; 3] = [
    Tool {
        name: "read_call",
        description: concat!(
            "The call this run works on: the question it asks, every variant drawn so far, and which ",
            "variant is under study. Read it before you draw."
        ),
    },
    Tool {
        name: "read_fixture",
        description: concat!(
            "The data every variant of this call draws. Read it to learn the shape you render. ",
            "Never change it: a variant that changes the data is not comparable to the others."
        ),
    },
    Tool {
        name: "check_call",
        description: concat!(
            "Lints the variant under study, type-checks the call, and renders it in a browser. ",
            "Run it after every edit, and never say you are done before it answers ok."
        ),
    },
];

fn read(path: &Path) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|error| format!("{} cannot be read: {error}", path.display()))
}

fn read_call(context: &ToolContext) -> Result<String, String> {
    let dir = context.dir();
    let source = read(&dir.join("call.ts"))?;

    Ok(format!(
        concat!(
            "The call: {call}\n",
            "The variant under study: {variant}\n",
            "The file you draw into: {file}\n",
            "Its frame: {url}\n\n",
            "{source}"
        ),
        call = context.call,
        variant = context.variant,
        file = context.variant_file().display(),
        url = context.frame_url(),
        source = source
    ))
}

fn read_fixture(context: &ToolContext) -> Result<String, String> {
    let path = context.dir().join("fixture.ts");

    if !path.is_file() {
        return Ok(format!("The call {} carries no fixture.ts.", context.call));
    }

    read(&path)
}

/// The `et` entry point that draws and checks a checkout. Step by step: an explicit override, the
/// copy the checkout installed, then the copy this repository builds.
fn cli_entry(checkout: &Path) -> Option<PathBuf> {
    if let Some(named) = std::env::var_os("ETHLETE_CLI") {
        let path = PathBuf::from(named);

        return path.is_file().then_some(path);
    }

    CLI_ENTRIES
        .iter()
        .map(|entry| checkout.join(entry))
        .find(|path| path.is_file())
}

fn check_call(context: &ToolContext) -> Result<String, String> {
    let entry = cli_entry(&context.checkout).ok_or_else(|| {
        format!(
            "{} holds no @ethlete/cli. Install it, or set ETHLETE_CLI to its src/index.js.",
            context.checkout.display()
        )
    })?;

    let output = Command::new("node")
        .current_dir(&context.checkout)
        .env("DE_URL", format!("http://localhost:{}", context.port))
        .arg(&entry)
        .arg("design")
        .arg("check")
        .arg("--lint")
        .arg(context.variant_file())
        .arg("--tsconfig")
        .arg("--call")
        .arg(&context.call)
        .arg("--option")
        .arg(&context.variant)
        .output()
        .map_err(|error| format!("Unable to run {}: {error}", entry.display()))?;

    let said = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let said = said.trim().to_owned();

    write_receipt(context, output.status.success(), &said);

    if output.status.success() {
        Ok(said)
    } else {
        Err(said)
    }
}

fn write_receipt(context: &ToolContext, ok: bool, said: &str) {
    let at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|since| since.as_secs())
        .unwrap_or(0);

    let receipt = json!({
        "call": context.call,
        "variant": context.variant,
        "ok": ok,
        "at": at,
        "said": said,
    });

    if let Some(parent) = context.receipt.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let _ = std::fs::write(&context.receipt, receipt.to_string());
}

fn call_tool(context: &ToolContext, name: &str) -> Result<String, String> {
    match name {
        "read_call" => read_call(context),
        "read_fixture" => read_fixture(context),
        "check_call" => check_call(context),
        _ => Err(format!("No tool is registered under {name}.")),
    }
}

fn result(id: Value, payload: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": payload })
}

fn failure(id: Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

/// Answers one JSON-RPC request. A notification carries no `id` and gets no answer, so this returns
/// `None` for it.
pub fn answer(context: &ToolContext, request: &Value) -> Option<Value> {
    let id = request.get("id").cloned()?;
    let method = request.get("method").and_then(Value::as_str).unwrap_or_default();

    match method {
        "initialize" => Some(result(
            id,
            json!({
                "protocolVersion": request
                    .pointer("/params/protocolVersion")
                    .and_then(Value::as_str)
                    .unwrap_or(PROTOCOL_VERSION),
                "capabilities": { "tools": {} },
                "serverInfo": { "name": SERVER_NAME, "version": env!("CARGO_PKG_VERSION") },
            }),
        )),
        "ping" => Some(result(id, json!({}))),
        "tools/list" => Some(result(
            id,
            json!({
                "tools": TOOLS
                    .iter()
                    .map(|tool| json!({
                        "name": tool.name,
                        "description": tool.description,
                        "inputSchema": { "type": "object", "properties": {} },
                    }))
                    .collect::<Vec<Value>>(),
            }),
        )),
        "tools/call" => {
            let name = request
                .pointer("/params/name")
                .and_then(Value::as_str)
                .unwrap_or_default();

            let (text, failed) = match call_tool(context, name) {
                Ok(text) => (text, false),
                Err(text) => (text, true),
            };

            Some(result(
                id,
                json!({ "content": [{ "type": "text", "text": text }], "isError": failed }),
            ))
        }
        _ => Some(failure(
            id,
            -32601,
            &format!("{method} is not a method of this server."),
        )),
    }
}

/// Reads JSON-RPC requests from stdin and answers on stdout until stdin ends.
pub fn serve(context: &ToolContext) {
    use std::io::{BufRead, Write};

    let input = std::io::stdin();
    let mut output = std::io::stdout();

    for line in input.lock().lines().map_while(Result::ok) {
        let Ok(request) = serde_json::from_str::<Value>(&line) else {
            continue;
        };

        let Some(answer) = answer(context, &request) else {
            continue;
        };

        if writeln!(output, "{answer}").is_err() || output.flush().is_err() {
            return;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ground(name: &str) -> PathBuf {
        let ground = std::env::temp_dir().join(format!("ethlete-studio-tools-{}-{name}", std::process::id()));

        let _ = std::fs::remove_dir_all(&ground);
        std::fs::create_dir_all(&ground).expect("a temporary ground");

        ground
    }

    #[test]
    fn the_installed_cli_is_preferred_over_a_built_one() {
        let checkout = ground("installed");

        for entry in CLI_ENTRIES {
            let path = checkout.join(entry);
            std::fs::create_dir_all(path.parent().expect("a parent")).expect("a directory");
            std::fs::write(&path, "").expect("an entry point");
        }

        assert_eq!(cli_entry(&checkout), Some(checkout.join(CLI_ENTRIES[0])));
    }

    #[test]
    fn a_checkout_without_the_cli_names_none() {
        assert_eq!(cli_entry(&ground("bare")), None);
    }

    fn context() -> ToolContext {
        ToolContext {
            checkout: PathBuf::from("/tmp/checkout"),
            call: "studio/01-workbench".to_owned(),
            variant: "b".to_owned(),
            port: 4402,
            calls_root: ".ethlete/design/calls".to_owned(),
            receipt: PathBuf::from("/tmp/receipt.json"),
        }
    }

    #[test]
    fn a_command_line_reads_back_as_the_context_that_wrote_it() {
        let written = context();

        assert_eq!(ToolContext::from_arguments(written.to_arguments()), Some(written));
    }

    #[test]
    fn the_app_start_carries_no_context() {
        assert_eq!(ToolContext::from_arguments(Vec::new()), None);
        assert_eq!(ToolContext::from_arguments(vec!["--checkout".to_owned()]), None);
    }

    #[test]
    fn a_command_line_that_names_no_call_is_refused() {
        let arguments = vec![SERVE_ARGUMENT.to_owned(), "--checkout".to_owned(), "/tmp".to_owned()];

        assert_eq!(ToolContext::from_arguments(arguments), None);
    }

    #[test]
    fn initialize_answers_in_the_protocol_the_client_asked_for() {
        let request = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": { "protocolVersion": "2024-11-05" },
        });

        let answer = answer(&context(), &request).expect("initialize is answered");

        assert_eq!(
            answer.pointer("/result/protocolVersion").and_then(Value::as_str),
            Some("2024-11-05")
        );
        assert_eq!(
            answer.pointer("/result/serverInfo/name").and_then(Value::as_str),
            Some(SERVER_NAME)
        );
    }

    #[test]
    fn a_notification_is_not_answered() {
        let request = json!({ "jsonrpc": "2.0", "method": "notifications/initialized" });

        assert!(answer(&context(), &request).is_none());
    }

    #[test]
    fn every_tool_takes_no_argument() {
        let answer = answer(
            &context(),
            &json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }),
        )
        .expect("tools/list is answered");
        let listed = answer
            .pointer("/result/tools")
            .and_then(Value::as_array)
            .expect("the answer lists tools");

        assert_eq!(listed.len(), TOOLS.len());

        for tool in listed {
            assert_eq!(
                tool.pointer("/inputSchema/properties").and_then(Value::as_object),
                Some(&serde_json::Map::new())
            );
        }
    }

    #[test]
    fn an_unknown_method_is_refused() {
        let answer = answer(
            &context(),
            &json!({ "jsonrpc": "2.0", "id": 3, "method": "resources/list" }),
        )
        .expect("an unknown method is answered");

        assert_eq!(answer.pointer("/error/code").and_then(Value::as_i64), Some(-32601));
    }

    #[test]
    fn a_tool_that_cannot_read_its_file_reports_it_as_a_tool_error() {
        let request = json!({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": { "name": "read_call" },
        });

        let answer = answer(&context(), &request).expect("tools/call is answered");

        assert_eq!(answer.pointer("/result/isError").and_then(Value::as_bool), Some(true));
        assert!(answer.get("error").is_none());
    }

    #[test]
    fn a_call_without_a_fixture_says_so_instead_of_failing() {
        let request = json!({
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": { "name": "read_fixture" },
        });

        let answer = answer(&context(), &request).expect("tools/call is answered");

        assert_eq!(answer.pointer("/result/isError").and_then(Value::as_bool), Some(false));
    }

    #[test]
    fn a_variant_no_run_ever_checked_carries_no_receipt() {
        assert!(design_check(
            "/tmp/never-checked".to_owned(),
            "studio/01-workbench".to_owned(),
            "z".to_owned()
        )
        .is_none());
    }

    #[test]
    fn a_check_that_ran_reads_back_as_the_receipt_it_wrote() {
        let mut context = context();
        context.receipt = receipt_path("/tmp/written", "studio/01-workbench", "b");

        write_receipt(&context, false, "the frame threw");

        let read = design_check(
            "/tmp/written".to_owned(),
            "studio/01-workbench".to_owned(),
            "b".to_owned(),
        )
        .expect("the receipt is there");

        assert!(!read.ok);
        assert_eq!(read.said, "the frame threw");
    }

    #[test]
    fn a_receipt_path_is_the_same_one_every_time_for_one_variant() {
        let first = receipt_path("/home/tom/dev/ethlete-sdk", "studio/01-workbench", "b");
        let again = receipt_path("/home/tom/dev/ethlete-sdk", "studio/01-workbench", "b");
        let other = receipt_path("/home/tom/dev/ethlete-sdk", "studio/01-workbench", "c");

        assert_eq!(first, again);
        assert_ne!(first, other);
    }
}
