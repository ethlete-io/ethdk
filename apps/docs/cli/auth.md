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
  download  group/hub-backend can be downloaded

Wrote the gitlab.example.com token in /home/you/.composer/auth.json.
The API containers mount that directory, so composer inside them reads it.
```

## Which host

The host comes from the `repoUrl` of the APIs in `ethlete.apis.js`. When they all sit on one host,
the token is enough. Name the host when more than one is in use:

```bash
yarn et auth gitlab.example.com glpat-xxxxxxxxxxxxxxxxxxxx
```

## What is checked

Two requests, both to the host the token belongs to:

| Request                                            | What it proves                                          |
| -------------------------------------------------- | ------------------------------------------------------- |
| `GET /api/v4/personal_access_tokens/self`          | The token exists, is unexpired, and which scopes it has |
| `GET /api/v4/projects/…/repository/archive.tar.gz` | The token can fetch code, not only read the API         |

The second request asks for one byte, so it downloads nothing of substance. A token that can read
the API but not fetch code answers `403` there, which is the difference a private dependency fails
on. Read access is not enough, and the server reports the difference as a bare `403`.

When either check fails, nothing is written and the reason is printed. `--force` writes the token
anyway. When the host cannot be reached at all, the checks are skipped and the token is written.

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
