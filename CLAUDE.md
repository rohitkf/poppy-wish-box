# CLAUDE.md

The rules for this repository, including the branch and release workflow, live in AGENTS.md:

@AGENTS.md

## Releasing (the owner's standing instruction)

Release every finished change without asking first. Once CI on `develop` is green, open the
pull request from `develop` into `main`, merge it when its checks pass, bring `develop` level
with `main` again, and confirm the Vercel production deployment serves the new commit (`/api/health`
reports the build). Database changes need no separate step: production builds apply `db/schema.sql`
themselves. Keep every schema change add-only and idempotent, as AGENTS.md says, so the release
can go out on its own. Still never push to `main` directly.

## Design (the owner's standing instruction)

No system UI anywhere in the app: every control is drawn with the app's own design system. Never use
the browser's or phone's built-in pickers or widgets (`<select>`, `type="date"`, `"time"`, `"color"`,
`"checkbox"`, number spinners, `alert`/`confirm`/`prompt`). Use the shared controls in
`components/ui/fields.tsx` (Select, DatePicker, TimePicker, ColorPicker, Checkbox, Stepper,
`cleanNumber` for numeric text inputs), `components/ui/menu.tsx` and `components/ui/sheet.tsx`,
and add to them when something new is needed.
