use serde::Serialize;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BuiltInGoogleClient {
    pub client_id: String,
    pub client_secret: String,
}

fn client_from(id: Option<&str>, secret: Option<&str>) -> Option<BuiltInGoogleClient> {
    let client_id = id?.trim();
    let client_secret = secret?.trim();

    if client_id.is_empty() || client_secret.is_empty() {
        return None;
    }

    Some(BuiltInGoogleClient {
        client_id: client_id.into(),
        client_secret: client_secret.into(),
    })
}

/// The shared OAuth client a release build carries, or `None` when it was built without one.
///
/// A Desktop client's secret is not confidential, which is why it may be handed to the window. It is
/// read at compile time so it never sits in the repository.
#[tauri::command]
pub fn google_builtin_client() -> Option<BuiltInGoogleClient> {
    client_from(
        option_env!("TIMETRACK_GOOGLE_CLIENT_ID"),
        option_env!("TIMETRACK_GOOGLE_CLIENT_SECRET"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn needs_both_halves() {
        assert_eq!(client_from(Some("id"), None), None);
        assert_eq!(client_from(None, Some("secret")), None);
        assert_eq!(client_from(Some(" "), Some("secret")), None);
    }

    #[test]
    fn trims_what_the_build_environment_carried() {
        assert_eq!(
            client_from(Some(" id\n"), Some("secret ")),
            Some(BuiltInGoogleClient {
                client_id: "id".into(),
                client_secret: "secret".into()
            })
        );
    }
}
