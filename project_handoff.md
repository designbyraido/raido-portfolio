# Raido Portfolio Project Handoff

This document provides a comprehensive overview of the `vite-project` codebase, serving as a handoff guide for further development and understanding of the architecture, state management, and core features.

## 1. Project Overview & Tech Stack

This project is a highly interactive, 3D-driven portfolio and showcase application. It leverages WebGL for rich visual experiences and audio-reactive elements, combined with modern React patterns for UI state.

**Core Technologies:**
*   **Build Tool:** Vite (for fast HMR and optimized builds)
*   **Framework:** React 19
*   **3D Rendering:** Three.js (`three`), React Three Fiber (`@react-three/fiber`), and React Three Drei (`@react-three/drei`)
*   **Animation:** GSAP (`gsap`, `@gsap/react`) for complex timelines and UI transitions.
*   **State Management:** Zustand (`zustand`) for lightweight, global state handling.
*   **Styling:** Tailwind CSS (`tailwindcss`) and PostCSS.
*   **Routing:** React Router v6 (`react-router-dom`).

## 2. State Management (`src/store.js`)

The global state is managed using a centralized Zustand store (`useMagiStore`). This store bridges the gap between the 3D canvas and the DOM overlay.

**Key State Slices:**
*   **3D & Audio Reactivity:** 
    *   `audioData`, `kickData`: `Uint8Array` data used to drive visual changes based on audio input.
    *   `displacementTexture`, `sphereScale`, `gravityRadius`, `sphereActivity`, `shapeIndex`: Parameters controlling the central 3D geometry's behavior and form.
*   **Theming:** 
    *   `theme`: An object containing `infil`, `infilAlt`, and `breach` hex colors. This allows the application to dynamically change its aesthetic based on the active project or user interaction.
*   **UI Navigation:**
    *   `expandedProject`: Stores the ID or index of the currently viewed project (null if in the main view).
    *   `lightboxMedia`: Tracks media (image/video) currently open in the fullscreen lightbox.
    *   `activeArchiveIndex`: Tracks the currently focused project in the 3D cylinder.

## 3. Data Structure (`src/projectsData.js`)

The content of the portfolio is driven by the `PROJECTS_DATA` array. This makes it scalable and easy to update without touching the component logic.

Each project object contains:
*   `id`, `title`: Identifiers and display names.
*   `roles`: An array of strings describing the work done (e.g., `['>Brand Design', '>Art Direction']`).
*   `theme`: A project-specific color palette (`infil`, `infilAlt`, `breach`).
*   `description`: HTML-formatted text for the project summary.
*   `logo`: Path to the project's logo image.
*   `images`: An array of paths to media assets (supporting both images and `.mp4` videos).

## 4. Core Components Architecture

### `App.jsx`
The central nervous system of the application. 
*   **Setup:** It wraps the app in a `Router` and initializes the R3F `<Canvas>`.
*   **3D Environment:** Configures an `OrthographicCamera` and includes background 3D elements like `BackgroundRadar` (which handles complex mouse/touch tracking and procedural noise for visual feedback).
*   **Overlay UI:** Renders HTML elements over the canvas, utilizing GSAP for smooth entrances and exits.

### `archivecylinder.jsx` (`ArchiveCylinder`)
The primary navigation interface in 3D space.
*   **Mechanism:** Renders a rotating cylinder of project "cards".
*   **Interaction:** Uses custom drag, swipe, and scroll logic (calculating `velocity` and `targetRotation`) to allow the user to spin the cylinder. 
*   **Integration:** Updates `activeArchiveIndex` in the store as the cylinder rotates and triggers `setExpandedProject` upon clicking a card.

### `ProjectExpandedView.jsx`
The detailed view that overlays the screen when a project is selected from the cylinder.
*   **Media Handling:** Utilizes a custom `MediaRenderer` to differentiate and correctly display images versus auto-playing videos.
*   **Lightbox:** Contains a `LightboxVideoPlayer` component for immersive, fullscreen video playback with custom controls (timeline, play/pause).

### `DataIngestion.jsx`
A utility component focused on dynamic styling.
*   **Palette Extraction:** Contains advanced logic (`extractPaletteFromImage`) to parse image data via a canvas, calculate HSL/luminance values, and generate harmonious, neon-leaning color hexes. This is likely used to adapt the app's `theme` based on the loaded project media.

## 5. Development Notes & Next Steps

*   **Adding Projects:** To add a new project, simply append a new object to the `PROJECTS_DATA` array in `projectsData.js` following the existing schema. Ensure media files are placed in the `public/` directory corresponding to the paths used. The 3D cylinder mathematically adapts (`numItems = PROJECTS_DATA.length`) to fit new entries.
*   **Performance:** Given the heavy use of WebGL and procedural noise (`hash`, `noise` functions in `App.jsx`), monitor frame rates, especially on mobile devices. The custom shaders and `MeshDistortMaterial` are performance-intensive.
*   **Audio Implementation:** The store is prepped for `audioData` and `kickData`, but the actual audio analysis pipeline (e.g., Web Audio API analyzer node) needs to be mapped to these state updates to drive the visualizer fully.

---
*Generated for AI context ingestion and handoff.*
