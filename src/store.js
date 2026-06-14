import { create } from 'zustand'

export const useMagiStore = create((set) => ({
    // 1. Data Streams
    audioData: new Uint8Array(128),
    kickData: new Uint8Array(128),
    displacementTexture: null,

    // 2. Interactive Parameters
    sphereScale: 1,
    gravityRadius: 0,

    // 3. Actions
    setAudioData: (data) => set({ audioData: data }),
    setKickData: (data) => set({ kickData: data }),

    setSphereScale: (scale) => set({ sphereScale: scale, gravityRadius: scale * 1.5 }),
    setDisplacementTexture: (tex) => set({ displacementTexture: tex }),

    sphereActivity: 0,
    setSphereActivity: (val) => set({ sphereActivity: val }),

    theme: {
        infil: '#FFB000',
        infilAlt: '#42ea96',
        breach: '#FF3333'
    },
    setTheme: (newTheme) => set({ theme: newTheme }),

    // --- NEW: Global state to control the central solid geometry ---
    shapeIndex: 0,
    randomizeShape: () => set((state) => ({ shapeIndex: (state.shapeIndex + 1) % 6 })),

    expandedProject: null,
    setExpandedProject: (id) => set({ expandedProject: id }),

    lightboxMedia: null,
    setLightboxMedia: (media) => set({ lightboxMedia: media }),

    activeArchiveIndex: 0
}))