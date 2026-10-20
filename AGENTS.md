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
- Checks before pushing: `npm run lint`, `npm run typecheck`, `npm run build`.
- The schema lives in `db/schema.sql` and must stay idempotent. Production builds apply it
  (`npm run build` runs `scripts/setup.mjs --on-build`). Locally, run `npm run setup`.
- The app is unlocked with a numeric code in the `APP_PIN` environment variable. Never write the
  code, or any other secret, into the repository, commit messages or pull requests.
