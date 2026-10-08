# Timetrack privacy policy

Last updated: 2026-10-08

Timetrack is a desktop app that turns what you worked on into Tempo worklog drafts for Jira. This page describes what the app does with data. It runs on your machine; Ethlete operates no server for it and receives none of your data.

## What the app collects

The app watches your own work on your own machine. Depending on the sources you turn on, it records:

- the focused application and window title, and whether you are idle or the screen is locked
- git activity in the repositories you point it at
- the session logs of coding agents (Claude Code and Codex) on your machine
- events of the Google calendars you pick, if you connect Google

## Where it is stored

All of this is stored in an encrypted local database (SQLCipher) in the app's data directory on your machine. The database key and the credentials for the services you connect (Jira, Tempo, GitLab, GitHub, Google) are kept in your operating system's keychain.

## Google data

If you connect Google, the app asks for two read-only scopes:

- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar.events.readonly`

The app reads events only from the calendars you select, and uses them only to show your meetings as evidence for your own time entries. Google data stays on your machine. It is not sold, not used for advertising, not used to train AI models, and not sent to Ethlete or any third party.

Timetrack's use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

To disconnect Google, use the disconnect action in the app's settings. It asks Google to revoke the app's token and removes the stored credentials. You can also revoke access at any time in your [Google account permissions](https://myaccount.google.com/permissions).

## Where data goes

Data leaves your machine only in these cases:

- **Services you connect.** The app talks to your Jira and Tempo, to Google, and to GitLab or GitHub, with your credentials, to read what you ask it to read and to write the worklogs you book.
- **Your other machines.** If you pair the app on another machine of yours, a day's data is synced between them over the local network, using mutual TLS. Nothing goes through a server of ours.
- **Model calls you start.** If you press the button to have a ticket or worklog text drafted, the app runs the `claude` or `codex` command-line tool that is already installed and signed in on your machine. You see the full prompt first, and names from your name list are replaced with pseudonyms in it.
- **Optional transcripts.** The call transcript is off by default. When you turn it on, the app downloads a speech model once and transcribes on your machine.

## Retention

Raw collected events are deleted after 30 days, once they have been condensed into the time blocks the day is built from. Worklogs you book live in Tempo and follow Tempo's rules. You can delete the app's data by removing the app's data directory and its keychain entries.

## Contact

Questions about this policy: [tr.bornholdt@googlemail.com](mailto:tr.bornholdt@googlemail.com)
