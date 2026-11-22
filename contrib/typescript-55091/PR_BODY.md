Fixes #55091

### Problem

Enum members whose initializers evaluate to `Infinity`, `-Infinity`, or `NaN` are
emitted as the global identifiers of those names. Identifiers resolve in the scope of
the *emitted* code rather than at the enum declaration, so a local binding that shadows
`Infinity` or `NaN` silently changes the member's value at runtime:

```ts
{
  let Infinity = 3;
  enum A {
    X = 1 / 0
  }
  console.log(A.X); // 3, expected Infinity
}
```

emits

```js
A[A["X"] = Infinity] = "X";
```

This compiles with no diagnostic. `const enum` members are protected here by TS2477 and
TS2478, but plain enums are not, so the value is wrong with nothing to indicate it.

### Change

`constantExpression` now emits `1 / 0`, `-1 / 0`, and `0 / 0` for these three values.
They evaluate to exactly the same numbers and cannot be shadowed, which is the same
reasoning behind emitting `void 0` rather than `undefined`.

The `-Infinity` case prints as `-1 / 0` rather than `-(1 / 0)`; unary minus binds tighter
than division, so no parentheses are needed.

### Testing

I added `tests/cases/conformance/enums/enumComputedNonFiniteShadowed.ts`, covering all
three values both under a shadowing binding and without one.

By hand, I built the compiler from this branch and ran the case above through it. Before
the change the emitted program printed `Pos: 3 Neg: -3 Nan: 7`; after it, it printed
`Pos: Infinity Neg: -Infinity Nan: NaN`.

Five existing emit baselines change, in each case only `Infinity`/`NaN` becoming the
division form: `enumConstantMembers`, `enumNaNValues`, `enumAutoIncrementValue`,
`fakeInfinity2`, and `fakeInfinity3`. No `.types`, `.symbols`, or `.d.ts` baseline
changes, since checking is untouched. `enumShadowedInfinityNaN` is unaffected, as that
test references the identifiers directly rather than computing a constant.

I ran `go test ./...` under `tsc/`: 62 packages pass. `internal/astnav` fails in my
environment because it loads `node_modules/typescript/lib/typescript.js`, which I had not
installed; I confirmed it fails identically with this change stashed. I did not run the
`npx hereby` wrappers for that reason, but `gofmt -l` and `go vet ./internal/transformers/...`
are both clean.

### Key points

The tradeoff is emit readability: `E[E["a"] = 1 / 0] = "a"` reads less clearly than
`= Infinity` for the common, non-shadowed case. I chose the unconditional form because it
is correct without needing to resolve `Infinity`/`NaN` at the emit site. If you would
rather keep the identifier when it is demonstrably not shadowed, I am happy to rework it
that way.

This does not address declaration emit, which has the same underlying problem: the
committed `fakeInfinity3.d.ts` baseline still carries TS1066 and TS2749 errors. That
looked like a separate change, so I left it out rather than widen this one.

### AI assistance

This patch was written with AI assistance (Claude Code). I have read and understand the
change and will be responding to review feedback myself.
