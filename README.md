# Proof Beauty

Virtual makeup try-on usually answers "do I like how this looks?" Proof Beauty answers **"does this look actually do what I need it to?"**

```
selfie → quality gate → BASELINE (skin concerns + tone)
       → planner picks K looks → render each (makeup-vto)
       → VERIFY each render (skin-analysis again) → score → pick best
       → refine once if the top concern is weak → explain + shop
       → (stage 2) real application → real selfie → predicted vs measured
```

Stack: Next.js 16 (App Router) · React 19 · Tailwind 4 · framer-motion · sharp · MediaPipe (client-side quality gate).

## Run it

```bash
npm install          # also copies MediaPipe's WASM into public/
npm run dev          # http://localhost:3000
```

With no API key it runs in **demo mode**: analysis and renders are simulated, spend zero credits, and every screen is labelled as demo data. That is for developing the UI and the loop. It is not a measurement.

## Go live with YouCam

1. Copy `.env.example` to `.env.local` and set `YOUCAM_API_KEY`.
2. **Run the day-one probe** (spends ~51 credits: 3 skin analyses at ~10, 1 tone at 20, 1 render at 1; the answers it gives are already recorded in this README, so skip it unless you have a new account): `npm run probe -- path/to/selfie.jpg --yes`
   It checks that skin-analysis returns sane scores, estimates the **test-retest noise** (`NOISE_BAND`), confirms which direction `ui_score` points (`UI_SCORE_HIGHER_IS_BETTER`), and that skin-analysis accepts a makeup-vto render. Raw responses land in `.data/probe/`.
3. The makeup payloads in `src/lib/patterns.ts` + `buildVtoEffects` in `src/server/youcam.ts` follow YouCam's published per-category schema and have been verified end to end on a real photo: `concealer` and `foundation` take no pattern but need extra intensity fields, there is no powder category (shine control is a matte foundation), and only `blush` uses a pattern name (`2colors6`).
   Skin analysis rejects faces that are small in the frame (needs the detected face box at roughly 55%+ of the image width). The studio auto-crops uploads to the face, and the server retries with tighter crops if YouCam still says "face too small".
4. Check your console's usage page and set `UNIT_COST_*` to the real per-task cost.

Everything YouCam-specific lives in two files: `src/server/youcam.ts` (payloads and response parsing) and `src/lib/patterns.ts` (role to pattern names). If a response shape differs from what the adapter expects, those are the only places to change.

### Credit budget (read this before relying on the counter)

**Measured costs** (from a real YouCam usage export matched against the tasks we ran: tone and render totals matched exactly, skin averaged 9.6): skin-analysis **~10 credits per task**, skin-tone-analysis **20**, makeup-vto **1 per render**. A first-time run on a new photo is therefore:

| | credits |
|---|---|
| baseline skin analysis (10 concerns) | 10 |
| baseline tone analysis (**opt-in**, `USE_TONE_API=1`) | 20 |
| 3 looks + 1 integrity control: render + verify each | 4 × 11 = 44 |
| **total** | **54** (74 with the tone API) |
| optional refinement round (2 looks) | +22 |

**Validated:** after a 76-credit run the app's counter read 870 and the YouCam console's unit balance read 871, so these costs are correct to within a credit.

So the 1000 free credits were good for ~18 runs, not the 80 the app first promised (it wrongly assumed 1 credit per task). A refinement round is skipped when it can't help (see below), which on a real photo would have saved 22 of 76 credits. The tone API is off by default: it's 27% of a run, often fails on tilted faces, and a free local fallback exists. Re-runs of the same photo reuse the cached baseline (−10/−30). `CREDIT_BUDGET` is the total credits the app may use; **after a top-up, raise it by the amount you added** (the ledger holds the real usage so far). When YouCam itself reports `CreditInsufficiency`, the app records it, shows a red "YouCam credits used up" badge and banner, and the run fails with that message. A rejected request costs nothing, so retrying is safe. Use `FORCE_DEMO=1` to demo the UI for free even with a key set. Cost controls built in: client-side quality gate, baseline cached by image hash, one upload per feature shared across candidates, verification limited to the concerns being scored, local LAB sampling for tone drift instead of a tone API call per render, and a hard cap of two rounds.

## Integrity check: "can the score be fooled?"

Every run also renders and measures a **control look**: a whole-face foundation a few shades too light, the shortcut a score-only try-on takes. It is never eligible to win. The results page compares it with our pick on the top concern and reports one of:

- **caught**: the control beat our pick by more than that concern's noise band, but shifted your shade (ΔE > 4). A score-only try-on would have been fooled.
- **tie**: the control scored the same within noise but shifted your shade. *The score can't tell them apart; the shade check can.* (This is what the first live run on a real photo showed: dark circles 60 → 54 for the control vs 60 → 55 for the real concealer look, at ΔE 6.2 vs 3.2.)
- **held**: it shifted the shade and scored clearly worse.
- **clean**: it didn't shift the shade, so there's nothing to catch. We say that rather than hide it.

The verdict uses the same number shown on the card and never claims a "catch" from a gap inside the noise.

## When we don't spend more

The refinement round (one extra round, +22 credits) runs only if the best look hasn't clearly improved the top concern **and** more product has been shown to matter. If the light, medium and heavy looks all land within the concern's noise band of each other (e.g. redness 37-38 at 34%, 57% and 99% intensity on a real photo), the approach has hit its ceiling, so the round is skipped and the run log says how many credits that saved. The results page also says plainly when the top concern barely moved while other concerns improved. (A known limit: for redness, the shade check and the treatment overlap, since redness correction *is* a colour change; a whole-face skin-matched foundation barely moves YouCam's redness score.)

## How scoring works (all deterministic, in code)

```
J = Σ w_c · reduction_c  −  λ · tone_drift  −  μ · intensity
```

- `reduction_c` is the fraction of baseline severity removed, **shrunk toward zero by the noise band**, so only changes that clear test-retest noise count. Each concern is reported as *clear / likely / within noise*.
- **Scored on `raw_score`, not `ui_score`.** `ui_score` is a compressed display value. For a clearly visible change in dark circles it moved ~3 points; `raw_score` moved ~8–11, with noise under ~1 on near-identical photos (re-encoded, 4px shift, +3% brightness). Set `SCORE_FIELD=ui_score` to go back. Noise bands are per concern (dark circles / eye bags / dark spots 1.5, shine 3.5) unless you set `NOISE_BAND`.
- **λ = 0.15, μ = 0.10.** They share a scale with `reduction`, and real makeup removes only ~5–20% of a concern, so heavier penalties made every look net-negative.
- **A win must look like your skin.** A look is "proven" only if a concern improved beyond noise *and* tone drift is ≤ ΔE 4; a proven look always beats an unproven one. This matters: on a shadowed photo, a foundation shade taken from YouCam's lighting-corrected tone brightened the whole face (+7 L*) and raised the dark-circle score by ~8 raw points without treating the dark circles at all. Render shades are therefore matched to the colour *observed in the photo*; the shopping list still uses the lighting-corrected tone.
- **What YouCam's renderer can do.** On a real photo with visible dark circles, even a concealer 25 L* lighter than the skin at intensity 100 raised the dark-circle score only ~3 raw points (≈5% of severity). Eye bags moved more (≈10–18%). Expect modest, honest numbers. That is the product working, not a bug.
- Only concerns makeup can plausibly address are scored. Wrinkles and eyelid sagging are measured and reported as "makeup won't fix this".
- `w_c` come from the user's drag-to-rank priorities. Tone drift is ΔE in LAB, measured the same way on the original and every render.
- Code writes every explanation sentence, numbers included. By default a local Ollama model (`ollama pull llama2`, configurable via `OLLAMA_MODEL`/`OLLAMA_HOST`) may only **reword** them: a rewrite is kept only if it contains exactly the same numbers as its source sentence, otherwise that sentence stays as written. If Ollama isn't running or the model isn't pulled, the plain sentences are used. So a small model like Llama 2 can change tone but never content. (A looser "check the numbers exist" guard let through "estimated with 13/100 confidence", so I made it strict.)

`src/lib/scoring.ts` is shared by the server and by the interactive scoring demo on the landing page.

## Honest limitations

- Re-analysing a synthetic render measures the render, not real skin. That's why Stage 2 exists.
- Verification may be less reliable on deeper skin tones; the results page says so when the baseline tone is deep. Test across a range of tones before claiming otherwise.
- Tone drift uses a fixed central-face sample region, an approximation.
- Results are cosmetic visibility estimates, never medical or dermatological claims.

## Privacy

Explicit consent before any upload, short-TTL storage (`SESSION_TTL_MINUTES`, default 60), one-tap "Delete my photos", and the API key never reaches the browser. `.data/` holds sessions, cache and the ledger and is git-ignored. In the browser, photos are held in memory only while you use the page (so a server restart can't blank them) and are dropped on "Start over" / "Delete my photos"; a photo that's genuinely gone shows a "Photo not available" panel with a retry instead of a broken icon.

## Layout

```
src/app/                 landing (/), studio (/studio), API routes
src/components/landing/  hero, pinned scroll loop, scoring playground, honesty, stage 2 …
src/components/studio/   capture + quality gate, priorities, live run, results, stage 2
src/lib/                 types, concerns, scoring, planner, patterns, color, quality, products
src/server/              orchestrator, youcam adapter, demo engine, store, ledger, explain
scripts/probe.mjs        day-one feasibility probe
```
