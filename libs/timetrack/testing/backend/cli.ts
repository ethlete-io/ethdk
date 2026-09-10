/**
 * The host's own wording for a missing binary, as it arrives in the webview: a Tauri command rejects
 * with the string its error serialized to, never with an `Error`. `isMissingCliError` reads exactly
 * this prefix, and a fake that rejected with an `Error` instead would hide a check that cannot match.
 */
export const cliNotInstalledMessage = (cli: string) => `not installed: ${cli}`;
