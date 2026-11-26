const DESIGN_ACTION_LOG: &str = "ethlete-studio-design-actions.log";

fn one_line(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn action_line(at: &str, command: &str, part: &str, status: u16, message: &str) -> String {
    format!(
        "{} {} part={} status={} {}\n",
        one_line(at),
        one_line(command),
        one_line(part),
        status,
        one_line(message)
    )
}

fn append_line(path: &std::path::Path, line: &str) {
    use std::io::Write;

    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = file.write_all(line.as_bytes());
    }
}

#[tauri::command]
pub fn design_action_refused(at: String, command: String, part: String, status: u16, message: String) {
    append_line(
        &std::env::temp_dir().join(DESIGN_ACTION_LOG),
        &action_line(&at, &command, &part, status, &message),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_refused_action_is_one_line_appended_after_the_earlier_ones() {
        let path = std::env::temp_dir().join(format!("studio-action-test-{}.log", std::process::id()));
        let _ = std::fs::remove_file(&path);

        append_line(
            &path,
            &action_line(
                "2026-11-03T13:13:00.000Z",
                "sketch-merge",
                "studio/title-bar",
                422,
                "changed\nrebase first",
            ),
        );
        append_line(
            &path,
            &action_line("2026-11-03T13:14:00.000Z", "sketch-decision", "", 400, "no"),
        );

        let log = std::fs::read_to_string(&path).unwrap();
        let _ = std::fs::remove_file(&path);

        assert_eq!(
            log,
            "2026-11-03T13:13:00.000Z sketch-merge part=studio/title-bar status=422 changed rebase first\n\
             2026-11-03T13:14:00.000Z sketch-decision part= status=400 no\n"
        );
    }
}
