# microsoft/TypeScript #55091 - submission package

Status: **prepared, not submitted.** Submission is a manual step for the repository
owner, for the reasons in "Why you submit this" below.

## Record

| Field | Value |
|---|---|
| Organization | Microsoft |
| Repository | microsoft/TypeScript |
| Issue | [#55091](https://github.com/microsoft/TypeScript/issues/55091) - `Help Wanted`, unassigned, milestone `Dormant` |
| Prior art | [#55107](https://github.com/microsoft/TypeScript/pull/55107) by Andarist, closed 2026-03-24 in the post-6.0 mass closure, not rejected on merit |
| Base commit | `9b323de` era clone of `main` (Go compiler; verify against latest before submitting) |
| Files changed | 1 source, 1 new test, 8 baselines |
| Diff | +43 / -24 in source; baselines mechanical |
| PR body | `PR_BODY.md` |
| Patch | `fix.patch` |

## The bug

`tsc/internal/transformers/tstransforms/utilities.go`, `constantExpression()` emitted
bare `Infinity` / `-Infinity` / `NaN` identifiers for enum members whose initializers
fold to those values. Identifiers resolve in the emitted code's scope, so shadowing
changes the value silently. Reproduced on published TypeScript 7.0.2:

```
$ cat repro.ts
{
  let Infinity = 3;
  enum A { X = 1 / 0 }
  console.log(A.X);
}
$ tsc --target es2020 repro.ts && node repro.js
3          # expected: Infinity
```

No diagnostic is issued. `const enum` is guarded by TS2477/TS2478; plain `enum` is not.

## Verification performed

- `go build ./...` under `tsc/` - clean
- `go test ./internal/testrunner/ -run TestLocal` - passes with updated baselines
- `go test ./...` - 62 packages pass; `internal/astnav` fails on a missing
  `node_modules/typescript`, confirmed identical with the fix stashed
- `gofmt -l` clean, `go vet ./internal/transformers/...` clean
- Built the patched compiler and diffed real emit/runtime before and after

Not run: `npx hereby test` / `lint` / `check:format`, because npm dependencies were not
installed in the build environment. Run these before submitting.

## Why you submit this

microsoft/TypeScript `CONTRIBUTING.md` states that a pull request is acceptable only if
"a specific human operator has chosen this specific issue, intends to shepherd the change
through review themselves, and will be the one responding to feedback in their own
personal workflow." It also requires that AI assistance be disclosed in the PR
description, and closes undisclosed AI-authored PRs without review. `PR_BODY.md` contains
that disclosure - keep it.

So: read the diff until you can defend it, then submit it yourself and answer review
yourself. That is the path the project actually accepts.

## Steps

1. Read `fix.patch` and make sure you can explain why `1 / 0` is correct and why the
   identifier form was not.
2. Fork `microsoft/TypeScript`, clone your fork, branch.
3. `git am < fix.patch` (or `git apply`), rebase onto current `main`, re-run the tests
   above plus the `hereby` wrappers.
4. Push and open the PR using `PR_BODY.md`.
5. Note the PR template requires an associated issue in the `Backlog` milestone; #55091
   is currently `Dormant`. Expect maintainers to re-milestone it or to say the change is
   not wanted right now - that is a real possibility worth accepting up front.

## Honest assessment

Merge probability is moderate, not high. In favour: the bug is real, silent, reproducible
on the shipping compiler, the fix is small, and the approach has precedent. Against: a
maintainer called this scenario unlikely on the earlier PR, the issue sits in `Dormant`,
and the emit-readability tradeoff may draw a request to make it conditional. It is a
legitimate contribution either way.
