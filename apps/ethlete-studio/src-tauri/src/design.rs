use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CallOption {
    pub key: String,
    pub name: String,
    pub round: Option<String>,
    pub verdict: Option<String>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Call {
    pub slug: String,
    pub eyebrow: String,
    pub headline: String,
    pub frame_width: u32,
    pub options: Vec<CallOption>,
}

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

/// The value of `field: '…'`, from the first line that opens it. A value written over more
/// than one line keeps only its first line, which is enough for the fields read here.
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
            return Some(value);
        } else {
            value.push(character);
        }
    }

    None
}

fn number_field(source: &str, field: &str) -> Option<u32> {
    let after = source.split_once(&format!("{field}:"))?.1;

    after.trim_start().split(|c: char| !c.is_ascii_digit()).next()?.parse().ok()
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
            })
        })
        .collect()
}

fn parse_call(slug: &str, source: &str) -> Call {
    Call {
        slug: slug.to_owned(),
        eyebrow: string_field(source, "eyebrow").unwrap_or_default(),
        headline: string_field(source, "headline").unwrap_or_default(),
        frame_width: number_field(source, "frameWidth").unwrap_or_default(),
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

fn read_config(checkout: &str) -> Result<serde_json::Value, String> {
    let path = config_path(checkout);
    let text = std::fs::read_to_string(&path)
        .map_err(|error| format!("Unable to read {}: {error}", path.to_string_lossy()))?;

    serde_json::from_str(&text).map_err(|error| format!("{} is not valid JSON: {error}", path.to_string_lossy()))
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
            let end = starts.iter().find(|next| *next > start).copied().unwrap_or(region.len());
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
            let line_end = block[at..].find('\n').map(|offset| at + offset + 1).unwrap_or(block.len());
            format!("{}{}", &block[..line_start], &block[line_end..])
        }
        (None, None) => block.to_owned(),
        (None, Some(value)) => {
            let indent: String = region[..start].chars().rev().take_while(|c| *c == ' ').collect();

            match block.find("load:") {
                Some(at) => {
                    let line_start = block[..at].rfind('\n').map(|offset| offset + 1).unwrap_or(0);

                    format!("{}{indent}verdict: '{value}',\n{}", &block[..line_start], &block[line_start..])
                }
                None => {
                    let key_line_end = block.find('\n').map(|offset| offset + 1).unwrap_or(block.len());

                    format!("{}{indent}verdict: '{value}',\n{}", &block[..key_line_end], &block[key_line_end..])
                }
            }
        }
    };

    Ok(format!("{}{}{}{}", &source[..region_start], &region[..start], replaced, &region[end..]))
}

#[tauri::command]
pub fn design_project(checkout: String) -> Result<Project, String> {
    let config = read_config(&checkout)?;
    let root = calls_root(&checkout, &config)?;

    let calls = call_slugs(&root)
        .into_iter()
        .filter_map(|slug| {
            let source = std::fs::read_to_string(root.join(&slug).join("call.ts")).ok()?;

            Some(parse_call(&slug, &source))
        })
        .collect();

    Ok(Project {
        calls_root: root.to_string_lossy().into_owned(),
        port: config.get("port").and_then(|value| value.as_u64()).unwrap_or(4402) as u16,
        default_call: config
            .get("defaultCall")
            .and_then(|value| value.as_str())
            .map(|value| value.to_owned()),
        calls,
    })
}

#[tauri::command]
pub fn design_set_verdict(checkout: String, slug: String, option: String, verdict: Option<String>) -> Result<(), String> {
    let path = call_file(&checkout, &slug)?;
    let source = std::fs::read_to_string(&path).map_err(|error| format!("Unable to read the call: {error}"))?;
    let written = write_verdict(&source, &option, verdict.as_deref())?;

    std::fs::write(&path, written).map_err(|error| format!("Unable to write the call: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    const CALL: &str = r#"import { defineCall } from '@design-explore';

export default defineCall({
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
    fn a_round_key_is_not_read_as_an_option() {
        let keys: Vec<String> = parse_call("x", CALL).options.into_iter().map(|option| option.key).collect();

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

        std::fs::remove_dir_all(checkout).unwrap();
    }

    #[test]
    fn a_verdict_reaches_the_call_file_on_disk() {
        let checkout = a_checkout("write");
        let path = checkout.to_string_lossy().into_owned();

        design_set_verdict(path.clone(), "kerbe/09-gutter".to_owned(), "b".to_owned(), Some("chosen".to_owned()))
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
}
