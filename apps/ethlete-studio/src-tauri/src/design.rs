use serde::Serialize;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::call_source::{call_object, Node, Value};

const DEFAULT_PORT: u16 = 4402;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CallVariant {
    pub key: String,
    pub name: String,
    pub round: Option<String>,
    pub verdict: Option<String>,
    pub claim: String,
    pub cost: String,
}

/// One part of a wireframe's inventory: an SDK component, or a new one with its own component call.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InventoryPart {
    pub part: String,
    pub sdk: Option<String>,
    pub new: bool,
    pub call: Option<String>,
}

/// One pass over a call, as the call file declares it.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CallRound {
    pub key: String,
    pub title: String,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Call {
    pub slug: String,
    pub feature: Option<String>,
    /// Where the call sits in the design order, from `themes` to `prototype`. A call without one is loose.
    pub stage: Option<String>,
    /// A call made before the stage was required. It needs no stage.
    pub legacy: bool,
    /// `shipped` or `superseded`. A closed call is settled, whatever its variants say.
    pub closed: Option<String>,
    /// The slug of the call this one is parked on. It is on hold until that call settles.
    pub waits_for: Option<String>,
    /// The parts a wireframe lists, the queue of component calls. Empty when it declares none.
    pub inventory: Vec<InventoryPart>,
    pub eyebrow: String,
    pub headline: String,
    pub intro: String,
    pub frame_width: u32,
    /// `wireframe` or `design`. A call that names none draws the real thing.
    pub mode: String,
    /// Whether a full agent session already wrote its state into the call's folder.
    pub handoff: bool,
    /// When the call's folder was last written, in seconds since the epoch.
    pub touched: u64,
    /// Every round the call declares, in the order it wrote them. A call may declare none.
    pub rounds: Vec<CallRound>,
    pub variants: Vec<CallVariant>,
}

/// Where a session that grew too long writes down what the next one has to know.
pub const HANDOFF_FILE: &str = "handoff.md";

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub calls_root: String,
    pub port: u16,
    pub default_call: Option<String>,
    /// The themes each design project names, keyed by the project, the first segment of a slug.
    pub themes: BTreeMap<String, Themes>,
    pub calls: Vec<Call>,
}

/// The surface and colour themes a design project draws in. The first name of each is the default.
#[derive(Debug, Default, Serialize, PartialEq)]
pub struct Themes {
    pub surface: Vec<String>,
    pub color: Vec<String>,
}

/// Where a checkout keeps its design work. Every repository holds its own, so a call argues in
/// the repository it is about.
pub const DESIGN_DIR: &str = ".ethlete/design";

fn config_path(checkout: &str) -> PathBuf {
    Path::new(checkout).join(DESIGN_DIR).join("config.json")
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

pub const DESIGN_MODE: &str = "design";

const CLOSED_STATES: [&str; 2] = ["shipped", "superseded"];

fn text_of(node: &Node, field: &str) -> Option<String> {
    node.text(field).map(one_line)
}

fn parse_rounds(call: &Node) -> Vec<CallRound> {
    call.list("rounds")
        .iter()
        .filter_map(|round| {
            Some(CallRound {
                key: text_of(round, "key")?,
                title: text_of(round, "title").unwrap_or_default(),
            })
        })
        .collect()
}

fn parse_inventory(source: &str, call: &Node) -> Vec<InventoryPart> {
    call.list("inventory")
        .iter()
        .filter_map(|item| {
            let is_new = item.property("new").is_some_and(|property| {
                source
                    .get(property.node.start..property.node.end)
                    .is_some_and(|raw| raw.trim() == "true")
            });

            Some(InventoryPart {
                part: text_of(item, "part")?,
                sdk: text_of(item, "sdk"),
                new: is_new,
                call: text_of(item, "call"),
            })
        })
        .collect()
}

fn parse_variants(call: &Node) -> Vec<CallVariant> {
    call.list("variants")
        .iter()
        .filter_map(|variant| {
            Some(CallVariant {
                key: text_of(variant, "key")?,
                name: text_of(variant, "name").unwrap_or_default(),
                round: text_of(variant, "round"),
                verdict: text_of(variant, "verdict"),
                claim: text_of(variant, "claim").unwrap_or_default(),
                cost: text_of(variant, "cost").unwrap_or_default(),
            })
        })
        .collect()
}

fn parse_call(slug: &str, source: &str) -> Call {
    let call = call_object(source).unwrap_or(Node {
        start: 0,
        end: 0,
        value: Value::Other,
    });

    Call {
        slug: slug.to_owned(),
        feature: text_of(&call, "feature"),
        stage: text_of(&call, "stage"),
        legacy: call
            .property("legacy")
            .is_some_and(|property| source[property.node.start..property.node.end].trim() == "true"),
        closed: text_of(&call, "closed").filter(|state| CLOSED_STATES.contains(&state.as_str())),
        waits_for: text_of(&call, "waitsFor"),
        inventory: parse_inventory(source, &call),
        eyebrow: text_of(&call, "eyebrow").unwrap_or_default(),
        headline: text_of(&call, "headline").unwrap_or_default(),
        intro: text_of(&call, "intro").unwrap_or_default(),
        frame_width: call.number("frameWidth").map_or(0, |width| width as u32),
        mode: text_of(&call, "mode").unwrap_or_else(|| DESIGN_MODE.to_owned()),
        handoff: false,
        touched: 0,
        rounds: parse_rounds(&call),
        variants: parse_variants(&call),
    }
}

/// When a call last changed: the newest write among its own files, so a redrawn variant counts.
fn touched_at(directory: &Path) -> u64 {
    let entries = std::fs::read_dir(directory)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| entry.metadata().ok()?.modified().ok());

    entries
        .chain(std::fs::metadata(directory).ok().and_then(|meta| meta.modified().ok()))
        .max()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|since| since.as_secs())
        .unwrap_or_default()
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

fn names_of(list: Option<&serde_json::Value>) -> Vec<String> {
    list.and_then(serde_json::Value::as_array)
        .map(|names| {
            names
                .iter()
                .filter_map(|name| name.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

/// The themes of every design project that names at least one.
pub fn themes_of(config: &serde_json::Value) -> BTreeMap<String, Themes> {
    let Some(projects) = config.get("projects").and_then(serde_json::Value::as_object) else {
        return BTreeMap::new();
    };

    projects
        .iter()
        .filter_map(|(name, project)| {
            let themes = project.get("themes")?;
            let themes = Themes {
                surface: names_of(themes.get("surface")),
                color: names_of(themes.get("color")),
            };

            (themes != Themes::default()).then(|| (name.clone(), themes))
        })
        .collect()
}

/// The port the checkout's design server draws at.
pub fn port_of(config: &serde_json::Value) -> u16 {
    config
        .get("port")
        .and_then(serde_json::Value::as_u64)
        .and_then(|value| u16::try_from(value).ok())
        .unwrap_or(DEFAULT_PORT)
}

pub fn calls_root(checkout: &str) -> PathBuf {
    Path::new(checkout).join(DESIGN_DIR).join("calls")
}

#[tauri::command]
pub async fn design_project(checkout: String) -> Result<Project, String> {
    tauri::async_runtime::spawn_blocking(move || project(&checkout))
        .await
        .map_err(|error| error.to_string())?
}

fn project(checkout: &str) -> Result<Project, String> {
    let config = read_config(checkout)?;
    let root = calls_root(checkout);

    let calls = call_slugs(&root)
        .into_iter()
        .filter_map(|slug| {
            let source = std::fs::read_to_string(root.join(&slug).join("call.ts")).ok()?;
            let mut call = parse_call(&slug, &source);

            call.handoff = root.join(&slug).join(HANDOFF_FILE).exists();
            call.touched = touched_at(&root.join(&slug));

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
        themes: themes_of(&config),
        calls,
    })
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
  variants: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · 5rem, the full clock',
      claim: 'What the app draws today.',
      cost: 'Three of the five characters never change.',
      verdict: 'rejected',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · 3.4rem, the hour alone',
      claim: 'The :00 goes.',
      load: () => import('./variant-b'),
    },
  ],
});
"#;

    #[test]
    fn a_call_reads_its_headline_and_its_variants() {
        let call = parse_call("timetrack/kerbe/09-gutter", CALL);

        assert_eq!(call.eyebrow, "Kerbe · call 9");
        assert_eq!(call.headline, "What the clock column costs the day");
        assert_eq!(call.frame_width, 1100);
        assert_eq!(call.variants.len(), 2);
    }

    #[test]
    fn a_call_reads_the_rounds_it_declares() {
        let rounds = parse_call("x", CALL).rounds;

        assert_eq!(rounds.len(), 1);
        assert_eq!(rounds[0].key, "r1");
        assert_eq!(rounds[0].title, "How wide the clock column is");
    }

    #[test]
    fn a_call_that_declares_no_round_reads_none() {
        assert!(parse_call(
            "x",
            "defineCall({\n  variants: [\n    {\n      key: 'a',\n    },\n  ],\n});"
        )
        .rounds
        .is_empty());
    }

    #[test]
    fn a_call_that_names_no_mode_draws_the_real_thing() {
        assert_eq!(parse_call("x", CALL).mode, DESIGN_MODE);
    }

    #[test]
    fn a_call_reads_the_mode_it_declares() {
        let source = CALL.replace("  frameWidth: 1100,", "  frameWidth: 1100,\n  mode: 'wireframe',");

        assert_eq!(parse_call("x", &source).mode, "wireframe");
    }

    #[test]
    fn prose_that_holds_the_word_mode_is_not_the_mode() {
        let source = CALL.replace("'The gutter is 5rem wide.'", "'The mode: it draws the day.'");

        assert_eq!(parse_call("x", &source).mode, DESIGN_MODE);
    }

    #[test]
    fn a_call_reads_the_feature_it_belongs_to() {
        assert_eq!(parse_call("x", CALL).feature.as_deref(), Some("The clock column"));
    }

    #[test]
    fn a_wireframe_reads_its_inventory() {
        let source = CALL.replace(
            "  eyebrow:",
            "  inventory: [\n    { part: 'Search field', sdk: 'et-input' },\n    { part: \"Match card\", new: true, call: 'tomflix/components/match-card' },\n    { part: 'Badge', new: true },\n  ],\n  eyebrow:",
        );
        let inventory = parse_call("x", &source).inventory;

        assert_eq!(inventory.len(), 3);
        assert_eq!(inventory[0].sdk.as_deref(), Some("et-input"));
        assert!(!inventory[0].new);
        assert!(inventory[1].new);
        assert_eq!(inventory[1].part, "Match card");
        assert_eq!(inventory[1].call.as_deref(), Some("tomflix/components/match-card"));
        assert_eq!(inventory[2].call, None);
        assert!(parse_call("x", CALL).inventory.is_empty());
    }

    #[test]
    fn an_inventory_that_cannot_be_read_is_none() {
        let source = CALL.replace("  eyebrow:", "  inventory: parts(),\n  eyebrow:");

        assert!(parse_call("x", &source).inventory.is_empty());
    }

    #[test]
    fn a_call_reads_its_stage() {
        let staged = CALL.replace("  eyebrow:", "  stage: 'page',\n  eyebrow:");

        assert_eq!(parse_call("x", &staged).stage.as_deref(), Some("page"));
        assert_eq!(parse_call("x", CALL).stage, None);
    }

    #[test]
    fn a_call_reads_whether_it_is_legacy() {
        let legacy = CALL.replace("  eyebrow:", "  legacy: true,\n  eyebrow:");
        let not = CALL.replace("  eyebrow:", "  legacy: false,\n  eyebrow:");

        assert!(parse_call("x", &legacy).legacy);
        assert!(!parse_call("x", &not).legacy);
        assert!(!parse_call("x", CALL).legacy);
    }

    #[test]
    fn a_call_reads_whether_it_is_closed() {
        let shipped = CALL.replace("  eyebrow:", "  closed: 'shipped',\n  eyebrow:");
        let superseded = CALL.replace("  eyebrow:", "  closed: 'superseded',\n  eyebrow:");
        let unknown = CALL.replace("  eyebrow:", "  closed: 'done',\n  eyebrow:");

        assert_eq!(parse_call("x", &shipped).closed.as_deref(), Some("shipped"));
        assert_eq!(parse_call("x", &superseded).closed.as_deref(), Some("superseded"));
        assert_eq!(parse_call("x", &unknown).closed, None);
        assert_eq!(parse_call("x", CALL).closed, None);
    }

    #[test]
    fn a_call_reads_the_call_it_waits_for() {
        let parked = CALL.replace("  eyebrow:", "  waitsFor: 'timetrack/kerbe/08-strip',\n  eyebrow:");

        assert_eq!(
            parse_call("x", &parked).waits_for.as_deref(),
            Some("timetrack/kerbe/08-strip")
        );
        assert_eq!(parse_call("x", CALL).waits_for, None);
    }

    #[test]
    fn a_call_without_a_feature_is_loose() {
        let loose = CALL.replace("  feature: 'The clock column',\n", "");

        assert_eq!(parse_call("x", &loose).feature, None);
    }

    #[test]
    fn a_wrapped_intro_reads_as_one_line() {
        let call = parse_call("timetrack/kerbe/09-gutter", CALL);

        assert_eq!(call.intro, "The gutter is 5rem wide.");
    }

    #[test]
    fn a_variant_carries_its_claim_and_its_cost() {
        let variants = parse_call("x", CALL).variants;

        assert_eq!(variants[0].claim, "What the app draws today.");
        assert_eq!(variants[0].cost, "Three of the five characters never change.");
        assert_eq!(variants[1].cost, "");
    }

    #[test]
    fn a_round_key_is_not_read_as_a_variant() {
        let keys: Vec<String> = parse_call("x", CALL)
            .variants
            .into_iter()
            .map(|variant| variant.key)
            .collect();

        assert_eq!(keys, vec!["a".to_owned(), "b".to_owned()]);
    }

    const PROSE_WITH_A_KEY: &str = "'The chart keys the colour on series key: the first render hands out slots.'";

    #[test]
    fn prose_that_holds_the_word_key_is_not_a_variant() {
        let source = CALL.replace("'The :00 goes.'", PROSE_WITH_A_KEY);
        let call = parse_call("x", &source);
        let keys: Vec<String> = call.variants.iter().map(|variant| variant.key.clone()).collect();

        assert_eq!(keys, vec!["a".to_owned(), "b".to_owned()]);
        assert_eq!(call.variants[1].claim, PROSE_WITH_A_KEY.trim_matches('\''));
    }

    #[test]
    fn a_double_quoted_claim_reads_whole() {
        let source = CALL.replace("'The :00 goes.'", "\"The day's :00 goes.\"");

        assert_eq!(parse_call("x", &source).variants[1].claim, "The day's :00 goes.");
    }

    #[test]
    fn a_variant_carries_its_round_and_its_verdict() {
        let variants = parse_call("x", CALL).variants;

        assert_eq!(variants[0].round.as_deref(), Some("r1"));
        assert_eq!(variants[0].verdict.as_deref(), Some("rejected"));
        assert_eq!(variants[1].verdict, None);
        assert_eq!(variants[1].name, "B · 3.4rem, the hour alone");
    }

    #[test]
    fn a_project_reads_the_themes_it_names() {
        let config = serde_json::json!({
            "projects": {
                "components": { "themes": { "surface": ["light", "dark"], "color": ["brand", "danger", 3] } },
                "shop": { "themes": { "color": ["brand"] } },
                "plain": { "styles": [] },
                "empty": { "themes": {} }
            }
        });
        let themes = themes_of(&config);

        assert_eq!(themes.keys().collect::<Vec<_>>(), ["components", "shop"]);
        assert_eq!(themes["components"].surface, ["light", "dark"]);
        assert_eq!(themes["components"].color, ["brand", "danger"]);
        assert!(themes["shop"].surface.is_empty());
    }

    #[test]
    fn a_config_without_projects_reads_no_themes() {
        assert!(themes_of(&serde_json::json!({ "port": 4402 })).is_empty());
    }

    fn a_checkout(name: &str) -> PathBuf {
        let checkout = std::env::temp_dir().join(format!("ethlete-studio-{}-{name}", std::process::id()));
        let call = checkout.join(DESIGN_DIR).join("calls/timetrack/kerbe/09-gutter");

        std::fs::create_dir_all(&call).unwrap();
        std::fs::write(call.join("call.ts"), CALL).unwrap();
        std::fs::write(
            config_path(&checkout.to_string_lossy()),
            r#"{ "port": 4405, "defaultCall": "timetrack/kerbe/09-gutter" }"#,
        )
        .unwrap();

        checkout
    }

    #[test]
    fn a_checkout_reports_the_calls_under_its_calls_root() {
        let checkout = a_checkout("read");
        let project = project(&checkout.to_string_lossy()).unwrap();

        assert_eq!(project.port, 4405);
        assert_eq!(project.default_call.as_deref(), Some("timetrack/kerbe/09-gutter"));
        assert_eq!(project.calls.len(), 1);
        assert_eq!(project.calls[0].slug, "timetrack/kerbe/09-gutter");
        assert!(!project.calls[0].handoff);

        std::fs::remove_dir_all(checkout).unwrap();
    }

    #[test]
    fn a_call_whose_folder_holds_a_handoff_says_so() {
        let checkout = a_checkout("handoff");

        std::fs::write(
            checkout
                .join(".ethlete/design/calls/timetrack/kerbe/09-gutter")
                .join(HANDOFF_FILE),
            "state",
        )
        .unwrap();

        let project = project(&checkout.to_string_lossy()).unwrap();

        assert!(project.calls[0].handoff);

        std::fs::remove_dir_all(checkout).unwrap();
    }

    #[test]
    fn a_checkout_without_a_config_says_so() {
        let missing = std::env::temp_dir().join("ethlete-studio-no-such-checkout");

        assert!(project(&missing.to_string_lossy()).is_err());
    }
}
