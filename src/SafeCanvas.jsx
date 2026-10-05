import React, { Component } from 'react'
import { Canvas } from '@react-three/fiber'
import { hasWebGL } from './webgl'
import { useMagiStore } from './store'
import { PROJECTS_DATA } from './projectsData'

class CanvasBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

// R3F swallows context-creation failures as unhandled promise rejections, so support has to be
// checked before mounting. The boundary only covers errors thrown while rendering the scene.
export function SafeCanvas({ fallback = null, children, ...props }) {
  if (!hasWebGL) return fallback
  return (
    <CanvasBoundary fallback={fallback}>
      <Canvas {...props}>{children}</Canvas>
    </CanvasBoundary>
  )
}

export function StaticBackdrop() {
  const line = (pct) => `color-mix(in srgb, var(--theme-infil-alt) ${pct}%, transparent)`
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: [
          `repeating-radial-gradient(circle at 28% 62%, transparent 0 22px, ${line(22)} 22px 23px)`,
          `repeating-radial-gradient(circle at 74% 30%, transparent 0 34px, ${line(14)} 34px 35px)`,
          `linear-gradient(${line(8)} 1px, transparent 1px)`,
          `linear-gradient(90deg, ${line(8)} 1px, transparent 1px)`,
        ].join(','),
        backgroundSize: 'auto, auto, 48px 48px, 48px 48px',
      }}
    />
  )
}

export function ScannerFallback() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center pointer-events-none">
      <svg viewBox="0 0 200 200" className="w-40 h-40 md:w-56 md:h-56 text-infil" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
        <circle cx="100" cy="100" r="70" />
        <ellipse cx="100" cy="100" rx="50" ry="70" />
        <ellipse cx="100" cy="100" rx="26" ry="70" />
        <line x1="30" y1="100" x2="170" y2="100" />
        <line x1="42.6" y1="60" x2="157.4" y2="60" />
        <line x1="42.6" y1="140" x2="157.4" y2="140" />
        <line x1="32.9" y1="80" x2="167.1" y2="80" />
        <line x1="32.9" y1="120" x2="167.1" y2="120" />
        <line x1="100" y1="10" x2="100" y2="190" opacity="0.4" />
        <line x1="10" y1="100" x2="190" y2="100" opacity="0.4" />
      </svg>
      <div className="font-mono text-[10px] md:text-xs tracking-[0.2em] uppercase text-infil">[ 3D SCANNER OFFLINE ]</div>
      <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-[#E0E0E0] opacity-60 max-w-xs">
        WebGL is unavailable in this browser. Turn on hardware acceleration for the live view.
      </div>
    </div>
  )
}

export function ArchiveListFallback() {
  const setExpandedProject = useMagiStore((state) => state.setExpandedProject)
  const expandedProject = useMagiStore((state) => state.expandedProject)

  const open = (index) => {
    useMagiStore.setState({ activeArchiveIndex: index })
    setExpandedProject(index)
  }

  return (
    <div className={`absolute inset-0 overflow-y-auto custom-scrollbar scrollbar-visible px-4 md:px-8 pt-14 pb-8 transition-opacity duration-500 ${expandedProject !== null ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <style>{`
        .archive-card { border: 1px solid var(--theme-breach); background: #050505; transition: background-color 0.3s; }
        .archive-card-title { color: var(--theme-breach); }
        .archive-card:hover, .archive-card:focus-visible { background: var(--theme-breach); outline: none; }
        .archive-card:hover .archive-card-title, .archive-card:focus-visible .archive-card-title { color: #090A0C; }
      `}</style>
      <div className="max-w-6xl mx-auto mb-3 font-mono text-[10px] tracking-[0.2em] uppercase text-[#E0E0E0] opacity-60">
        2D ARCHIVE MODE // WEBGL UNAVAILABLE
      </div>
      <ul className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {PROJECTS_DATA.map((project, index) => (
          <li key={project.id}>
            <button type="button" onClick={() => open(index)} className="archive-card w-full h-full flex flex-col text-left">
              <div className="aspect-[4/3] flex items-center justify-center p-4">
                {project.logo ? (
                  <img src={project.logo} alt="" loading="lazy" className="max-w-full max-h-full object-contain" />
                ) : null}
              </div>
              <div className="archive-card-title px-3 pb-3 font-mono text-[10px] md:text-xs tracking-[0.2em] uppercase">
                {String(index + 1).padStart(2, '0')} // {project.title}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
