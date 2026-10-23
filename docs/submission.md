# Proof Beauty: submission text

Live demo: https://proof-beauty.vercel.app · Code: https://github.com/aaryanpawar16/Proof-Beauty · MIT licensed

## How we use the YouCam APIs

Proof Beauty chains three YouCam APIs into a closed loop. **Skin analysis** measures your concerns (dark circles, redness, oiliness, spots and more) to set a baseline. **Makeup VTO** then renders several candidate looks (a light, a balanced and a full-coverage plan, built from concealer, colour-correcting and foundation layers), and **skin analysis runs again on every render**, so each look is scored by how much it actually reduced your measured concerns, not by how it looks. **Skin tone analysis** is optional (it is 20 credits a task) and supplies a lighting-corrected tone for shopping shades; by default we sample tone locally and keep that credit. If the best look under-delivers, one refinement round re-plans and re-checks it. A full run is about 54 YouCam credits (10 per analysis, 1 per render), and we measured these costs against YouCam's own usage export rather than assuming them.

## Consumer and retail value

Try-on tells you whether you like a look; it does not tell you whether the look does the job. Proof Beauty answers "will this actually cover my dark circles or redness?", and ends with a shopping list: each product type, the shade to buy, and a badge that says whether the layer was measured to help. For a retailer this means shade and product guidance tied to a measured result instead of a generic quiz, fewer wrong-shade purchases, and a try-on that can back its claims. We are explicit about limits: results are cosmetic visibility estimates, never medical advice, the badge says the layer was verified at the shade used in the render (the shade to buy is shown separately), and deeper skin tones get a reliability warning.

## Product experience

You take or upload a selfie; an on-device face check (nothing leaves your browser until you consent) guides the shot and auto-crops uploads. You rank what matters most to you, then watch the loop run live: baseline, plan, each render and its re-analysis, scoring. The result is a before/after slider on the winning look, per-concern changes with a confidence label (clear, likely, or within noise), a plain-language explanation generated from the numbers, the shopping list, and a "Stage 2" step where you apply the look for real and we compare the measured result against the prediction. Photos are deleted after an hour or on one tap. When the shared credit pool runs out, the app switches to a clearly labelled simulated engine instead of failing.

## Why it is non-obvious

The obvious use of a skin analyzer is to analyse skin; the obvious use of a try-on is to render it. We use the analyzer to **check the try-on**, which turns a picture into a measurement. That creates a new problem: a score can be gamed. A foundation a few shades too light brightens the whole face, so the dark-circle score rises without the dark circles being treated (on a real photo it gained +8 raw points at a visible shade shift, against +3 to +4 for the best honest concealer). So every run also renders a deliberately brightening **control look** and shows whether the score would have been fooled ("caught the cheat"). Real looks only count as proven when they improve a concern beyond measured test-retest noise **and** keep the skin shade within a small colour difference of your own. We would rather report a modest, honest number than a flattering one.
