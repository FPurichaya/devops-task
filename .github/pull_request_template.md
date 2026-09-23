## Task

Which task number is this?

## What changed

-

## How to verify

List the commands you ran and the result that shows the task is done. A green CI run is not a substitute for the Compose click-through once that file exists.

## Security checklist

- [ ] Third-party GitHub Actions are pinned to a full 40-character commit SHA, with the release tag in a trailing comment
- [ ] Third-party container images are pinned by manifest-list digest, with the version tag recorded next to the digest
- [ ] No `latest` image tags and no floating action tags (`@v4`, `@main`)
- [ ] No secrets in git, Dockerfiles, image layers, or workflow logs
- [ ] Workflow `permissions` are set explicitly and are no broader than the job needs
- [ ] Application containers run as a non-root user
- [ ] Postgres and Valkey are not published on a public interface
- [ ] `apps/` behavior is unchanged, except operational configuration this task allows

## Exceptions

If a security rule could not be met, say which one, what you tried, and why the stricter setting does not work. Do not drop the rule silently.
