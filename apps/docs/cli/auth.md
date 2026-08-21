# `et auth`

A private dependency that will not download is the most common way `et api install` fails. `et auth`
writes the GitLab token that fixes it into composer's `auth.json`, and asks the host whether that
token can actually download code before it writes anything.

```bash
yarn et auth glpat-xxxxxxxxxxxxxxxxxxxx
```

```
gitlab.example.com
  token     "laptop", scopes: api, read_repository
  fetch     vendor/hub-bundle can be fetched

Wrote the gitlab.example.com token in /home/you/.composer/auth.json.
The API containers mount that directory, so composer inside them reads it.
```

## Which host

The host comes from the `repoUrl` of the APIs in `ethlete.apis.js`. When they all sit on one host,
the token is enough. Name the host when more than one is in use:

```bash
yarn et auth gitlab.example.com glpat-xxxxxxxxxxxxxxxxxxxx
```

A host may be written as a url, because that is how a host is usually pasted. Only its host name
is used, so `https://gitlab.example.com/` and `gitlab.example.com` name the same host and share one
entry in `auth.json`.

## What is checked

Two requests, both to the host the token belongs to:

| Request                                                | What it proves                                          |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `GET /api/v4/personal_access_tokens/self`              | The token exists, is unexpired, and which scopes it has |
| `GET /<project>.git/info/refs?service=git-upload-pack` | The token can fetch code, not only read the API         |

The second request is the first one `git clone` over https makes, so it needs no `api` scope, which
a project access token does not have. The projects it asks for are the `repositories` of each API
checkout's `composer.json`, never the API repository itself: you fetch that one with your own
credential. A token that can read the API but not fetch code answers `403` there, which is the
difference a private dependency fails on.

When either check fails, nothing is written and the reason is printed. `--force` writes the token
anyway. When the host cannot be reached at all, the checks are skipped and the token is written.

## Replacing a token

When `auth.json` already holds a different token for that host, the command asks before it replaces
it. Answer `n` to keep the token in the file. `--force` replaces it without the question, and no
question is asked in a script, where the answer is a no.

## Where it is written

`$HOME/.composer/auth.json`, with mode `600`. Every other credential already in the file is kept, and
a file that cannot be parsed is reported rather than replaced.

That path is not composer's own default on Linux, which is `$XDG_CONFIG_HOME/composer`. It is the
path the compose file of each API mounts into its container:

```yaml
volumes:
  - ${HOME}/.composer:/root/.composer
```

So the token written here is the one the composer **inside** the container reads, which is the one
`et api install <name>` needs.
