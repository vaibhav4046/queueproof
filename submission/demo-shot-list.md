# QueueProof demo shot list

Use with the canonical [60-second script](../docs/DEMO_SCRIPT_60S.md). Capture only after
`/api/health/live` identifies the deployed release and `/api/lab` binds artifacts to the same
SHA. Reference metrics below were measured at release `24d942e`; always read the current
values from the **Proof tests** page on screen instead of narrating this file.

1. **Ask, 0–8s:** first viewport with “Ask your work. Get the proof.”, the working composer,
   and verified-source readiness.
2. **Live run, 8–24s:** select Quick and run the flagship AuthShield question.
3. **Answer, 24–31s:** show provider coverage, actual mode, calls, elapsed time, and preserved
   disagreement.
4. **Receipt, 31–39s:** open one numbered citation with provider, timestamp, source ID, and
   excerpt.
5. **Today, 39–50s:** open the top Task brief and show score factors, safe action, and approval
   boundary.
6. **Proof tests, 50–60s:** show the current-release Fast row (at `24d942e`: 7/8 strict,
   25/25 facts); keep the REVIEW row visible. Then show the 346-page PDF core (at `24d942e`:
   5/22 strict, 56/56 facts) with its REVIEW rows visible.

Before recording, verify there is no horizontal overflow or console error at the capture size,
the repository opens signed out (it is public), the video destination is ready, and
`/api/health/live` matches the `/api/lab` SHA. Never show credentials, account identifiers,
or private source content. The public video URL remains pending until upload.
