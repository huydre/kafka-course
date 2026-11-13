# Port Module 1–4 lessons to the navy style

Status: paused (user stopped: machine lag) · all 8 ported to SoftScene, tsc clean · TODO: motion + QA for segment-retention, partition-count, producer-journey, acks-idempotence, leader-election; re-run motion for commit-offset; Sonnet re-QA of all 8 (run 1–2 at a time)

The 8 earliest lessons still use the dark `Scene backdrop="plain"` look. Rewrite only their scene renderers with
`SoftScene` / `SOFT` so the whole course matches. Scripts, voice, sections, quizzes and labs stay as they are.

| # | slug | file |
|---|---|---|
| 1 | segment-retention | `src/lessons/segment-retention.tsx` |
| 2 | sparse-index | `src/lessons/sparse-index.tsx` (+ `sparse-index-data.ts`) |
| 3 | key-partition | `src/lessons/key-partition.tsx` |
| 4 | partition-count | `src/lessons/partition-count.tsx` |
| 5 | producer-journey | `src/lessons/producer-journey.tsx` |
| 6 | acks-idempotence | `src/lessons/acks-idempotence.tsx` |
| 7 | replication-isr | `src/lessons/replication-isr.tsx` |
| 8 | leader-election | `src/lessons/leader-election.tsx` |

## Acceptance
- Every scene uses `SoftScene` (summary in `SoftTheme`); no `backdrop="plain"` left.
- Same cue timing (voice untouched); visual rules from the earlier plan hold.
- `npm run qa` contact sheets reviewed; `npm run motion` shows only narrated state-change pops.
- Sonnet QA pass after porting; `npx tsc -p . --noEmit` and `npm run build` pass.
