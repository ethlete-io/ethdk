use chrono::{Local, NaiveDate, TimeZone};
use std::io::{BufRead, IsTerminal, Write};
use std::path::PathBuf;
use std::process::ExitCode;
use timetrack_lib::store_key;

const USAGE: &str = "\
Moves the Timetrack store key between machines as a passphrase-protected file.

  store-key export <file> [--service <name>]
  store-key import <file> [--service <name>] [--replace]
  store-key check <data-dir> <YYYY-MM-DD> [--service <name>]

The passphrase is read from stdin, so it reaches neither the shell history nor a log. --service
defaults to the app's own keyring service.";

struct Args {
    command: String,
    target: PathBuf,
    day: Option<String>,
    service: String,
    replace: bool,
}

fn parse() -> Option<Args> {
    let mut positional = Vec::new();
    let mut service = store_key::DEFAULT_SERVICE.to_owned();
    let mut replace = false;
    let mut args = std::env::args().skip(1);

    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--service" => service = args.next()?,
            "--replace" => replace = true,
            _ if arg.starts_with("--") => return None,
            _ => positional.push(arg),
        }
    }

    let mut positional = positional.into_iter();

    Some(Args {
        command: positional.next()?,
        target: positional.next()?.into(),
        day: positional.next(),
        service,
        replace,
    })
}

/// Hides the typed passphrase on a Unix terminal. Windows consoles keep echoing it, which is why
/// the import there is piped from `Read-Host -AsSecureString`.
struct HiddenInput(bool);

impl HiddenInput {
    fn new() -> Self {
        Self(cfg!(unix) && stty("-echo"))
    }
}

impl Drop for HiddenInput {
    fn drop(&mut self) {
        if self.0 {
            stty("echo");
            eprintln!();
        }
    }
}

fn stty(setting: &str) -> bool {
    std::process::Command::new("stty")
        .arg(setting)
        .stdin(std::process::Stdio::inherit())
        .status()
        .is_ok_and(|status| status.success())
}

fn passphrase(prompt: &str) -> std::io::Result<String> {
    let stdin = std::io::stdin();
    let interactive = stdin.is_terminal();
    let _hidden = interactive.then(|| {
        eprint!("{prompt}: ");
        let _ = std::io::stderr().flush();
        HiddenInput::new()
    });
    let mut line = String::new();

    stdin.lock().read_line(&mut line)?;

    Ok(line.trim_end_matches(['\r', '\n']).to_owned())
}

fn day_bounds(day: &str) -> Result<(i64, i64), String> {
    let date = NaiveDate::parse_from_str(day, "%Y-%m-%d").map_err(|_| format!("{day} is not a YYYY-MM-DD day"))?;
    let at = |date: NaiveDate| {
        Local
            .from_local_datetime(&date.and_hms_opt(0, 0, 0).unwrap_or_default())
            .earliest()
            .map(|instant| instant.timestamp_millis())
            .ok_or_else(|| format!("{date} has no local midnight"))
    };

    Ok((at(date)?, at(date.succ_opt().ok_or("the day is out of range")?)?))
}

fn run(args: Args) -> Result<(), String> {
    match args.command.as_str() {
        "export" => {
            let first = passphrase("Passphrase").map_err(|error| error.to_string())?;

            if std::io::stdin().is_terminal() && passphrase("Repeat it").map_err(|error| error.to_string())? != first {
                return Err("the two passphrases differ".into());
            }

            store_key::export(&args.service, &first, &args.target).map_err(|error| error.to_string())?;
            eprintln!("Wrote the store key of {} to {}", args.service, args.target.display());
        }
        "import" => {
            let passphrase = passphrase("Passphrase").map_err(|error| error.to_string())?;

            store_key::import(&args.service, &passphrase, &args.target, args.replace)
                .map_err(|error| error.to_string())?;
            eprintln!("Stored the key as the store key of {}", args.service);
        }
        "check" => {
            let day = args.day.ok_or("check needs a day")?;
            let (from_ms, to_ms) = day_bounds(&day)?;
            let tally =
                store_key::check(&args.service, &args.target, from_ms, to_ms).map_err(|error| error.to_string())?;

            println!("{day}: {} events", tally.iter().map(|(_, count)| count).sum::<usize>());

            for (source, count) in tally {
                println!("  {source}: {count}");
            }
        }
        _ => return Err(USAGE.into()),
    }

    Ok(())
}

fn main() -> ExitCode {
    let Some(args) = parse() else {
        eprintln!("{USAGE}");
        return ExitCode::FAILURE;
    };

    match run(args) {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("{message}");
            ExitCode::FAILURE
        }
    }
}
