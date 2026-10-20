# CLAUDE.md

## Branches and releases

- `develop` is where all development happens. Feature branches start from `develop` and merge back into it.
- `main` is production. Vercel's Production Branch is `main`, and production deploys only from `main`.
- To release, open a pull request from `develop` into `main` when the work is ready for production.
- Never push or commit directly to `main`, and never point production at any other branch.
