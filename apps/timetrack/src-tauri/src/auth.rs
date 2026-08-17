//! Checks that whoever is at the machine is the account's owner, by asking the operating system.
//!
//! No verdict of ours decides this and no secret of ours is stored: PAM owns the answer on Linux and
//! LocalAuthentication owns it on macOS, because both already hold the account's credential. The app
//! only ever learns whether the check passed.

use crate::error::TimetrackResult;

/// Whether the platform collects the secret itself.
///
/// `false` means the caller has to supply the account password, the way a lock screen does. `true`
/// means the operating system puts its own sheet up and a password must never be asked for or sent.
pub fn collects_its_own_secret() -> bool {
    cfg!(target_os = "macos")
}

/// Whether this machine can check the account password at all.
///
/// A machine that cannot must never lock the window. There would be no way back in, and a lock whose
/// only outcome is an unopenable app is worse than no lock at all.
pub fn can_verify() -> bool {
    platform::can_verify()
}

/// Whether the person at the machine proved they own the account.
///
/// `password` is required where `collects_its_own_secret()` is `false` and ignored where it is `true`.
/// A wrong password answers `Ok(false)`; only a platform that cannot check at all is an error.
pub fn verify_owner(password: Option<&str>) -> TimetrackResult<bool> {
    platform::verify_owner(password)
}

#[cfg(target_os = "linux")]
mod platform {
    use crate::error::{TimetrackError, TimetrackResult};
    use std::ffi::{c_char, c_int, c_void, CStr, CString};
    use std::sync::OnceLock;

    const PAM_SUCCESS: c_int = 0;
    const PAM_BUF_ERR: c_int = 5;
    const PAM_CONV_ERR: c_int = 19;
    const PAM_PROMPT_ECHO_OFF: c_int = 1;
    const PAM_DISALLOW_NULL_AUTHTOK: c_int = 0x0001;

    #[repr(C)]
    struct Message {
        style: c_int,
        text: *const c_char,
    }

    #[repr(C)]
    struct Response {
        text: *mut c_char,
        retcode: c_int,
    }

    type ConverseFn =
        unsafe extern "C" fn(c_int, *const *const Message, *mut *mut Response, *mut c_void) -> c_int;

    #[repr(C)]
    struct Conversation {
        converse: ConverseFn,
        appdata: *mut c_void,
    }

    type StartFn = unsafe extern "C" fn(*const c_char, *const c_char, *const Conversation, *mut *mut c_void) -> c_int;
    type AuthenticateFn = unsafe extern "C" fn(*mut c_void, c_int) -> c_int;
    type EndFn = unsafe extern "C" fn(*mut c_void, c_int) -> c_int;

    /// The three PAM entry points, resolved at run time.
    ///
    /// `libpam.so.0` is the runtime library every Linux desktop already has; linking the name `pam`
    /// instead would need the `libpam.so` symlink, which only the `-devel` package installs — so
    /// building the app would then need a system package that running it does not.
    struct Pam {
        start: StartFn,
        authenticate: AuthenticateFn,
        end: EndFn,
    }

    // Only function pointers, which carry no state and are safe to share.
    unsafe impl Send for Pam {}
    unsafe impl Sync for Pam {}

    fn pam() -> Option<&'static Pam> {
        static PAM: OnceLock<Option<Pam>> = OnceLock::new();

        PAM.get_or_init(|| unsafe {
            let library = libc::dlopen(c"libpam.so.0".as_ptr(), libc::RTLD_LAZY | libc::RTLD_LOCAL);

            if library.is_null() {
                return None;
            }

            let start = libc::dlsym(library, c"pam_start".as_ptr());
            let authenticate = libc::dlsym(library, c"pam_authenticate".as_ptr());
            let end = libc::dlsym(library, c"pam_end".as_ptr());

            if start.is_null() || authenticate.is_null() || end.is_null() {
                return None;
            }

            Some(Pam {
                start: std::mem::transmute::<*mut c_void, StartFn>(start),
                authenticate: std::mem::transmute::<*mut c_void, AuthenticateFn>(authenticate),
                end: std::mem::transmute::<*mut c_void, EndFn>(end),
            })
        })
        .as_ref()
    }

    /// Answers every prompt that wants a hidden secret with the password, and every other prompt with
    /// nothing.
    ///
    /// PAM frees both the array and each string with `free`, so they have to come from `calloc` and
    /// `strdup` rather than from Rust's allocator.
    unsafe extern "C" fn converse(
        count: c_int,
        messages: *const *const Message,
        responses: *mut *mut Response,
        appdata: *mut c_void,
    ) -> c_int {
        if count <= 0 || messages.is_null() || responses.is_null() || appdata.is_null() {
            return PAM_CONV_ERR;
        }

        let password = &*(appdata as *const CString);
        let array = libc::calloc(count as usize, size_of::<Response>()) as *mut Response;

        if array.is_null() {
            return PAM_BUF_ERR;
        }

        for index in 0..count as usize {
            let message = *messages.add(index);
            let entry = array.add(index);

            (*entry).retcode = 0;
            (*entry).text = if !message.is_null() && (*message).style == PAM_PROMPT_ECHO_OFF {
                libc::strdup(password.as_ptr())
            } else {
                std::ptr::null_mut()
            };
        }

        *responses = array;

        PAM_SUCCESS
    }

    /// The account name PAM is asked about, read from the process's own uid rather than `$USER`.
    fn account_name() -> Option<CString> {
        unsafe {
            let entry = libc::getpwuid(libc::getuid());

            if entry.is_null() || (*entry).pw_name.is_null() {
                return None;
            }

            Some(CStr::from_ptr((*entry).pw_name).to_owned())
        }
    }

    /// The first PAM service this machine actually defines.
    ///
    /// A packaged build installs `timetrack`; failing that, `system-auth` is the aggregate on Fedora and
    /// its relatives, and `login` is what Debian and its relatives always have. Naming a service that
    /// does not exist would fall through to `other`, which denies everything and would read as a wrong
    /// password.
    fn service_name() -> Option<CString> {
        ["timetrack", "system-auth", "login"]
            .into_iter()
            .find(|name| std::path::Path::new("/etc/pam.d").join(name).exists())
            .and_then(|name| CString::new(name).ok())
    }

    pub fn can_verify() -> bool {
        pam().is_some() && service_name().is_some() && account_name().is_some()
    }

    pub fn verify_owner(password: Option<&str>) -> TimetrackResult<bool> {
        let Some(pam) = pam() else {
            return Err(TimetrackError::Rejected(
                "this machine has no libpam.so.0, so the account password cannot be checked".into(),
            ));
        };
        let Some(service) = service_name() else {
            return Err(TimetrackError::Rejected(
                "this machine defines no PAM service the account password could be checked against".into(),
            ));
        };
        let Some(account) = account_name() else {
            return Err(TimetrackError::Rejected(
                "the account this process runs as could not be read".into(),
            ));
        };
        let Some(password) = password else {
            return Err(TimetrackError::Rejected("no password was given".into()));
        };
        // A NUL byte cannot reach PAM as part of a password, and is not a failure worth naming: it
        // simply is not the account's password.
        let Ok(password) = CString::new(password) else {
            return Ok(false);
        };

        let conversation = Conversation {
            converse,
            appdata: &password as *const CString as *mut c_void,
        };
        let mut handle: *mut c_void = std::ptr::null_mut();

        unsafe {
            let started = (pam.start)(service.as_ptr(), account.as_ptr(), &conversation, &mut handle);

            if started != PAM_SUCCESS {
                (pam.end)(handle, started);

                return Err(TimetrackError::Rejected(format!(
                    "PAM refused to start a check against {}: status {started}",
                    service.to_string_lossy()
                )));
            }

            let status = (pam.authenticate)(handle, PAM_DISALLOW_NULL_AUTHTOK);

            (pam.end)(handle, status);

            Ok(status == PAM_SUCCESS)
        }
    }
}

/// LocalAuthentication puts up the system's own sheet — Touch ID, the watch, or the account password —
/// so nothing here ever handles a secret.
///
/// It needs an application with an identity: an unbundled binary, which is what `tauri dev` builds, is
/// refused before any sheet appears.
#[cfg(target_os = "macos")]
mod platform {
    use crate::error::{TimetrackError, TimetrackResult};

    pub fn can_verify() -> bool {
        false
    }

    pub fn verify_owner(_password: Option<&str>) -> TimetrackResult<bool> {
        Err(TimetrackError::Rejected(
            "checking the account password on macOS is not implemented yet".into(),
        ))
    }
}

#[cfg(not(any(target_os = "linux", target_os = "macos")))]
mod platform {
    use crate::error::{TimetrackError, TimetrackResult};

    pub fn can_verify() -> bool {
        false
    }

    pub fn verify_owner(_password: Option<&str>) -> TimetrackResult<bool> {
        Err(TimetrackError::Rejected(
            "this platform cannot check the account password yet".into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn asks_for_a_password_everywhere_the_system_puts_up_no_sheet_of_its_own() {
        assert_eq!(collects_its_own_secret(), cfg!(target_os = "macos"));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn refuses_an_unlock_that_carries_no_password() {
        assert!(verify_owner(None).is_err());
    }

    /// A password with a NUL in it is wrong rather than broken, and must not read as a platform failure.
    #[cfg(target_os = "linux")]
    #[test]
    fn answers_no_for_a_password_that_cannot_reach_pam() {
        assert_eq!(verify_owner(Some("before\0after")).unwrap(), false);
    }
}

