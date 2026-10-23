I'm making a ~180-second demo video for a hackathon project called **Proof Beauty**. I can't upload my screen recording here, so you can't edit the file yourself. Please act as my video producer and give me everything I need to cut it myself in CapCut / DaVinci Resolve / ffmpeg:

1. A **timecoded storyboard** (table: time | visual | voiceover | on-screen text | speed).
2. A **voiceover script** (about 2.5 words per second; warm, confident, plain language, no hype).
3. A **speed map** for my screen recording (I'll give you timestamps below): which parts to speed up, by how much, and which to keep at 1x.
4. **ffmpeg commands** (or CapCut / DaVinci steps) for the speed changes, joining clips, text overlays and a fade into the closing card.
5. A **1920x1080 closing card** as one self-contained SVG or HTML file: the Proof Beauty logo plus the tagline.
6. Music / sound suggestions, and a short checklist of anything I still need to give you.

## The product (use only these facts; don't invent others)

Proof Beauty is a virtual makeup try-on that **verifies the result**. Most try-ons answer "do I like how this looks?" We answer "does this look actually work for my concerns?"

The loop: selfie -> on-device quality gate -> baseline skin analysis (10 concerns) -> plan 3 candidate looks -> render each look (YouCam makeup try-on) -> re-analyse every render -> deterministic score (coverage minus tone drift minus intensity) -> pick the best -> plain-language result with shade-matched products. "Stage 2": after real application, a real selfie is analysed to compare predicted vs measured.

**The differentiator, "catch the cheat":** every run also renders a deliberate cheat, a face-brightening foundation that a score-only try-on would take as a shortcut. On one real photo the cheat scored about the same as the real concealer look on dark circles (-9% vs -7%, a gap inside the measurement noise) but shifted the skin shade by 6.5 vs 3.1 (colour difference, dE). The score alone can't tell a treatment from a brightening filter. Our shade check can.

**Honesty is a feature:** effects are modest (example: dark circles severity 61 -> 55, eye bags 51 -> 43), the app shows noise bands, and it says plainly what makeup can't fix (wrinkles, eyelid sagging).

Tech: Next.js, Framer Motion, YouCam API (skin analysis + makeup try-on). A local LLM only rewords sentences; every number is computed in code.

**Do not claim:** medical or dermatological results, statistics I haven't given you, or that this replaces a doctor.

## Structure (about 100 seconds)

**1. The problem (0:00-0:28), with real-life examples from AI video.** Show three quick scenarios, about 8 seconds each:
 - An AI beauty-filter video where skin is smoothed and brightened until it looks flawless but isn't the person.
 - A virtual try-on where the shade looks perfect on screen, then looks wrong in daylight.
 - An AI-generated product ad with a polished "after" shot that nobody measured.
 Use footage I generate myself with AI video tools, or licensed stock. No real people's likeness without permission, no celebrities, no other brands' ads. Voiceover idea: *"Beauty AI is everywhere. Filters smooth your skin. Try-ons paint a perfect face. AI videos show a flawless 'after.' But they only answer 'do you like how it looks?' Not 'does it actually work for you?' And nobody measures it."*

**2. The solution (0:28-0:42).** A simple animated diagram of the loop (measure -> plan -> render -> re-measure -> score). Voiceover idea: *"Proof Beauty closes the loop. We measure your skin, build a look for your concerns, render it, then measure the result again. If it didn't work, we say so."*

**3. My recorded demo (0:42-1:30).** Use my screen recording, sped up where it's just waiting. Rules for the speed map:
 - Waiting / progress screens (the verification loop runs about 1-2 minutes live): 8-12x, with a small "8x" badge and a note like "real time: ~90 s".
 - Anything decisive stays at 1x: the quality-gate check, the result reveal, the before/after slider, the per-concern bars.
 - Use a short speed ramp (not a hard cut) going in and out of fast sections.
 - End this section on the **integrity card** ("catch the cheat") at 1x, held for about 6 seconds with a callout on the two shade numbers.

**4. The proof, in one line (1:30-1:42).** Voiceover idea: *"A score alone can't tell treatment from a brightening filter. The shade check can. That's the difference between a nice demo and proof."*

**5. Close (1:42-1:52).** Fade to dark, the Proof Beauty logo animates in, then the tagline. Hold 3 seconds.

## Brand for the closing card
- Dark background `#050507`. Gradient (pink -> violet -> peach): `#ff9ec4` -> `#c4a8ff` -> `#ffc3a0`. Accent green `#4ff0bd`.
- Logo = a rounded-square icon with that gradient and a dark check mark, plus the wordmark: **Proof** in bold sans-serif (Inter) and ***Beauty*** in italic serif (Instrument Serif) with the gradient.
- Icon SVG: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9ec4"/><stop offset=".55" stop-color="#c4a8ff"/><stop offset="1" stop-color="#ffc3a0"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#g)"/><path d="M17 33l11 11 20-22" fill="none" stroke="#050507" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
- Tagline (use this one): **"Don't just try it on. Prove it works."** Alternatives to show me: "Makeup, measured." and "Beauty you can verify."

## What I'll give you (fill in before sending)
- Recording length: ___ min ___ s, resolution: ___, has voice/audio: yes / no.
- Timestamps (mm:ss) of: photo upload ___ | quality gate ___ | loop starts ___ | loop ends / results appear ___ | before/after slider ___ | integrity card ___ | end ___.
- I will attach 4-6 screenshots of the key moments.

Ask me for anything missing before you write the final plan. Keep the whole video under 3 minutes.
