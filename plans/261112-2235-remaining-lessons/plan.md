# Remaining lessons (Module 6 → 11)

Status: done (15/15 lessons built, voiced, Sonnet-QA reviewed and fixed) · Owner: controller session · Style reference: `src/lessons/consumer-group.tsx`, `src/lessons/rebalance.tsx`

## Lessons

| # | slug | Source sections | Lab (widget) file |
|---|---|---|---|
| 1 | commit-offset | `docs/kafka/06-offset-delivery-semantics.md` 6.1–6.3 | `src/components/labs/commit-lab.tsx` |
| 2 | delivery-semantics | 06 · 6.4–6.5 | `labs/delivery-lab.tsx` |
| 3 | transactions | 06 · 6.6–6.7 | `labs/txn-lab.tsx` |
| 4 | compaction | `07-retention-compaction.md` 7.1–7.4 | `labs/compaction-lab.tsx` |
| 5 | tiered-storage | 07 · 7.5–7.6 | `labs/tiered-lab.tsx` |
| 6 | schema-registry | `08-ecosystem.md` 8.1–8.3 | `labs/schema-lab.tsx` |
| 7 | kafka-connect | 08 · 8.4–8.5 | `labs/connect-lab.tsx` |
| 8 | kafka-streams | 08 · 8.6–8.8 | `labs/streams-lab.tsx` |
| 9 | monitoring | `09-operations.md` 9.1–9.3 | `labs/monitor-lab.tsx` |
| 10 | sizing-tuning | 09 · 9.4–9.5 | `labs/sizing-lab.tsx` |
| 11 | incidents-ops | 09 · 9.6–9.8 | `labs/incident-lab.tsx` |
| 12 | outbox-inbox | `10-design-patterns.md` 10.1–10.3 | `labs/outbox-lab.tsx` |
| 13 | event-design | 10 · 10.4–10.5 | `labs/event-lab.tsx` |
| 14 | retry-saga | 10 · 10.6–10.8 | `labs/retry-lab.tsx` |
| 15 | capstone | `11-capstone-project.md` | `labs/capstone-lab.tsx` |

Docs live at `/Users/hnam/orca/projects/gpm-reverse/docs/kafka/`. Every lesson already exists as a **draft** (registered in
`course-catalog.ts`, `scripts/generate-voice.ts`, and the widget registry). A lesson goes live automatically once its
`sections` array is non-empty.

## Brief for one lesson (what an authoring agent does)

**Files you own (and only these):** `src/lessons/<slug>-script.ts`, `src/lessons/<slug>.tsx`, `src/components/labs/<lab>.tsx`.
Do not edit any other file (shared kit, catalog, styles, other lessons). If you need a new visual helper, define it inside
your lesson file. Keep the exported names already in the draft files (`<camel>Script`, `<camel>Lesson`, default export
of the lab).

**Read first:** `docs/video-production-guide.md` (§2b navy style, §5 voice sync, §6 workflow, SFX section),
`src/lessons/consumer-group.tsx` and `src/lessons/rebalance.tsx` (structure + style to copy), exports of
`src/player/schematic.tsx` (SoftScene, SoftTheme, SOFT, SOFT_PANEL, HERO, LogTape, PartitionTapes, ServerUnit,
ProducerBox, ConsumerUnit, Packets, Envelope, Wire, Note, Statement, Rise, Sheen, Icon3D, SummaryList),
`src/player/motion-kit.tsx` (cameraAt, sp, vis, move, span, lerp, clamp), `src/player/types.ts`, an existing lab such as
`RebalanceLab` in `src/components/widgets.tsx` (widget CSS classes `wg`, `wg-head`, `wg-controls`, `wg-stats`, `Stat`
pattern — re-implement a tiny `Stat` locally in your lab file).

**Lesson shape (Vietnamese, like rebalance.tsx):** 6–8 narrated scenes (each 3–4 short beats, one sentence each, numbers
spelled for TTS when ambiguous), `intro` (hook video + 1 prediction quiz), `roadmap` (3 stages), sections each with a
video + concise theory (p/list/table/callout/code taken from the doc, keep "(📘 sách, ch.N)" tags) + Quick Quiz, a
`thuc-hanh` section with the lab widget, a `tom-tat-video` section with the SummaryList scene, `finalQuiz` (4 choice + 1
open "vì" question), `recap` with `next` pointing to the next lesson in the table.

**Visual rules (user is strict). QA keeps finding the same 4 problems — avoid them up front:**
- **Text size:** every label, pill, offset number, axis tick, caption ≥ 24px at full size (titles/statements 36–56px).
- **No dead air:** while narration continues, something on screen must change at least every ~2.5s (reveal the next item on the word that names it, pulse, counter, packets). No beat may sit on a static frame.
- **Fill the frame:** content block centred vertically and horizontally, using ~70% of 1920×1080; no empty lower half.
- **Counters:** exported MP4s use camera motion blur (sub-frame sampling), so a number that changes every frame smears. Snap counters to whole steps that change at most ~6 times per second (`Math.floor(t * 6) / 6` before computing the value) and use `fontVariantNumeric: 'tabular-nums'`.
- **Settled when narrated:** an element must have finished entering before its line is spoken; flying pills must never land on or cover a card/label (end flights in a gap, or fade before landing).

- Every scene uses `SoftScene` (summary: `<SoftTheme><SummaryList/></SoftTheme>`); palette `SOFT` as `INK`, panels `SOFT_PANEL`.
- Show the mechanism, not text cards: tapes, units, flowing `Packets`, `Envelope` requests, counters, bars. Use
  `Icon3D` (53 glossy 3D icons, see `Icon3DName`) for objects/verdicts instead of drawing SVG icons.
- Diagrams perfectly straight and aligned; no random rotation; all cells same size; nothing overlapping; nothing cut by
  the frame or by the docked title (use `title.until` when the camera pushes into the top area).
- Camera: one gentle push (scale 1.05–1.2) toward what the current beat talks about, back to wide to compare. Keep
  every narrated subject fully inside the frame.
- Animation on `cue.at(k)` / `cue.end(k)` only; elements enter with `Rise`; no element appears before it is narrated.
- 1–3 declared SFX per scene where something fails (`error`), succeeds (`ding`) or ticks (`tick`), timed with the same formula as the animation.

**Commands (cwd `kafka-course`):**
1. `npm run voice -- <slug>` — records narration (a lock serialises parallel runs; may wait).
2. Print beat frames: `node -e "const m=require('./src/lessons/voice-manifest.json')['<slug>'];for(const k in m){let t=.5;console.log(k,m[k].map(c=>{const a=t;t+=c.duration+.45;return Math.round(a*30)+'-'+Math.round((a+c.duration)*30)}).join(' '))}"`
3. Composition ids: `<slug>--intro`, `<slug>--<section-id>`, a 2nd video in one section `<slug>--<section-id>-2`.
4. `npm run stills -- <id> <frame> <frame>…` → `out/frames/<id>-<frame>.png` (half size). Check at ~90% of every beat,
   after each layout change and mid camera move. Fix and re-render until clean.
5. `npm run qa -- <slug>` renders contact sheets of every video to `out/qa/<slug>/*.png` — read them all before reporting.
6. `npx tsc -p . --noEmit` must pass.

**Report back:** files written, scene list (one line each), stills checked and what you fixed, anything unresolved.
End with `Status: DONE | DONE_WITH_CONCERNS | BLOCKED` + one-line summary.

## QA

Done 2026-11-13: second Sonnet pass on all 17 navy lessons (contact sheets + `npm run motion` frame-to-frame pop detection). Every HIGH/MED finding fixed and re-measured; remaining pops are small narrated state changes (a card turning red on "chết", etc.).


After each lesson, a Sonnet reviewer renders stills at every beat end and mid-move, and reports overlaps, cut-offs,
misalignment, unreadable text, empty frames, narration/visual mismatch. The controller fixes or sends fixes back.
