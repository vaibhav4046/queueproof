# Canonical 60-second script

The canonical timing script is [docs/DEMO_SCRIPT_60S.md](../docs/DEMO_SCRIPT_60S.md).

This redirect is intentional. Do not keep a second script here; duplicated timing and
product claims previously drifted apart. The script is metric-free by design: narrate only the
values visible on the deployed release's **Proof tests** page after comparing its SHA with
`/api/health/live`. For reference, release `b930c81` measured Quick/Fast at 7/8 strict and
25/25 facts, Investigate/Thinking at 7/8 and 25/25 (slower, costlier), and the 346-page PDF
core at 5/22 strict with 56/56 facts. Do not quote a Fast/Thinking delta unless
`/api/lab` marks the mode comparison comparable.
