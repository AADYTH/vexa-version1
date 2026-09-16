# VEXA V15 — Cinematic Experience

Run:

npm install
npm run dev

This build uses the supplied VEXA artwork and the existing cinematic MP4s from the V11 production build.

Intro flow:
intro.mp4 -> bookslam.mp4 -> ancient sigil lock -> wrong_pass.mp4 or correct_password.mp4 -> site.

Skip cinematic only skips the current cinematic; it never bypasses the lock.

---

## V16 Cinematic Upgrade — what changed

Same gold/dark theme, same story structure — the goal here was to make the experience feel alive instead of static. No colors or copy were changed.

**New assets wired in (from the green-screen clips + clean plates you provided):**
- `public/video/cape-light-loop.mp4` / `cape-dark-loop.mp4` — the hero character is now a real-time, in-browser chroma-keyed looping video instead of a static PNG, swapping automatically with the theme.
- `public/video/transform-dark-to-light.mp4` / `transform-light-to-dark.mp4` (the second is a reversed copy generated with ffmpeg from your transition clip) — plays as a full cinematic overlay whenever the world flips.
- `public/assets/light-bg.png` / `dark-bg.png` — swapped for the clean plate versions (no baked-in character), since the character is now the animated video layer. Old versions kept nowhere else needed — safe to regenerate from the originals if you ever want them back.

**New systems (`src/main.jsx` / `src/styles.css`):**
- `ChromaVideo` — a canvas-based real-time green-screen remover (with edge feathering + spill suppression) used for all three looping/transform clips.
- `WorldFlip` — the theme toggle no longer just crossfades colors. It now plays the chroma-keyed transformation video with a radial light-burst flash and expanding rings, timed so the background swaps underneath at the flash's peak.
- Chat now triggers `WorldFlip` automatically when it detects distress in what the user types — the environment visibly responds to their emotional state, per the original concept.
- Scroll-reveal animations (Origin / Powers / Mission), magnetic buttons with a shine sweep, 3D cursor-tilt on the power cards, a soft cursor-follow glow, a gold scroll-progress bar in the nav, and a typing indicator + slide-in animation in the chat panel.

**Verified:** production build passes with no errors; smoke-tested with a headless browser through the full intro → lock → hero → theme-flip → chat flow, in both desktop and mobile viewports.

---

## V17 — Brief compliance pass (cross-checked against the TechAscent machine test)

Checked this build against the WHITEMATRIX brief. Three requirements were missing; all three are now implemented:

1. **Structured intake in the chatbot.** The chat used to jump straight into free-form LLM conversation. It now walks every visitor through **name → age → location → email**, one conversational question at a time, then asks *"So... tell me. How can I help you?"* to collect the grievance — matching the brief's example flow exactly. Only after that does it hand off to the open-ended supportive chat.
2. **Automatic email notification.** On submitting their grievance, the app now sends an email (via EmailJS, client-side, no server needed) to the hero's own address with the visitor's name, age, location, email, grievance, and submission time — subject line `Someone Needs Your Help!`, as specified. Requires the four `VITE_EMAILJS_*` / `VITE_HERO_EMAIL` values in `.env` — see `.env.example` for exact setup steps. Without them the app still runs, just skips sending (logged to console) — worth setting up before you submit, since this is one of the brief's four explicit "must haves."
3. **Powers & Abilities section.** There was unused CSS for a power-grid layout that was never actually rendered on the page. Added a real "Powers & Abilities" section (VEXA's four powers) between Threshold and Sanctum, using that existing styling.

---

## V18 — Fixed the laggy theme-flip + added more content

**Why the toggle was freezing:** the hero character and the light/dark transformation clip are both rendered through a real-time, per-pixel green-screen remover (`ChromaVideo`). That's inherently CPU-heavy (`getImageData`/`putImageData` on every frame). The bug was that the *hidden* hero-loop kept running that same expensive process in the background the entire time the transformation video was also playing on top of it — two synchronous per-frame pixel loops fighting for the same main thread at once, which is exactly what reads as "stuck."

Fixes:
1. The hero-loop clip now actually pauses (stops decoding *and* stops the pixel-keying loop) for the duration of the flip, instead of running invisibly underneath it.
2. Internal chroma-key processing resolution dropped from 360px to 240px wide — meaningfully fewer pixels to process per frame, on both clips.
3. The two transformation clips are now preloaded via `<link rel=preload>` as soon as the page loads, so the very first click doesn't also have to cold-fetch a video file before it can start playing.
4. Added `will-change`/GPU-layer hints on the two chroma canvases so the browser doesn't repaint them from scratch every frame.

Try it again after this — it should feel like a single smooth animation now rather than two competing ones. If it's still heavy on a specific device, the biggest further lever is swapping `ChromaVideo`'s manual green-screen removal for actual alpha-channel video (WebM VP9 with alpha, or HEVC-with-alpha) exported directly from the source footage — that removes the per-frame JS pixel loop entirely, at the cost of re-exporting the clips.

**More content added**, per your ask:
- New **"How It Works"** section (05) — a plain 4-step walkthrough of what happens from landing on the site to VEXA being notified, so visitors know what they're signing up for before they type anything.
- New **"Field Reports"** section (07) — three short in-character testimonial-style quotes for extra storytelling texture (clearly framed as composite/fictional, not real user data).
- A bit more copy in the hero intro, the Sanctum, and the Mission section, plus a one-line privacy note under the mission CTA.
- Nav and footer expanded to match (new section links, a two-line footer).

### Still needs your action: hosting
The brief requires a **public, hosted URL** the evaluators can open directly — screenshots or source code alone aren't accepted. This is the one piece that genuinely requires your own account/credentials, since it can't be done from inside this environment. Fastest path:

```
npm install
npm run build
```
Then drag the generated `dist/` folder onto **https://app.netlify.com/drop** (no account needed, live in ~10 seconds), or run `npx vercel --prod` from this folder if you have a Vercel account. Either way, set the same env vars (Groq + EmailJS keys) in that platform's dashboard before/after deploy, since `.env` itself isn't uploaded.

---

## V19 — fixed a dead model id (this is why the AI wasn't replying)

Groq deprecated `llama-3.3-70b-versatile` (the model this project was hardcoded to) for free/developer accounts — it stopped serving requests entirely on **August 16, 2026**. Every chat request was getting a `404 model_not_found` back from Groq, which the code quietly swallows and falls back to canned filler lines, so it looked like "the AI isn't working" rather than showing an obvious error.

Switched `GROQ_MODEL` in `src/main.jsx` to `openai/gpt-oss-120b`, Groq's own recommended replacement. If this ever silently goes quiet again, the fastest way to check *why* is to open the browser console while sending a chat message — `askVexaStream()` logs the real HTTP error there, it's just hidden from the UI itself.

---

## V20 — moved off Groq onto Gemini, and made the light/dark moods symmetrical

**Model switch:** `askVexaStream()` now calls Google's Gemini API (`streamGenerateContent`, SSE) instead of Groq's OpenAI-compatible endpoint. Set `VITE_GEMINI_API_KEY` in `.env` (get one free at https://aistudio.google.com/apikey) — see `.env.example`. It's currently pointed at `GEMINI_MODEL='gemini-2.5-flash'` in `src/main.jsx`; swap that one string for `gemini-2.5-flash-lite` (cheaper/faster) or a newer `gemini-3.x` id if your key has access. Same client-side-key caveat as before applies (see the security note above `askVexaStream`).

**Mood-driven world now runs both directions:**
- Sad/concerning language in the chat → world flips to **dark**, and VEXA's persona there stays grounded and comforting (unchanged from before).
- Happy/good-news language in the chat → world now flips to **light**, and VEXA's light-mode persona was rewritten from "warm and celebratory" to **bold and powerful** — confident, energizing, pushing the person to own the win rather than just feeling nice about it. The offline fallback line (used if the Gemini call fails) got the same split.
- The manual "CHANGE WORLD" / nav toggle button still works exactly as before for switching by hand at any time.

---

## V21 — fixed the hard cut from intro into the hero

**The bug:** the moment the correct-password clip ended, the intro overlay (`Intro`) was unmounted instantly. The hero page was already sitting fully rendered underneath it the whole time (it's not conditioned on `intro`), so it just snapped into view with no transition — and on a slow connection the Cinzel title font could still be mid-swap-in at that exact moment, so the heading briefly showed in the plain fallback font (reading like a document heading) before flipping to Cinzel a beat later.

**Fix (`src/main.jsx` / `src/styles.css`):**
1. `Intro` no longer unmounts itself the instant the password clip ends. It now calls `document.fonts.ready` (capped at 900ms so a slow network can't stall the handoff) to make sure the real title font is actually applied first, then crossfades its own black overlay out (`.intro-layer.leaving`, a 650ms opacity transition) before finally unmounting — so the hero is revealed already in its final font, as one continuous fade rather than a pop.
2. The hero's live decorative systems (chroma-video character, particles, cursor glow, aurora/grain, world-flip layer) now switch on the moment that crossfade *starts* (`onReveal`), not only after the intro is fully gone — so the character and effects are already warming up under the fade instead of switching on abruptly right as the intro disappears.

Net effect: intro and hero now read as a single continuous transition instead of a cinematic cut followed by a static page popping in.
