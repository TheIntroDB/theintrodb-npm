# Contributing

Thanks for contributing to `theintrodb`. This file is for human contributors;
AI coding agents should read `AGENTS.md` for consumer-facing guidance.

## Development Environment

- Node >= 18
- pnpm (this repo uses a pnpm workspace; do not use `npm install` or `yarn`)

## Setup

```bash
pnpm install
```

## Commands

```bash
pnpm build       # compile TypeScript into lib/
pnpm test        # run the Jest suite with coverage
pnpm test:watch  # run Jest in watch mode
pnpm lint        # ESLint with --fix over src/
pnpm typecheck   # tsc --noEmit
pnpm clean       # remove the lib/ build output
```

Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before pushing. CI runs the
suite on pull requests, and coverage is reported to Codecov.

## What To Change

- Public API surface and runtime validation live in `src/funcs.ts`.
- Types and schemas live in `src/types.ts`.
- Add or update Jest unit tests under `test/` for any behavior change,
  especially payload validation, transport, and response parsing.
- The `docs/` folder is the published documentation site (GitHub Pages). Keep
  it in sync when public behavior or types change.

## Releasing

Releases are automated with `semantic-release` from the `main` branch. Version
bumps are driven by commit messages, so use the Conventional Commits spec:

- `feat(scope): ...` for features (minor release)
- `fix(scope): ...` for bug fixes (patch release)
- `build(deps): ...` for dependency updates (patch release)
- Breaking changes: add `BREAKING CHANGE:` in the commit body (major release)

There is a commitizen setup for guided commits:

```bash
pnpm cz
```

## Pull Requests

Fill out the pull request template and confirm:

- `pnpm lint` passes
- `pnpm test` passes
- New or updated tests cover the change
- Docs are updated when public behavior changes
- Commits follow Conventional Commits
