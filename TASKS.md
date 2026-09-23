# Junior DevOps tasks

You are containerizing the app in this repository and adding its CI/CD. The Node.js code is done. Do not redesign it.

Read [README.md](./README.md) before Task 1. You should be able to explain what `POST /api/clicks` and `GET /health` do.

## How to submit

1. Fork this repository to your own GitHub account.
2. Clone the fork. Do all work there.
3. Do the tasks in order. One task, one pull request, into the original repository's `main` branch.
4. Branch names:
   - `task-01-api-image`
   - `task-02-web-image`
   - `task-03-compose`
   - `task-04-ci`
   - `task-05-cd`
5. Pull request titles:
   - `Task 1: Containerize the API`
   - `Task 2: Containerize the web app`
   - `Task 3: Compose the stack`
   - `Task 4: Continuous integration`
   - `Task 5: Publish images`
6. Open the next pull request only after the previous one is merged. Each pull request must contain only that task.
7. Fill in the pull request template, including the security checklist.
8. If GitHub will not let you open a pull request against the original repository, open it against your fork's default branch and send the reviewer the link. The one-task-per-pull-request rule still applies.

Push only to your fork. Do not force-push `main`.

## Rules for every task

These are acceptance criteria, not suggestions.

### Application code

- Do not change the click behavior, the JSON shape, or the health payload.
- You may add operational files (Docker, Compose, workflows, `.dockerignore`, Dependabot) and the README sections a task asks for.
- You may add an environment variable when a task needs one. Document it in `.env.example`. Do not commit a real `.env`.
- Keep the pnpm lockfile. Install with a frozen lockfile in images and in CI.

### Pin everything you did not write

- Pin third-party GitHub Actions to a full 40-character commit SHA. Put the release tag in a comment on that line:

  ```yaml
  uses: actions/checkout@<40-character SHA> # v4.2.2
  ```

  `@v4`, `@v4.2.2`, and `@main` are not accepted. A tag can move. Look up the commit the tag points at, and pin that commit. Do not copy a SHA from a blog post without checking it.

- Pin third-party container images by **manifest-list digest**, and record the tag you resolved:

  ```dockerfile
  FROM node:24.21.0-bookworm-slim@sha256:<manifest-list digest>
  ```

  A manifest list (image index) still works on Apple Silicon and on GitHub-hosted runners. A single-architecture blob digest often does not. `docker buildx imagetools inspect <image>:<tag>` shows which digest is the index. `latest` is not accepted. A mutable tag with no digest is not accepted.

- Re-check versions when you do the work. As of this assignment the intended lines are Node.js 24 LTS (`.nvmrc` currently says `24.21.0`), PostgreSQL 18, and Valkey 9.1. Do not use a release candidate, `unstable`, or `latest`. If a newer patch exists on that line, use the patch and say so in the pull request. You may update `.nvmrc` when you move to a newer Node.js 24 patch.

- Use official images only: `node`, `postgres`, `valkey/valkey`, and, if you replace the Node static server, `nginx` or `caddy`. No unofficial copies of those images.

### Runtime hardening

- The final application stage runs as a non-root user. The `node` user in the official image is fine. A dedicated UID above 10000 is also fine. `USER root` in the final stage is not.
- Do not copy `.git`, `node_modules`, or any `.env` file into an image. Add a root `.dockerignore`.
- Multi-stage builds for Node images. The final image has production dependencies only. Do not ship `pnpm dev` or `node --watch`.
- Production installs use the pnpm version from the root `packageManager` field (`corepack` is the straightforward way) and `pnpm install --frozen-lockfile`.
- The build context for both apps is the **repository root**, because the lockfile and `pnpm-workspace.yaml` live there:

  ```bash
  docker build -f apps/api/Dockerfile .
  ```

  Building with the context set to `apps/api` will not see the workspace. The image still has to include `apps/api/sql/`, because the process reads that file on startup.
- Secrets are not baked into images, Compose files, or workflow logs. No `ARG` for `DATABASE_URL` or passwords. No `echo` of secrets.
- Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`.

### GitHub Actions

- Set permissions explicitly. Start from `permissions: contents: read` and add only what that workflow needs.
- `actions/checkout` uses `persist-credentials: false` unless a later step genuinely needs the token.
- Do not use `pull_request_target`.
- Pin the runner to `ubuntu-24.04`, not `ubuntu-latest`.
- Set a job timeout (15 minutes is enough).
- Do not print secrets. Do not disable a check to make the workflow green.

If a rule blocks startup, keep the strictest setting that works and explain the exception in the pull request. Do not delete the rule and say nothing.

## Task 1 — Containerize the API

Add `apps/api/Dockerfile` and a root `.dockerignore`.

The image:

- Builds from the repo root with `docker build -f apps/api/Dockerfile .`
- Runs `node src/index.js` as non-root, with `NODE_ENV=production`
- Listens on `PORT` (the app defaults to 3001)
- Includes the SQL file the app migrates on startup
- Has a `HEALTHCHECK` that calls `GET /health` on the container's own port

`GET /health` returns 503 until Postgres and Valkey are reachable, so this check stays unhealthy until Task 3 wires those services. That is the behavior we want. Do not point the healthcheck at `POST /api/clicks`.

The Node image does not include `curl` or `wget`. Use Node's built-in `fetch` in the healthcheck instead of installing either tool.

The image must not contain `DATABASE_URL`. Passing it at `docker run` time is fine.

In the pull request, include the build command and a `docker history` (or equivalent) note showing the final stage is not running as root. A full click-through waits for Task 3.

## Task 2 — Containerize the web app

Add `apps/web/Dockerfile`.

The container serves `apps/web/public` and proxies `POST /api/clicks` to the API origin in `API_UPSTREAM`. Keeping the Node server in `apps/web/src/server.js` is acceptable. Replacing it with nginx or Caddy is also acceptable, as long as the page and the button behave the same way: same-origin `POST /api/clicks`, same HTML.

Requirements:

- Non-root final process
- Pinned base image digest
- Multi-stage build if the image still uses Node
- Listens on port 3000 unless `PORT` is set
- `API_UPSTREAM` is runtime configuration, not a value baked into the image. In Compose it will be `http://api:3001`
- Static files still ship with the content security policy the Node server sets, or an equivalent policy if you switch servers. Do not loosen it to `unsafe-inline` or `unsafe-eval`.

Document the build command in the pull request.

## Task 3 — Compose the stack

Add `compose.yaml` at the repository root. Do not add a `version:` key. Name the project `devops-task`.

Services: `web`, `api`, `postgres`, `valkey`.

Behavior:

- `docker compose up --build` from a clean checkout brings the stack up.
- Only the web service publishes a port, and only on loopback, for example `127.0.0.1:3000:3000`.
- The API port is not published. The button reaches it through the web proxy.
- Postgres and Valkey are not published on the host. The API reaches them on the Compose network by service name.
- Postgres data survives `docker compose down` and `docker compose up` (a named volume). Valkey may be ephemeral. After a restart that keeps the volume, the counter must not reset.
- `depends_on` uses `condition: service_healthy`. Postgres and Valkey become healthy first, then the API, then the web service.
- Healthchecks:
  - Postgres: `pg_isready` against the `devops_task` database
  - Valkey: `valkey-cli` ping. The password must not appear in the process arguments. `REDISCLI_AUTH` works with `valkey-cli`.
  - API: `GET /health` from inside the container
  - Web: a request for `/` from inside the container
- Restart policy `on-failure` or `unless-stopped`, and a stop grace period of at least 10 seconds. The processes handle `SIGTERM`.
- A user-defined bridge network. Do not use `network_mode: host`, `privileged: true`, or a mount of the Docker socket.
- `security_opt: ["no-new-privileges:true"]` on every service.
- Prefer `read_only: true` plus a tmpfs for `/tmp`. Where a service cannot run read-only (the official Postgres image often cannot), keep it writable and explain why in the pull request.
- `cap_drop: ["ALL"]` on `web`, `api`, and `valkey`, adding back only capabilities you can show are required. The official Postgres image needs to start with enough privileges to fix the data directory and then drop to the `postgres` user. Drop what you can, and document what you had to leave.

Data stores:

- Image lines: PostgreSQL 18 and Valkey 9.1, pinned by manifest-list digest.
- Database name `devops_task`.
- `POSTGRES_PASSWORD` and `VALKEY_PASSWORD` come from the environment. Compose must fail closed when they are missing (`${POSTGRES_PASSWORD:?...}`), not fall back to `postgres` or an empty password.
- Valkey is started with `--requirepass` taken from that environment variable. Do not disable protected mode.
- The API's `DATABASE_URL` and `VALKEY_URL` are built from those variables at runtime. Valkey password URL shape: `redis://:<password>@valkey:6379`. Do not commit the password.
- The official Postgres image treats `POSTGRES_USER` as a superuser. You may use a dedicated username, but do not describe that user as a restricted role unless you actually create one in an init script. An init script that creates a less-privileged login is optional. If you skip it, say so in the pull request.
- `--requirepass` is visible via `docker inspect`. That is a known Compose limitation. The compensating control is: the password is not in git, and the port is not published. Mention this tradeoff in the pull request.

Memory limits, set and justified in the pull request: API 256m, web 128m, Valkey 128m, Postgres 512m. Raise one only if you can show the service cannot start, and keep the new number in the pull request.

Update `.env.example` with any new variable names, using placeholders rather than real passwords. Update the README with a "Run the stack" section: how to export the two passwords, `docker compose up --build`, the URL to open, and `docker compose down`.

Definition of done:

1. `docker compose up --build` exits the pull into a running stack (or you show `docker compose ps` with every service healthy).
2. Opening http://127.0.0.1:3000 and pressing **Record click** shows a number, then a larger number on the next click.
3. The response `source` is `valkey`.
4. `docker compose down && docker compose up -d` keeps the previous count.
5. `docker compose port postgres 5432` and the same for Valkey show that those ports are not published. If `port` is the wrong check for your Compose version, show `docker compose ps` output that proves it instead.

## Task 4 — Continuous integration

Add `.github/workflows/ci.yml` and `.github/dependabot.yml`.

The workflow runs on pull requests and on pushes to `main`.

Use a concurrency group so a newer push to the same ref cancels the in-progress run.

Jobs:

1. **verify** — checkout, install pnpm via corepack using the `packageManager` version, set up Node from `.nvmrc`, `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, and `pnpm audit --audit-level=high`. Cache the pnpm store. Do not start Postgres or Valkey here. The unit tests do not need them.
2. **images** — build the API image and the web image for `linux/amd64` with Buildx. Do not push. This job needs the Dockerfiles from Tasks 1 and 2.

Dependabot:

- `github-actions`, weekly
- `npm` at the repository root, weekly
- `docker`, weekly, once the Dockerfiles exist

Group noise only if you can still see a security update on its own. Do not pin Dependabot to ignore security updates.

## Task 5 — Publish images

Add `.github/workflows/cd.yml`.

It runs on push to `main` and on `workflow_dispatch`. It does not deploy to a server or a cluster. Publishing images is the delivery step.

- Build and push `ghcr.io/<owner>/<repo>/api` and `ghcr.io/<owner>/<repo>/web`.
- Authenticate with `github.token`. Do not create a personal access token or a long-lived robot password.
- Permissions: `contents: read`, `packages: write`, and `id-token: write` plus `attestations: write` if you enable provenance. Nothing else.
- Tags: an immutable `sha-<full git sha>` tag is required. A moving `main` tag is allowed in addition. Do not push `latest`.
- Enable SBOM and provenance on the build-push action (`sbom: true`, `provenance: true`).
- Build `linux/amd64` at minimum. Add `linux/arm64` as well if the build still finishes inside the job timeout.
- Leave the packages private when the repository is private. If the repository is public, say in the pull request whether the images are public and why.

Add a short "Images" section to the README with the image names and the tag scheme. Do not document a password.

## Stretch goals

Not required, and not a sixth pull request. Fold any of these into the task they belong to, and mark them as stretch in the pull request description.

- Keyless image signing with cosign, using GitHub OIDC rather than a stored private key.
- `hadolint` and `actionlint` in CI, both pinned.
- An init SQL script that creates a non-superuser role for the API, with the API connecting as that role.

## Out of scope

Kubernetes, Terraform, a cloud deploy, authentication, and changes to the counter itself.

## For the reviewer

Reject the pull request, even if the button works, when any of these are true:

- An action is referenced by tag instead of a full commit SHA.
- A third-party image is referenced by tag without a digest, or by `latest`.
- A secret, password, or connection string with a password is committed.
- The workflow grants a broad token (`contents: write`, `pull-requests: write`) and the job does not need it.
- `pull_request_target` is used.
- The API or web container runs as root.
- Postgres or Valkey is published on `0.0.0.0`.
- The pull request mixes two tasks.
- Application behavior changed without a reason written in the task.

Task 3 is verified by running the stack, not by reading the YAML alone. Task 5 is verified by inspecting the workflow and, after merge, the packages in GHCR.
