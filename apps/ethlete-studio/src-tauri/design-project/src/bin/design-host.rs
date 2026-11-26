use std::process::ExitCode;

fn main() -> ExitCode {
    let Some(checkout) = std::env::args().nth(1) else {
        eprintln!("usage: design-host <checkout>");
        return ExitCode::FAILURE;
    };

    match ethlete_studio_design::design::project(&checkout)
        .and_then(|project| serde_json::to_string(&project).map_err(|error| error.to_string()))
    {
        Ok(json) => {
            println!("{json}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("{error}");
            ExitCode::FAILURE
        }
    }
}
