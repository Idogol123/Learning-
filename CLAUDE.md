# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## Repository status

This is a **new, essentially empty repository**. As of this writing it contains:

- `README.md` — a single-line title (`# Learning-`)
- `CLAUDE.md` — this file

There is **no source code, build system, test suite, dependency manifest, or
CI configuration yet**. The name "Learning-" suggests it is intended as a
personal learning / scratch repository.

> **Keep this file honest.** When real code lands, replace the placeholder
> sections below with the actual structure, commands, and conventions. Do not
> document tooling that does not exist.

## Working in this repo

Because there is no established structure, when adding the first real code:

1. **Pick and record the stack.** Whatever language/framework is introduced
   first, note it here along with how to install dependencies, build, run, and
   test it.
2. **Add a dependency manifest** appropriate to the stack (e.g. `package.json`,
   `requirements.txt` / `pyproject.toml`, `go.mod`, `Cargo.toml`).
3. **Add a `.gitignore`** suited to the stack before committing build output or
   dependency folders.
4. **Update `README.md`** with a real project description and setup steps.
5. **Come back and fill in the sections below** (Build & test commands, Project
   structure, Conventions) so this file stays useful.

## Build & test commands

_None yet._ Add the canonical commands here once a toolchain exists, e.g.:

```
# install dependencies
# build
# run
# test (and how to run a single test)
# lint / format
```

## Project structure

_None yet._ Document the directory layout here as it forms (what lives where,
entry points, where tests go).

## Conventions

No project-specific conventions are established yet. Until then, follow these
defaults:

- Match the style of surrounding code when editing existing files.
- Keep commits small and focused, with clear, descriptive messages.
- Don't introduce a framework, language, or heavy dependency without a reason
  that fits the goal of the change.

## Git workflow

- Default branch: `main`.
- Active development branch for this work: `claude/claude-md-docs-msj3jb`.
- Push with `git push -u origin <branch-name>`.
- Do **not** open a pull request unless explicitly asked.
