# DevOps tasks

You are containerizing the app in this repository, adding its CI/CD, and then running the published images on Amazon EKS. The Node.js code is done. Do not redesign it.

Tasks 1-5 are the container track. Tasks 6-10 are the AWS track. Do them in order.

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
   - `task-06-remote-state`
   - `task-07-network`
   - `task-08-eks`
   - `task-09-infra-plan`
   - `task-10-eks-app`
5. Pull request titles:
   - `Task 1: Containerize the API`
   - `Task 2: Containerize the web app`
   - `Task 3: Compose the stack`
   - `Task 4: Continuous integration`
   - `Task 5: Publish images`
   - `Task 6: Remote state`
   - `Task 7: Network`
   - `Task 8: EKS cluster`
   - `Task 9: Plan infrastructure in CI`
   - `Task 10: Run the app on EKS`
6. Open the next pull request only after the previous one is merged. Each pull request must contain only that task.
7. Fill in the pull request template, including the security checklist.
8. If GitHub will not let you open a pull request against the original repository, open it against your fork's default branch and send the reviewer the link. The one-task-per-pull-request rule still applies.

Push only to your fork. Do not force-push `main`.

## Rules for every task

These are acceptance criteria, not suggestions.

### Application code

- Do not change the click behavior, the JSON shape, or the health payload.
- You may add operational files (Docker, Compose, workflows, `.dockerignore`, Dependabot, OpenTofu, Terragrunt) and the README sections a task asks for.
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
- Pin OpenTofu, Terragrunt, providers, and modules to an exact version. A range (`~> 1.13`, `>= 6.0`) is not accepted. Commit `.terraform.lock.hcl`. Do not commit `.terraform/` or `.terragrunt-cache/`.

  Re-check versions when you do the work. As of this assignment the intended lines are OpenTofu 1.13 (patch 1.13.1), Terragrunt 1.1.6, `terraform-aws-modules/vpc/aws` 6.7.3, `terraform-aws-modules/eks/aws` 21.29.0, and Amazon EKS Kubernetes 1.36. If a newer patch exists on that line, use the patch and say so in the pull request. Do not use a release candidate. Do not use an EKS version that is in extended support only. Kubernetes 1.37 is on EKS standard support as of 1 October 2026; use it only if you say why you did not stay on 1.36.

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

### AWS track

These rules apply to Tasks 6-10.

- Use your own AWS account. The repository does not provide one.
- OpenTofu is the binary Terragrunt runs. Terragrunt 1.1 defaults to `tofu` on `PATH`. The pull request shows `tofu version` and `terragrunt --version`.
- One environment, `dev`, in one region. The region in `infra/live/dev/env.hcl` is `eu-central-1` unless that region is unavailable in the account. If you change it, say so in the pull request.
- The account id comes from the AWS caller identity. Do not commit it.
- No AWS access keys, session tokens, kubeconfigs, or state files in git. Gitignore `.terraform/`, `.terragrunt-cache/`, `*.tfstate`, `*.tfstate.*`, and real `*.tfvars`. An example tfvars file of placeholders may be committed.
- No ingress from `0.0.0.0/0` on a security group you manage, the EKS API, or a load balancer. Egress from the private subnets through the NAT gateway is expected, because this track does not add VPC endpoints. No SSH key on nodes. No `AdministratorAccess`, `PowerUserAccess`, or `Action: "*"` on a role this track creates.
- Apply and destroy stay on your machine. No GitHub Actions job runs `apply` or `destroy`.
- Look up current prices and put a monthly estimate in the Task 8 pull request. An EKS control plane and a NAT gateway are the parts that cost money while the cluster is idle. Destroy what you applied when the review of Task 10 is finished, or say in that pull request when you will destroy it.

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

## Task 6 — Remote state

Add the Terragrunt layout and a state bucket. Do not create a VPC or a cluster in this pull request.

```text
infra/provider.hcl              AWS provider and version pins
infra/root.hcl                  remote state for every unit except state
infra/live/dev/env.hcl          region and name prefix
infra/live/dev/state/           the bucket unit
```

`infra/root.hcl` is included by later units with `find_in_parent_folders("root.hcl")`. It generates an S3 backend. The state key is the unit path relative to `root.hcl`, so each unit gets its own object.

The backend:

- Encrypts the state.
- Enables native S3 locking with `use_lockfile = true`.
- Does not set `dynamodb_table`.

The `state` unit creates that bucket. It includes the provider file and uses a local backend. It does not include `root.hcl`, because that backend points at the bucket this unit creates.

The bucket:

- Name includes the account id, so it is globally unique. A documented prefix is fine.
- Versioning is on.
- Server-side encryption is on.
- All four S3 public access block settings are on.
- The bucket policy denies non-TLS access.

Update `.gitignore` for the patterns in the AWS track rules. Commit the provider lock file for this unit.

The pull request documents how to apply this unit, and how to empty a versioned bucket before destroying it. Destroying the bucket while objects or versions remain will fail.

Definition of done:

1. `tofu version` prints an OpenTofu 1.13 patch, and `terragrunt --version` prints a Terragrunt 1.1 release.
2. `terragrunt plan` in `infra/live/dev/state` shows the bucket and the public access block. Paste the plan with account-specific ids removed.
3. After apply, the bucket is encrypted, versioned, and not public. Show the settings with the AWS CLI. Do not paste credentials.

## Task 7 — Network

Add `infra/live/dev/network/`. This unit includes `root.hcl` and takes a dependency-free module source pinned to an exact version of `terraform-aws-modules/vpc/aws`.

The network:

- CIDR `10.42.0.0/16`.
- Two availability zones in the selected region.
- One public and one private subnet in each zone.
- One NAT gateway for the private subnets.
- DNS hostnames and DNS support enabled.
- The default security group is managed and has no ingress and no egress rules.
- Public subnets are tagged `kubernetes.io/role/elb = 1`.
- Private subnets are tagged `kubernetes.io/role/internal-elb = 1`.
- No VPC endpoints and no flow logs in this task.

Outputs used by later units: VPC id, private subnet ids, public subnet ids.

Commit the lock file. `terragrunt plan` for this unit may read the remote state from Task 6. Apply is allowed on your machine. The pull request includes the plan with ids removed.

Definition of done:

1. The plan creates the VPC, four subnets, one NAT gateway, and the locked-down default security group.
2. `terragrunt output` after apply shows the VPC id and the subnet ids. Paste it with the account id removed.
3. A describe of the default security group shows no rules.

## Task 8 — EKS cluster

Add `infra/live/dev/eks/`. It includes `root.hcl`, depends on the network unit, and pins an exact version of `terraform-aws-modules/eks/aws`.

The cluster:

- Name `devops-task-dev`. Kubernetes 1.36, or 1.37 if the pull request says why.
- Secrets encrypted with a customer-managed KMS key. Key rotation is enabled. Do not use the AWS-managed `alias/aws/eks` key.
- Public and private API endpoint. Public access CIDRs come from a variable, default unset. A value of `0.0.0.0/0` is rejected. Pass your own `/32` through a gitignored tfvars file or `TF_VAR_`. Commit an example tfvars that uses the documentation address `203.0.113.10/32` and nothing else.
- Access for the deploying IAM principal uses EKS access entries. Do not write the `aws-auth` ConfigMap.
- Control plane logs: `api`, `audit`, and `authenticator`.
- One managed node group in the private subnets: Amazon Linux 2023 ARM64, instance type `t4g.small`, minimum 2, desired 2, maximum 2. No SSH key and no remote access block.
- Addons, each pinned to an exact version you looked up for this Kubernetes minor: `vpc-cni`, `coredns`, `kube-proxy`, `eks-pod-identity-agent`. `most_recent = true` is not accepted.
- The node role is the module default for a managed node group. Do not attach an admin policy.

`kubectl` authentication uses `aws eks get-token`. Do not commit a kubeconfig.

Definition of done:

1. `terragrunt plan` in the eks unit, with ids removed.
2. `kubectl get nodes` shows both nodes `Ready`.
3. The public endpoint CIDR list contains one `/32`. Redact the address in the pull request.
4. The monthly estimate for an idle cluster in this region: EKS control plane plus one NAT gateway. Cite the price list you used.
5. The destroy order: eks, then network, then empty the state bucket and destroy it. Leave the cluster up only if you are continuing to Task 10, and say so.

## Task 9 — Plan infrastructure in CI

Add `.github/workflows/infra-plan.yml` and a unit `infra/live/dev/ci/` for the plan role. The workflow plans. It does not apply or destroy.

The role:

- An IAM OIDC provider for `token.actions.githubusercontent.com`, if the account does not already have one. If it already exists, use the existing provider and say so.
- Trust is limited to this repository's pull requests: `repo:<owner>/<name>:pull_request`. No branch wildcard that covers every repository. That subject does not distinguish a fork from a branch in this repository. The workflow skip below is what keeps a fork from assuming the role.
- The role can read the state bucket and take the S3 lock.
- The role can call the read APIs a plan refreshes.
- The role cannot create, delete, or modify the VPC, the cluster, IAM roles, or KMS keys. `AdministratorAccess`, `PowerUserAccess`, and `Action: "*"` are not accepted.
- Apply the `ci` unit locally. The workflow reads the role ARN from the repository variable `AWS_PLAN_ROLE_ARN` and the region from `AWS_REGION`. Do not hardcode the account id in the workflow.

The workflow:

- Runs on `pull_request`.
- `permissions` start at `contents: read`. Add `id-token: write` only on the job that calls AWS.
- Pins `ubuntu-24.04`, a 15-minute timeout, and a concurrency group that cancels older runs on the same ref.
- Installs the same OpenTofu and Terragrunt versions you pinned. Actions are pinned to a full commit SHA.
- Assumes the role with GitHub OIDC. No stored access key.
- When `github.event.pull_request.head.repo.full_name` is not this repository, the job exits successfully before any AWS call and prints that fork pull requests are not planned here.
- When `AWS_PLAN_ROLE_ARN` is empty, the job fails before any AWS call.
- Runs `terragrunt run --all plan` for `infra/live/dev`, excluding the `state` unit if its local backend cannot run on the runner. The command that actually runs is in the pull request.
- Does not use `pull_request_target`.

A fork pull request will not get this role. Paste a redacted local plan in the pull request body.

Definition of done:

1. The workflow file and the role policy are in the pull request.
2. A redacted local `terragrunt run --all plan` completes without changes you did not intend, or the changes are explained.
3. The trust policy and the role policy are quoted in the pull request. A reader can see that a fork pull request cannot assume the role and that the role cannot apply.

## Task 10 — Run the app on EKS

Add `infra/live/dev/app/`. It includes `root.hcl`, depends on the eks unit, and applies the workload with the Kubernetes provider or Helm. Pin that provider to an exact version and commit its lock file.

The provider authenticates with `aws eks get-token` and the cluster endpoint from the eks unit outputs. Do not commit a kubeconfig or a cluster CA as a checked-in secret. The CA data that OpenTofu stores in state is acceptable. The state bucket from Task 6 is what holds it.

Workloads run in the namespace `devops-task`.

- `web` and `api` use the images published in Task 5: `ghcr.io/<owner>/<repo>/web` and `ghcr.io/<owner>/<repo>/api`, tag `sha-<full git sha>`. `latest` and `main` are not accepted. Record the sha in the pull request.
- Postgres 18 and Valkey 9.1 use the same official images and digest rule as Task 3.
- If the GHCR packages are private, the pull credential is supplied at apply time and is not committed. If they are public, say so and do not create an image pull secret.
- Postgres data uses a PersistentVolumeClaim. Valkey may be ephemeral.
- `POSTGRES_PASSWORD` and `VALKEY_PASSWORD` come from the environment at apply time and are stored in a Secret. Compose's fail-closed rule still applies. A Secret manifest with a real password is not accepted.
- The API receives `DATABASE_URL` and `VALKEY_URL` the same way Compose builds them, with the in-cluster service names.
- Probes match Task 3: API `GET /health`, web `GET /`, Postgres `pg_isready`, Valkey `valkey-cli` ping. The Valkey password is not a process argument. `REDISCLI_AUTH` is fine.
- Memory limits match Compose: API 256Mi, web 128Mi, Valkey 128Mi, Postgres 512Mi.
- Containers run as non-root. Prefer a read-only root filesystem. Where the official Postgres image cannot, keep it writable and explain why.
- Services: `web` is a `LoadBalancer`. Restrict it to your `/32` with `loadBalancerSourceRanges`, or with the load balancer security group if the type you use ignores that field. `api`, `postgres`, and `valkey` are `ClusterIP`. No `NodePort`.

Add an "EKS" section to the README: the plan command, the apply command, how the web URL is found, the click check, and the destroy order. Do not write a password, an account id, or your IP address there.

Definition of done:

1. `kubectl get svc -n devops-task` shows one LoadBalancer and three ClusterIP services.
2. Opening the load balancer from your IP and pressing **Record click** shows a number, then a larger number. The response `source` is `valkey`.
3. Deleting the API pod and clicking again continues the count.
4. Deleting the Postgres pod and waiting until it is Ready again keeps the count. The volume claim is the same one.
5. The destroy commands, and whether the account is now empty of this stack.

## Stretch goals

Not required, and not an extra pull request. These belong to the container track. Fold any of them into the task they belong to, and mark them as stretch in the pull request description.

- Keyless image signing with cosign, using GitHub OIDC rather than a stored private key.
- `hadolint` and `actionlint` in CI, both pinned.
- An init SQL script that creates a non-superuser role for the API, with the API connecting as that role.

## Out of scope

Authentication, and changes to the counter itself.

Also out of scope for Tasks 6-10: EKS Auto Mode, Fargate, Karpenter, RDS, Aurora, ElastiCache, a second environment, a second region, a second account, `terragrunt.stack.hcl`, a DynamoDB lock table, and a GitHub Actions apply or destroy job.

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
- An OpenTofu provider or module uses a version range, or the lock file is missing.
- The state bucket is unencrypted, unversioned, public, or locked with DynamoDB.
- A state file, kubeconfig, AWS key, or password is committed.
- The EKS API or the web load balancer allows `0.0.0.0/0`.
- A node group has an SSH key, or a role created for this track has `AdministratorAccess`, `PowerUserAccess`, or `Action: "*"`.
- A workflow runs `terragrunt apply`, `tofu apply`, or `destroy`.
- A fork pull request can assume the AWS plan role.

Task 3 is verified by running the stack, not by reading the YAML alone. Task 5 is verified by inspecting the workflow and, after merge, the packages in GHCR. Tasks 6-8 and 10 are verified from the redacted plan and the command output in the pull request. Task 9 is verified by reading the workflow and the role policy.
