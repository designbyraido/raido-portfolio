# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is `designbyraido`'s portfolio site: a single-page React app built around a full-viewport WebGL/R3F 3D scanner (a distorted sphere over a procedural, image-reactive terrain), with an HTML overlay UI on top. Aesthetic is "Industrial Brutalism" / NERV tactical-telemetry — see [DESIGN.md](DESIGN.md) for the full design-token spec (colors, corner geometry, typography, animation rules). Read DESIGN.md before making any visual/UI change; the constraints there (no border-radius, chamfered-corner "nested div" hack, hard-edged shadows only, monospace-for-data vs sans-for-prose) are intentional and strict, not oversights.

## Commands

```bash
npm run dev       # start Vite dev server with HMR
npm run build     # production build to dist/
npm run preview   # preview the production build locally
npm run lint      # eslint . --ext js,jsx --max-warnings 0
```

There is no test runner configured in this project. There is also no ESLint config file checked into the repo root — `npm run lint` requires one to exist (e.g. `.eslintrc.cjs` or `eslint.config.js`) or it will fail; check before assuming lint is runnable.

## Architecture

The whole app is 8 files under `src/`. There's no component directory structure — everything is flat.

- **`main.jsx`** — React root, mounts `App`.
- **`App.jsx`** (~1300 lines) — the entire shell: R3F `<Canvas>` setup, orthographic camera, the `BackgroundRadar` procedural terrain (custom GLSL shader material via `useFrame`), the central distorted-sphere geometry, all overlay HTML/UI chrome (nav, sidebars, transitions), and the React Router setup (`Routes`: `/` → Home, `/archive` → Archive). Route transitions use GSAP (`useGSAP`) for enter/exit choreography of the overlay UI, layered over a persisted 3D canvas.
- **`store.js`** — single Zustand store (`useMagiStore`). This is the sync point between the 3D canvas and the DOM overlay: audio-reactive data (`audioData`/`kickData`), sphere/terrain parameters (`sphereScale`, `gravityRadius`, `sphereActivity`, `shapeIndex`, `displacementTexture`), the active color `theme` (`infil`/`infilAlt`/`breach`), and UI navigation state (`expandedProject`, `lightboxMedia`, `activeArchiveIndex`). Any component touching either the 3D scene or the overlay UI likely reads/writes this store — check here first when tracing state.
- **`archivecylinder.jsx`** (`ArchiveCylinder`) — the `/archive` route's primary nav: a 3D rotating cylinder of project cards with custom drag/swipe/scroll-to-rotation physics (velocity + eased `targetRotation`). Writes `activeArchiveIndex` and `expandedProject` to the store.
- **`ProjectExpandedView.jsx`** — full-screen detail overlay for a selected project: `MediaRenderer` (handles image vs. autoplaying `.mp4`) and `LightboxVideoPlayer` (fullscreen video with custom timeline/controls).
- **`DataIngestion.jsx`** — lets a user upload a `.jpg`/`.png` that becomes the terrain's displacement map (`extractPaletteFromImage` reads canvas pixel data to derive HSL/luminance and generate a matching neon `theme`, which is pushed to the store and reshapes both the terrain and UI accent colors).
- **`projectsData.js`** — the `PROJECTS_DATA` array driving all portfolio content (`id`, `title`, `roles`, per-project `theme`, `description` (HTML string), `logo`, `images`). Adding a project is just appending an entry here; the cylinder (`numItems = PROJECTS_DATA.length`) and layout adapt automatically. Media referenced by path must exist under `public/`.

### The 3D scanner / terrain system

- `BackgroundRadar` in `App.jsx` and the central sphere are **kept in sync only through the Zustand store** (`sphereActivity` in particular) — never drive one without considering the other.
- Engagement is state-driven, not just visual: dormant (no mouse movement) → sparse CRT flicker + low-threshold red scan lines only; any mouse/touch movement spikes `sphereActivity` to 1.0, which ripples through both the sphere (distortion/hum) and terrain (energy ripples from origin, crater shake, denser red tracers); on stopping, everything decays smoothly (~3s) rather than snapping off.
- Uploaded images become terrain height via a steep power curve so only the brightest pixels erupt into tall, isolated spires — mid/dark tones stay flat (keeps the terrain readable rather than a wall of noise).
- Route change away from the canvas-heavy view must clean up the render loop (`useEffect` teardown) to avoid leaking WebGL context / thermal throttling on mobile.
- Mobile 3D containers need `touch-action: pan-y` so vertical swipes scroll the page instead of spinning the canvas.
- Any HTML-shader transition effects (e.g. the hex/ASCII "decode" reveal on project media) belong in the fragment shader, not the DOM, to hold 60fps.

## Styling

Tailwind CSS, config in [tailwind.config.js](tailwind.config.js). Notable customizations:
- `borderRadius` scale is globally zeroed out (`none`/`sm`/`DEFAULT`/.../`full` all map to `0`) — this enforces the "no border radius" design rule at the framework level, don't reintroduce rounding via inline styles.
- Theme colors: `void`, `infil`, `infil-alt`, `breach`, `amber`, `text-main`, `text-alt` (see [DESIGN.md](DESIGN.md) for intended usage of each).
- `font-mono`/`font-sans` both resolve to IBM Plex Mono (data/labels); `font-orbitron` is reserved for the main header only.
- Custom `drop-shadow-magi` maps to an SVG `feColorMatrix` filter (`#magi-glow`, defined inline in the DOM) — this is the only "glow" effect; don't add CSS `filter: blur()` glows.

## Assets

`public/` holds per-brand project media (subfolders like `nucleo/`, `ohm/`, `sav/`, `pbyp/`, etc., matching entries in `projectsData.js`), plus `audio/`. Paths in `projectsData.js` must match actual files here.
