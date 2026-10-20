# AGENTS.md

Instructions for anyone, human or AI agent, changing this repository.

## Branches and releases

- The repository has exactly two branches: `develop` and `main`. Delete any other branch.
- Commit and push every code change straight to `develop`. Don't create feature branches,
  and don't open pull requests into `develop`.
- `main` is production. Vercel's Production Branch is `main`, and production deploys only from `main`.
- To release, open a pull request from `develop` into `main` once the work is ready for production.
  Pull requests only ever go from `develop` to `main`.
- Never push or commit directly to `main`, and never point production at any other branch.

## Project

- Next.js 16 on Vercel Functions (London, `lhr1`), Neon Postgres (`pg`), private Vercel Blob for photos.
  See README.md for how the pieces fit together.
- The same app runs as a Docker image (`Dockerfile`, `docker-compose.yml`). Keep both working:
  read configuration from environment variables and don't rely on anything Vercel-only
  without a fallback.
- Checks before pushing: `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test`
  against a running server (see README.md). CI runs all of them, also against the Docker image,
  on every push to `develop` and every PR into `main`. Fix a red CI run before anything else.
- The schema lives in `db/schema.sql` and must stay idempotent. Production builds apply it after a
  successful build (`npm run build` runs `scripts/setup.mjs --on-build`); the Docker image applies it
  on start. Locally, run `npm run setup`. A schema change must work with the code of the previous
  release, because the old deployment keeps serving until the new one is live: add first, and drop
  only in a later release.
- The app is unlocked with a numeric code in the `APP_PIN` environment variable. Never write the
  code, or any other secret, into the repository, commit messages or pull requests.
