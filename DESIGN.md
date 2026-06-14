RAIDO 2.0 - DESIGN TOKENS & SYSTEM ARCHITECTURE
Project Identity: "Industrial Brutalism" / NERV Tactical Telemetry / MAGI System Interface
Reference Aesthetic: 2026 Marathon Video Game UI, Neon Genesis Evangelion (NERV command UI), early 90s Y2K terminal outputs, generative TouchDesigner art.

1. ABSOLUTE STRUCTURAL CONSTRAINTS
NO BORDER RADIUS: border-radius is strictly forbidden globally.

CORNER GEOMETRY: Use a deliberate mix of strict 90-degree corners for macro-containers and 45-degree chamfered corners for interactive buttons/data panes.

THE BORDER PARADOX (CHAMFERS): Because standard CSS borders fail on clip-path cuts, all 45-degree chamfered elements MUST use the "Nested Div Padding Hack". (Outer div uses the border-color background + p-[1px] padding; inner div uses the void background color; both divs share the exact same clip-path polygon).

STANDARD BORDERS: Elements with standard 90-degree corners must use strict 1px or 2px absolute solid borders.

NO SOFT SHADOWS: Traditional blurred drop shadows are forbidden. Use solid, hard-edged offsets (e.g., box-shadow: 6px 6px 0px #FF0033) or none at all.

2. COLOR PALETTE & AESTHETIC BURN
Background / Void: Dark Industrial Gray (#090A0C). Red Team Note: Shifted from pure black to prevent halation/astigmatism bleed.

Primary Accent (INFIL Green): High-Vis Neon Green (#42ea96).

Warning/Error (BREACH Red): Glossy Blood Red (#FF3333).

System Amber: Deep Orange/Amber (#FFB000) for primary borders, text, and glow filters.

The "Diagnostic" Glow: The environment utilizes a custom SVG feColorMatrix filter (.magi-glow) that crushes gamma and applies a harsh, clinical bloom, rather than a soft web shadow.

3. TYPOGRAPHY
System/Data Labels: Monospace only (e.g., IBM Plex Mono, JetBrains Mono). Used strictly for coordinates, diagnostic readouts, UI labels, and headers. Uppercase mandated.

Operational Text (Bio/Paragraphs): Clean, highly legible geometric sans-serif. Mixed case mandated. Red Team Note: Do not use monospace for long-form text to prevent reading fatigue.

4. UI COMPONENTS & RESPONSIVE LAYOUT
Global Routing: The application functions as a Single Page Application (SPA) using React Router, split into Zone 1: Home and Zone 2: Archive.

Zone 1 Layout (Desktop): Triptych layout. A massive central quarantine zone for the WebGPU scanner, flanked by dense telemetry sidebars (Bio, Arsenal, Comms).

Zone 1 Layout (Mobile): Vertical stack. The WebGPU scanner is capped at 60vh to prevent hiding the architecture. An anchor button ([ V SCROLL TO TELEMETRY ]) must be present below the scanner to allow quick bypassing.

Zone 2 Layout: Infinite Cartesian grid background. Project stack sits isometric on desktop (right-docked) and horizontal side-scrolling on mobile (bottom-docked).

Fiducial Markers: Use crosshairs (+) at the absolute corners of main layout containers.

5. WEBGPU RADAR & KINEMATICS
The central visualization acts as an active tactical readout rather than a passive background.

Global Sync State (Zustand): The Central Sphere and the Background Topography must never drift out of sync. They are bound by a global sphereActivity state in the Zustand store.

Engagement Rules:

Dormant: When unprovoked (no mouse movement), the environment is strictly frozen. The only movement is a passive 0.05 opacity CRT flicker and sparse, low-threshold red data lasers scanning the topography.

Awakened: Any mouse movement across the global window triggers a 1.0 activity spike.

Synchronized Reaction: The sphere begins to distort and hum, while the background immediately generates high-intensity (12.0) energy ripples that emanate outward from the sphere's absolute dead center (0.0). The crater violently shakes (1.5 intensity) and the laser threshold drops to spawn 50% more red tracers.

Progressive Decay: The environment does not "snap" off. A 0.03 mathematical smoothing function forces all energy ripples, vibrations, and morphs to slowly starve and wind down over a 3-second window when the user stops moving the mouse.

Foreground Protection: A strict dampening field (foregroundDampener) forces the geometry near the camera to stay flat, ensuring the focal point (the Sphere) is never occluded by massive terrain spikes.

6. DATA INGESTION (TOPOGRAPHY)
Image-to-Geometry Mapping: The system allows users to upload raw .jpg or .png images, which are immediately translated into physical Z-axis displacement in the background shader.

Spires, Not Walls: To maintain tactical legibility, uploaded data is mathematically crushed via a steep power curve (pow(texH, 4.0)). This forces dark/mid-tones to remain perfectly flat, allowing only the absolute brightest data points to erupt into towering, isolated spires (multiplied by 80.0 height).

7. SYSTEM LIFECYCLE & PERFORMANCE
Cleanup: Any route change from / to /archive must trigger a React useEffect cleanup function to explicitly kill the WebGPU render loop to prevent memory leaks and thermal throttling.

Scroll Hijacking Protection: The mobile WebGPU container must have touch-action: pan-y applied so vertical swiping scrolls the page, rather than spinning the 3D canvas.

Decode Reveal: The "Cryptographic Cascader" transition (flashing hex/ASCII logic masking the project image) must be calculated on the GPU inside a fragment shader, NOT using the HTML DOM, to maintain 60fps.