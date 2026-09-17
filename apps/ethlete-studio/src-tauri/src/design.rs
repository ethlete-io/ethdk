use serde::Serialize;
use std::path::{Path, PathBuf};

const DEFAULT_PORT: u16 = 4402;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CallOption {
    pub key: String,
    pub name: String,
    pub round: Option<String>,
    pub verdict: Option<String>,
    pub claim: String,
    pub cost: String,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Call {
    pub slug: String,
    pub feature: Option<String>,
    pub eyebrow: String,
    pub headline: String,
    pub intro: String,
    pub frame_width: u32,
    /// Whether a full agent session already wrote its state into the call's folder.
    pub handoff: bool,
    pub options: Vec<CallOption>,
}

/// Where a session that grew too long writes down what the next one has to know.
pub const HANDOFF_FILE: &str = "handoff.md";

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub calls_root: String,
    pub port: u16,
    pub default_call: Option<String>,
    pub calls: Vec<Call>,
}

fn config_path(checkout: &str) -> PathBuf {
    Path::new(checkout).join("design-explore.config.json")
}

/// The value of `field: '…'`. A value that wraps over more than one line comes back as one
/// line, because every reader of these fields shows them as prose.
fn string_field(source: &str, field: &str) -> Option<String> {
    let after = source.split_once(&format!("{field}:"))?.1;
    let start = after.find('\'')?;
    let rest = &after[start + 1..];
    let mut value = String::new();
    let mut escaped = false;

    for character in rest.chars() {
        if escaped {
            value.push(character);
            escaped = false;
        } else if character == '\\' {
            escaped = true;
        } else if character == '\'' {
            return Some(one_line(&value));
        } else {
            value.push(character);
        }
    }

    None
}

/// Whitespace that holds a line break becomes one space.
fn one_line(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut chars = value.chars().peekable();

    while let Some(character) = chars.next() {
        if !character.is_whitespace() {
            out.push(character);
            continue;
        }

        let mut run = String::from(character);

        while chars.peek().is_some_and(|next| next.is_whitespace()) {
            run.push(chars.next().expect("peeked"));
        }

        out.push(if run.contains('\n') { ' ' } else { character });
    }

    out
}

fn number_field(source: &str, field: &str) -> Option<u32> {
    let after = source.split_once(&format!("{field}:"))?.1;

    after
        .trim_start()
        .split(|c: char| !c.is_ascii_digit())
        .next()?
        .parse()
        .ok()
}

fn options_region(source: &str) -> Option<&str> {
    source.find("\n  options: [").map(|start| &source[start..])
}

fn parse_options(source: &str) -> Vec<CallOption> {
    let Some(region) = options_region(source) else {
        return Vec::new();
    };

    let starts: Vec<usize> = region.match_indices("key:").map(|(index, _)| index).collect();

    starts
        .iter()
        .enumerate()
        .filter_map(|(position, start)| {
            let end = starts.get(position + 1).copied().unwrap_or(region.len());
            let block = &region[*start..end];

            Some(CallOption {
                key: string_field(block, "key")?,
                name: string_field(block, "name").unwrap_or_default(),
                round: string_field(block, "round"),
                verdict: string_field(block, "verdict"),
                claim: string_field(block, "claim").unwrap_or_default(),
                cost: string_field(block, "cost").unwrap_or_default(),
            })
        })
        .collect()
}

fn parse_call(slug: &str, source: &str) -> Call {
    Call {
        slug: slug.to_owned(),
        feature: string_field(source, "feature"),
        eyebrow: string_field(source, "eyebrow").unwrap_or_default(),
        headline: string_field(source, "headline").unwrap_or_default(),
        intro: string_field(source, "intro").unwrap_or_default(),
        frame_width: number_field(source, "frameWidth").unwrap_or_default(),
        handoff: false,
        options: parse_options(source),
    }
}

fn call_slugs(root: &Path) -> Vec<String> {
    let mut slugs = Vec::new();
    let mut directories = vec![root.to_path_buf()];

    while let Some(directory) = directories.pop() {
        let Ok(entries) = std::fs::read_dir(&directory) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();

            if path.is_dir() {
                directories.push(path);
            } else if path.file_name().is_some_and(|name| name == "call.ts") {
                if let Ok(relative) = directory.strip_prefix(root) {
                    slugs.push(relative.to_string_lossy().replace('\\', "/"));
                }
            }
        }
    }

    slugs.sort();
    slugs
}

pub fn read_config(checkout: &str) -> Result<serde_json::Value, String> {
    let path = config_path(checkout);
    let text = std::fs::read_to_string(&path)
        .map_err(|error| format!("Unable to read {}: {error}", path.to_string_lossy()))?;

    serde_json::from_str(&text).map_err(|error| format!("{} is not valid JSON: {error}", path.to_string_lossy()))
}

/// The port the checkout's design server draws at.
pub fn port_of(config: &serde_json::Value) -> u16 {
    config
        .get("port")
        .and_then(serde_json::Value::as_u64)
        .and_then(|value| u16::try_from(value).ok())
        .unwrap_or(DEFAULT_PORT)
}

fn calls_root(checkout: &str, config: &serde_json::Value) -> Result<PathBuf, String> {
    let root = config
        .get("callsRoot")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "design-explore.config.json names no callsRoot.".to_owned())?;

    Ok(Path::new(checkout).join(root))
}

fn call_file(checkout: &str, slug: &str) -> Result<PathBuf, String> {
    let config = read_config(checkout)?;
    let path = calls_root(checkout, &config)?.join(slug).join("call.ts");

    if path.exists() {
        Ok(path)
    } else {
        Err(format!("No call at {}.", path.to_string_lossy()))
    }
}

/// Rewrite one option's verdict in place. `verdict` of `None` removes the field, which is how
/// an option goes back to open.
fn write_verdict(source: &str, option_key: &str, verdict: Option<&str>) -> Result<String, String> {
    let region_start = source
        .find("\n  options: [")
        .ok_or_else(|| "The call declares no options.".to_owned())?;
    let region = &source[region_start..];

    let starts: Vec<usize> = region.match_indices("key:").map(|(index, _)| index).collect();
    let position = starts
        .iter()
        .position(|start| {
            let end = starts
                .iter()
                .find(|next| *next > start)
                .copied()
                .unwrap_or(region.len());
            string_field(&region[*start..end], "key").as_deref() == Some(option_key)
        })
        .ok_or_else(|| format!("The call declares no option {option_key}."))?;

    let start = starts[position];
    let end = starts.get(position + 1).copied().unwrap_or(region.len());
    let block = &region[start..end];

    let replaced = match (block.find("verdict:"), verdict) {
        (Some(at), Some(value)) => {
            let line_end = block[at..].find('\n').map(|offset| at + offset).unwrap_or(block.len());
            format!("{}verdict: '{value}',{}", &block[..at], &block[line_end..])
        }
        (Some(at), None) => {
            let line_start = block[..at].rfind('\n').map(|offset| offset + 1).unwrap_or(0);
            let line_end = block[at..]
                .find('\n')
                .map(|offset| at + offset + 1)
                .unwrap_or(block.len());
            format!("{}{}", &block[..line_start], &block[line_end..])
        }
        (None, None) => block.to_owned(),
        (None, Some(value)) => {
            let indent: String = region[..start].chars().rev().take_while(|c| *c == ' ').collect();

            match block.find("load:") {
                Some(at) => {
                    let line_start = block[..at].rfind('\n').map(|offset| offset + 1).unwrap_or(0);

                    format!(
                        "{}{indent}verdict: '{value}',\n{}",
                        &block[..line_start],
                        &block[line_start..]
                    )
                }
                None => {
                    let key_line_end = block.find('\n').map(|offset| offset + 1).unwrap_or(block.len());

                    format!(
                        "{}{indent}verdict: '{value}',\n{}",
                        &block[..key_line_end],
                        &block[key_line_end..]
                    )
                }
            }
        }
    };

    Ok(format!(
        "{}{}{}{}",
        &source[..region_start],
        &region[..start],
        replaced,
        &region[end..]
    ))
}

#[tauri::command]
pub fn design_project(checkout: String) -> Result<Project, String> {
    let config = read_config(&checkout)?;
    let root = calls_root(&checkout, &config)?;

    let calls = call_slugs(&root)
        .into_iter()
        .filter_map(|slug| {
            let source = std::fs::read_to_string(root.join(&slug).join("call.ts")).ok()?;
            let mut call = parse_call(&slug, &source);

            call.handoff = root.join(&slug).join(HANDOFF_FILE).exists();

            Some(call)
        })
        .collect();

    Ok(Project {
        calls_root: root.to_string_lossy().into_owned(),
        port: port_of(&config),
        default_call: config
            .get("defaultCall")
            .and_then(|value| value.as_str())
            .map(|value| value.to_owned()),
        calls,
    })
}

#[tauri::command]
pub fn design_set_verdict(
    checkout: String,
    slug: String,
    option: String,
    verdict: Option<String>,
) -> Result<(), String> {
    let path = call_file(&checkout, &slug)?;
    let source = std::fs::read_to_string(&path).map_err(|error| format!("Unable to read the call: {error}"))?;
    let written = write_verdict(&source, &option, verdict.as_deref())?;

    std::fs::write(&path, written).map_err(|error| format!("Unable to write the call: {error}"))
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AddedOptions {
    pub round: String,
    pub keys: Vec<String>,
}

/// The text between the `[` of `header` and its matching `]`. Brackets inside a string literal
/// do not count, so a claim that holds one cannot end the array early.
fn array_span(source: &str, header: &str) -> Option<(usize, usize)> {
    let start = source.find(header)? + header.len();
    let bytes = source.as_bytes();
    let mut depth = 1_usize;
    let mut index = start;
    let mut quote: Option<u8> = None;
    let mut escaped = false;

    while index < bytes.len() {
        let byte = bytes[index];

        if escaped {
            escaped = false;
        } else if byte == b'\\' {
            escaped = true;
        } else if let Some(open) = quote {
            if byte == open {
                quote = None;
            }
        } else if byte == b'\'' || byte == b'"' || byte == b'`' {
            quote = Some(byte);
        } else if byte == b'[' {
            depth += 1;
        } else if byte == b']' {
            depth -= 1;

            if depth == 0 {
                return Some((start, index));
            }
        }

        index += 1;
    }

    None
}

fn keys_in(region: &str) -> Vec<String> {
    let starts: Vec<usize> = region.match_indices("key:").map(|(index, _)| index).collect();

    starts
        .iter()
        .enumerate()
        .filter_map(|(position, start)| {
            let end = starts.get(position + 1).copied().unwrap_or(region.len());

            string_field(&region[*start..end], "key")
        })
        .collect()
}

fn round_keys(source: &str) -> Vec<String> {
    match array_span(source, ROUNDS_HEADER) {
        Some((start, end)) => keys_in(&source[start..end]),
        None => Vec::new(),
    }
}

/// The next free round key. Rounds are `r1`, `r2`, and so on.
fn next_round_key(used: &[String]) -> String {
    (1..)
        .map(|number| format!("r{number}"))
        .find(|key| !used.iter().any(|taken| taken == key))
        .expect("an unused round key")
}

/// `count` keys that no option claims and no file in `dir` already holds.
fn next_option_keys(used: &[String], count: usize, dir: &Path) -> Vec<String> {
    let mut keys: Vec<String> = Vec::with_capacity(count);
    let free = |key: &str| !used.iter().any(|taken| taken == key) && !dir.join(option_file(key)).exists();

    for letter in b'a'..=b'z' {
        if keys.len() == count {
            break;
        }

        let key = (letter as char).to_string();

        if free(&key) {
            keys.push(key);
        }
    }

    let mut number = 1;

    while keys.len() < count {
        let key = format!("o{number}");

        if free(&key) {
            keys.push(key);
        }

        number += 1;
    }

    keys
}

fn option_file(key: &str) -> String {
    format!("option-{key}.ts")
}

/// A single-quoted TypeScript string literal holding `value`.
fn quoted(value: &str) -> String {
    format!("'{}'", value.replace('\\', "\\\\").replace('\'', "\\'"))
}

/// The part of a slug the drawn components name themselves after, for example
/// `studio/00-chat-surface` gives `chat-surface`.
fn base_name(slug: &str) -> String {
    let last = slug.rsplit('/').next().unwrap_or(slug);
    let trimmed = last.trim_start_matches(|c: char| c.is_ascii_digit() || c == '-');

    if trimmed.is_empty() {
        "call".to_owned()
    } else {
        trimmed.to_owned()
    }
}

fn pascal_case(value: &str) -> String {
    value
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut characters = part.chars();

            match characters.next() {
                Some(first) => first.to_ascii_uppercase().to_string() + characters.as_str(),
                None => String::new(),
            }
        })
        .collect()
}

/// An empty drawing: the component the frame loads, with nothing in it yet.
fn stub(slug: &str, key: &str) -> String {
    let base = base_name(slug);
    let selector = format!("ethlete-design-{base}-{key}");
    let class = format!("{}{}Component", pascal_case(&base), pascal_case(key));

    format!(
        "import {{ Component, ViewEncapsulation }} from '@angular/core';\n\n\
         @Component({{\n\
         \x20 selector: '{selector}',\n\
         \x20 template: ``,\n\
         \x20 styles: ``,\n\
         \x20 encapsulation: ViewEncapsulation.None,\n\
         }})\n\
         export default class {class} {{}}\n"
    )
}

/// Insert `block` as the last entry of the array `header` opens.
fn append_entry(source: &str, header: &str, block: &str) -> Result<String, String> {
    let (_, end) = array_span(source, header).ok_or_else(|| format!("The call declares no {}.", header.trim()))?;
    let at = source[..end].rfind('\n').map_or(end, |offset| offset + 1);

    Ok(format!("{}{block}{}", &source[..at], &source[at..]))
}

const ROUNDS_HEADER: &str = "\n  rounds: [";
const OPTIONS_HEADER: &str = "\n  options: [";

fn round_block(key: &str, title: &str) -> String {
    format!(
        "    {{\n      key: {},\n      title: {},\n      note: '',\n    }},\n",
        quoted(key),
        quoted(title)
    )
}

fn option_block(key: &str, round: &str) -> String {
    format!(
        "    {{\n      key: {},\n      round: {},\n      name: '',\n      claim: '',\n      cost: '',\n      load: () => import('./option-{key}'),\n    }},\n",
        quoted(key),
        quoted(round)
    )
}

/// Write the new round and its empty options into the call source.
fn add_options(source: &str, round: &str, title: &str, keys: &[String]) -> Result<String, String> {
    let with_round = match array_span(source, ROUNDS_HEADER) {
        Some(_) => append_entry(source, ROUNDS_HEADER, &round_block(round, title))?,
        None => {
            let at = source
                .find(OPTIONS_HEADER)
                .ok_or_else(|| "The call declares no options.".to_owned())?
                + 1;

            format!(
                "{}  rounds: [\n{}  ],\n{}",
                &source[..at],
                round_block(round, title),
                &source[at..]
            )
        }
    };

    keys.iter().try_fold(with_round, |carried, key| {
        append_entry(&carried, OPTIONS_HEADER, &option_block(key, round))
    })
}

/// Create `count` empty options for a new round of a call: one stub file each, and one entry each
/// in the call file. `name`, `claim` and `cost` stay empty, because only the drawing can argue.
#[tauri::command]
pub fn design_add_options(
    checkout: String,
    slug: String,
    count: u32,
    round_title: String,
) -> Result<AddedOptions, String> {
    if count == 0 {
        return Err("Ask for at least one option.".to_owned());
    }

    let path = call_file(&checkout, &slug)?;
    let dir = path
        .parent()
        .ok_or_else(|| "The call file has no folder.".to_owned())?
        .to_path_buf();
    let source = std::fs::read_to_string(&path).map_err(|error| format!("Unable to read the call: {error}"))?;

    let used: Vec<String> = parse_options(&source).into_iter().map(|option| option.key).collect();
    let keys = next_option_keys(&used, count as usize, &dir);
    let round = next_round_key(&round_keys(&source));
    let written = add_options(&source, &round, &round_title, &keys)?;

    for key in &keys {
        std::fs::write(dir.join(option_file(key)), stub(&slug, key))
            .map_err(|error| format!("Unable to write {}: {error}", option_file(key)))?;
    }

    std::fs::write(&path, written).map_err(|error| format!("Unable to write the call: {error}"))?;

    Ok(AddedOptions { round, keys })
}

#[cfg(test)]
mod tests {
    use super::*;

    const CALL: &str = r#"import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The clock column',
  eyebrow: 'Kerbe · call 9',
  headline: 'What the clock column costs the day',
  intro:
    'The gutter is 5rem wide.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'How wide the clock column is',
      note: 'B won.',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · 5rem, the full clock',
      claim: 'What the app draws today.',
      cost: 'Three of the five characters never change.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · 3.4rem, the hour alone',
      claim: 'The :00 goes.',
      load: () => import('./option-b'),
    },
  ],
});
"#;

    #[test]
    fn a_call_reads_its_headline_and_its_options() {
        let call = parse_call("kerbe/09-gutter", CALL);

        assert_eq!(call.eyebrow, "Kerbe · call 9");
        assert_eq!(call.headline, "What the clock column costs the day");
        assert_eq!(call.frame_width, 1100);
        assert_eq!(call.options.len(), 2);
    }

    #[test]
    fn a_call_reads_the_feature_it_belongs_to() {
        assert_eq!(parse_call("x", CALL).feature.as_deref(), Some("The clock column"));
    }

    #[test]
    fn a_call_without_a_feature_is_loose() {
        let loose = CALL.replace("  feature: 'The clock column',\n", "");

        assert_eq!(parse_call("x", &loose).feature, None);
    }

    #[test]
    fn a_wrapped_intro_reads_as_one_line() {
        let call = parse_call("kerbe/09-gutter", CALL);

        assert_eq!(call.intro, "The gutter is 5rem wide.");
    }

    #[test]
    fn an_option_carries_its_claim_and_its_cost() {
        let options = parse_call("x", CALL).options;

        assert_eq!(options[0].claim, "What the app draws today.");
        assert_eq!(options[0].cost, "Three of the five characters never change.");
        assert_eq!(options[1].cost, "");
    }

    #[test]
    fn a_round_key_is_not_read_as_an_option() {
        let keys: Vec<String> = parse_call("x", CALL)
            .options
            .into_iter()
            .map(|option| option.key)
            .collect();

        assert_eq!(keys, vec!["a".to_owned(), "b".to_owned()]);
    }

    #[test]
    fn an_option_carries_its_round_and_its_verdict() {
        let options = parse_call("x", CALL).options;

        assert_eq!(options[0].round.as_deref(), Some("r1"));
        assert_eq!(options[0].verdict.as_deref(), Some("rejected"));
        assert_eq!(options[1].verdict, None);
        assert_eq!(options[1].name, "B · 3.4rem, the hour alone");
    }

    #[test]
    fn a_verdict_lands_on_an_option_that_had_none() {
        let written = write_verdict(CALL, "b", Some("chosen")).unwrap();
        let options = parse_call("x", &written).options;

        assert_eq!(options[1].verdict.as_deref(), Some("chosen"));
        assert_eq!(options[0].verdict.as_deref(), Some("rejected"));
        assert!(written.contains("      verdict: 'chosen',\n      load: () => import('./option-b'),"));
    }

    #[test]
    fn a_verdict_replaces_the_one_an_option_had() {
        let written = write_verdict(CALL, "a", Some("chosen")).unwrap();

        assert_eq!(parse_call("x", &written).options[0].verdict.as_deref(), Some("chosen"));
        assert!(!written.contains("rejected"));
    }

    #[test]
    fn no_verdict_opens_the_option_again() {
        let written = write_verdict(CALL, "a", None).unwrap();

        assert_eq!(parse_call("x", &written).options[0].verdict, None);
        assert!(written.contains("      claim: 'What the app draws today.',"));
    }

    #[test]
    fn a_write_leaves_every_other_line_alone() {
        let written = write_verdict(CALL, "b", Some("chosen")).unwrap();

        assert_eq!(written.lines().count(), CALL.lines().count() + 1);
        assert!(written.contains("  intro:\n    'The gutter is 5rem wide.',"));
    }

    #[test]
    fn an_unknown_option_is_refused() {
        assert!(write_verdict(CALL, "z", Some("chosen")).is_err());
    }

    fn a_checkout(name: &str) -> PathBuf {
        let checkout = std::env::temp_dir().join(format!("ethlete-studio-{}-{name}", std::process::id()));
        let call = checkout.join("design/calls/kerbe/09-gutter");

        std::fs::create_dir_all(&call).unwrap();
        std::fs::write(call.join("call.ts"), CALL).unwrap();
        std::fs::write(
            checkout.join("design-explore.config.json"),
            r#"{ "port": 4405, "callsRoot": "design/calls", "defaultCall": "kerbe/09-gutter" }"#,
        )
        .unwrap();

        checkout
    }

    #[test]
    fn a_checkout_reports_the_calls_under_its_calls_root() {
        let checkout = a_checkout("read");
        let project = design_project(checkout.to_string_lossy().into_owned()).unwrap();

        assert_eq!(project.port, 4405);
        assert_eq!(project.default_call.as_deref(), Some("kerbe/09-gutter"));
        assert_eq!(project.calls.len(), 1);
        assert_eq!(project.calls[0].slug, "kerbe/09-gutter");
        assert!(!project.calls[0].handoff);

        std::fs::remove_dir_all(checkout).unwrap();
    }

    #[test]
    fn a_call_whose_folder_holds_a_handoff_says_so() {
        let checkout = a_checkout("handoff");

        std::fs::write(
            checkout.join("design/calls/kerbe/09-gutter").join(HANDOFF_FILE),
            "state",
        )
        .unwrap();

        let project = design_project(checkout.to_string_lossy().into_owned()).unwrap();

        assert!(project.calls[0].handoff);

        std::fs::remove_dir_all(checkout).unwrap();
    }

    #[test]
    fn a_verdict_reaches_the_call_file_on_disk() {
        let checkout = a_checkout("write");
        let path = checkout.to_string_lossy().into_owned();

        design_set_verdict(
            path.clone(),
            "kerbe/09-gutter".to_owned(),
            "b".to_owned(),
            Some("chosen".to_owned()),
        )
        .unwrap();

        let project = design_project(path).unwrap();

        assert_eq!(project.calls[0].options[1].verdict.as_deref(), Some("chosen"));

        std::fs::remove_dir_all(checkout).unwrap();
    }

    #[test]
    fn a_checkout_without_a_config_says_so() {
        let missing = std::env::temp_dir().join("ethlete-studio-no-such-checkout");

        assert!(design_project(missing.to_string_lossy().into_owned()).is_err());
    }

    #[test]
    fn an_array_span_ignores_a_bracket_inside_a_string() {
        let source = "x\n  options: [\n    { claim: 'a [b] c' },\n  ],\n";
        let (start, end) = array_span(source, OPTIONS_HEADER).unwrap();

        assert!(source[start..end].contains("a [b] c"));
        assert_eq!(&source[end..], "],\n");
    }

    #[test]
    fn new_keys_skip_the_ones_the_call_already_claims() {
        let dir = std::env::temp_dir().join(format!("ethlete-studio-{}-keys", std::process::id()));

        std::fs::create_dir_all(&dir).unwrap();

        let used = vec!["a".to_owned(), "b".to_owned()];

        assert_eq!(next_option_keys(&used, 3, &dir), vec!["c", "d", "e"]);

        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_new_key_skips_a_file_that_already_exists() {
        let dir = std::env::temp_dir().join(format!("ethlete-studio-{}-orphan", std::process::id()));

        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("option-c.ts"), "").unwrap();

        let used = vec!["a".to_owned(), "b".to_owned()];

        assert_eq!(next_option_keys(&used, 1, &dir), vec!["d"]);

        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_new_round_reads_back_with_its_empty_options() {
        let keys = vec!["c".to_owned(), "d".to_owned()];
        let written = add_options(CALL, "r2", "How the rail folds", &keys).unwrap();
        let call = parse_call("kerbe/09-gutter", &written);

        assert_eq!(round_keys(&written), vec!["r1", "r2"]);
        assert_eq!(call.options.len(), 4);
        assert_eq!(call.options[2].key, "c");
        assert_eq!(call.options[2].round.as_deref(), Some("r2"));
        assert_eq!(call.options[2].name, "");
        assert_eq!(call.options[2].claim, "");
        assert!(call.options[3].verdict.is_none());
        assert!(written.contains("title: 'How the rail folds'"));
        assert!(written.contains("load: () => import('./option-d')"));
    }

    #[test]
    fn a_call_without_rounds_gets_one() {
        let source = CALL.replace(
            "  rounds: [\n    {\n      key: 'r1',\n      title: 'How wide the clock column is',\n      note: 'B won.',\n    },\n  ],\n",
            "",
        );

        assert!(array_span(&source, ROUNDS_HEADER).is_none());

        let written = add_options(&source, "r1", "What it asks", &["c".to_owned()]).unwrap();

        assert_eq!(round_keys(&written), vec!["r1"]);
        assert_eq!(parse_call("x", &written).options.len(), 3);
    }

    #[test]
    fn a_round_title_that_holds_a_quote_stays_one_string() {
        let written = add_options(CALL, "r2", "What the day's rail asks", &["c".to_owned()]).unwrap();

        assert!(written.contains(r"title: 'What the day\'s rail asks'"));
        assert_eq!(round_keys(&written), vec!["r1", "r2"]);
    }

    #[test]
    fn a_stub_names_itself_after_the_call() {
        let drawn = stub("studio/00-chat-surface", "d");

        assert!(drawn.contains("selector: 'ethlete-design-chat-surface-d'"));
        assert!(drawn.contains("export default class ChatSurfaceDComponent {}"));
        assert!(drawn.contains("template: ``"));
    }

    #[test]
    fn asking_for_options_writes_the_files_and_the_call() {
        let checkout = a_checkout("add");
        let path = checkout.to_string_lossy().into_owned();

        let added = design_add_options(
            path.clone(),
            "kerbe/09-gutter".to_owned(),
            2,
            "How the gutter folds".to_owned(),
        )
        .unwrap();

        assert_eq!(added.round, "r2");
        assert_eq!(added.keys, vec!["c", "d"]);

        let call = checkout.join("design/calls/kerbe/09-gutter");

        assert!(call.join("option-c.ts").exists());
        assert!(call.join("option-d.ts").exists());

        let project = design_project(path).unwrap();

        assert_eq!(project.calls[0].options.len(), 4);
        assert_eq!(project.calls[0].options[3].round.as_deref(), Some("r2"));

        std::fs::remove_dir_all(checkout).unwrap();
    }

    #[test]
    fn asking_for_no_options_says_so() {
        let checkout = a_checkout("none");
        let path = checkout.to_string_lossy().into_owned();

        assert!(design_add_options(path, "kerbe/09-gutter".to_owned(), 0, String::new()).is_err());

        std::fs::remove_dir_all(checkout).unwrap();
    }
}
