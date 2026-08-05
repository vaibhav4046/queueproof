# QueueProof claims that are not release evidence

Do not put these claims in the README, social posts, form answers, or demo. The exact measured
boundary is runtime `aed027879150e3e324b54c5ec2194d4d715c501e`; the current main evidence
build must be verified independently through `/api/health/live`.

1. **“22/22 PDF cases” or “56/56 PDF facts.”** The core result is 21/22 and 55/56. It used
   31 calls / 31 units, resolved 69 citations, and supported 84/84 claims.
2. **“The PDF cross-source test passed.”** It remains REVIEW. Both facts were found and the
   document plus GitHub were cited, but one additional non-document provider was missing.
3. **“Fast and Thinking performed equally.”** Quick/Fast passed 4/6 with 19/19 facts;
   Investigate/Thinking passed 2/6 with 13/19 facts and one timeout.
4. **“Perfect live pass rate.”** Best/Auto and Quick/Fast each passed 4/6 strict cases. Fact
   coverage does not convert provider-requirement failures into passes.
5. **A latency SLA.** Report only the measured sample: Auto 2,155/2,392 ms p50/p95, Fast
   1,833/2,446 ms, Thinking 26,329/40,003 ms, and PDF core 1,823/2,382 ms.
6. **General retrieval accuracy from 39/39 router cases.** That result measures deterministic
   routing on one labelled fixture set, not live answer accuracy.
7. **HydraDB dollar cost.** QueueProof records relative units because no verified billing
   conversion is available.
8. **Guaranteed multi-provider retrieval.** A fact can be correct and cited while the frozen
   provider requirement still fails.
9. **A public GitHub submission.** The repository remains private until its URL opens in a
   signed-out browser with the submitted commit visible.
10. **A complete submission.** The video URL, repository publication, and current main
    evidence-build receipt are pending.
11. **“Production-ready,” “winner,” or “perfect.”** Those words overstate the measured
    evidence and are not judge-verifiable claims.
