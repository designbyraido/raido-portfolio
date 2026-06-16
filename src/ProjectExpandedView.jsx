import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { PROJECTS_DATA } from './projectsData'
import { useMagiStore } from './store'

const MediaRenderer = ({ src, alt, isLogo = false, onClick }) => {
    if (!src) return null;

    const isVideo = src.match(/\.(mp4|webm|mov)$/i);

    const mediaClasses = isLogo
        ? "max-w-full max-h-full object-contain transition-opacity duration-500 cursor-pointer"
        : "w-full h-auto block opacity-80 group-hover:opacity-100 transition-opacity duration-500 cursor-pointer";

    if (isVideo) {
        return (
            <video
                src={src}
                autoPlay
                loop
                muted
                playsInline
                className={mediaClasses}
                onClick={() => onClick && onClick(src)}
            />
        );
    }

    return <img src={src} alt={alt} loading="lazy" className={mediaClasses} onClick={() => onClick && onClick(src)} />;
};

const LightboxVideoPlayer = ({ src, theme, onClose }) => {
    const videoRef = useRef(null)
    const [isPlaying, setIsPlaying] = useState(true)
    const [progress, setProgress] = useState(0)
    const [volume, setVolume] = useState(0.5)

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = 0.5
        }
    }, [])

    const togglePlay = (e) => {
        e.stopPropagation()
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play()
                setIsPlaying(true)
            } else {
                videoRef.current.pause()
                setIsPlaying(false)
            }
        }
    }

    const stopVideo = (e) => {
        e.stopPropagation()
        if (videoRef.current) {
            videoRef.current.pause()
            videoRef.current.currentTime = 0
            setIsPlaying(false)
        }
    }

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100)
        }
    }

    const handleTimelineClick = (e) => {
        e.stopPropagation()
        if (videoRef.current) {
            const rect = e.currentTarget.getBoundingClientRect()
            const clickX = e.clientX - rect.left
            const percentage = clickX / rect.width
            videoRef.current.currentTime = percentage * videoRef.current.duration
        }
    }

    const handleVolumeChange = (e) => {
        e.stopPropagation()
        const newVol = parseFloat(e.target.value)
        setVolume(newVol)
        if (videoRef.current) videoRef.current.volume = newVol
    }

    return (
        <div className="relative w-full h-full flex flex-col justify-center items-center group pointer-events-auto" onClick={onClose}>
            <video
                ref={videoRef}
                src={src}
                autoPlay
                className="max-w-[95vw] max-h-[85vh] object-contain shadow-2xl"
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                onClick={(e) => { e.stopPropagation(); togglePlay(e); }}
            />
            <div
                className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl bg-[#090A0C]/95 border p-4 flex flex-col gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ borderColor: theme.breach }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="w-full h-3 bg-[#111] border border-gray-800 cursor-pointer relative"
                    onClick={handleTimelineClick}
                >
                    <div
                        className="h-full absolute left-0 top-0 transition-all duration-75"
                        style={{ width: `${progress || 0}%`, backgroundColor: theme.infilAlt }}
                    />
                </div>

                <div className="flex justify-between items-center w-full font-mono text-xs md:text-sm">
                    <div className="flex gap-6">
                        <button onClick={togglePlay} className="hover:text-white tracking-widest transition-colors" style={{ color: theme.breach }}>
                            [{isPlaying ? 'PAUSE' : 'PLAY'}]
                        </button>
                        <button onClick={stopVideo} className="hover:text-white tracking-widest transition-colors" style={{ color: theme.breach }}>
                            [STOP]
                        </button>
                    </div>

                    <div className="flex items-center gap-3 tracking-widest" style={{ color: theme.breach }}>
                        <span>VOL:</span>
                        <input
                            type="range"
                            min="0" max="1" step="0.01"
                            value={volume}
                            onChange={handleVolumeChange}
                            className="w-24 md:w-32 cursor-pointer"
                            style={{ accentColor: theme.infil }}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

// NEW: Windows Media Viewer style Pan & Zoom logic
const ZoomableImage = ({ src, onClose }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const clickStartPos = useRef({ x: 0, y: 0 });

    const handleWheel = (e) => {
        e.stopPropagation();
        setScale((prev) => Math.min(Math.max(0.5, prev - e.deltaY * 0.005), 5));
    };

    const handlePointerDown = (e) => {
        e.stopPropagation();
        isDragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
        clickStartPos.current = { x: e.clientX, y: e.clientY };
        document.body.style.cursor = 'grabbing';
    };

    const handlePointerMove = (e) => {
        if (!isDragging.current) return;
        e.stopPropagation();
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e) => {
        e.stopPropagation();
        isDragging.current = false;
        document.body.style.cursor = 'auto';

        // If the mouse barely moved, register it as a click to close the lightbox
        const dx = e.clientX - clickStartPos.current.x;
        const dy = e.clientY - clickStartPos.current.y;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
            onClose();
        }
    };

    // Prevent body scroll from interfering with zoom
    useEffect(() => {
        const preventDefault = (e) => e.preventDefault();
        document.body.addEventListener('wheel', preventDefault, { passive: false });
        return () => document.body.removeEventListener('wheel', preventDefault);
    }, []);

    return (
        <div
            className="w-full h-full flex justify-center items-center cursor-grab overflow-hidden select-none touch-none"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            <img
                src={src}
                alt="Fullscreen media"
                draggable={false}
                className="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl pointer-events-none select-none"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    willChange: 'transform'
                }}
            />
        </div>
    );
};

export function ProjectExpandedView({ expandedProjectIndex }) {
    const { theme, setTheme, lightboxMedia, setLightboxMedia } = useMagiStore()
    const [isVisible, setIsVisible] = useState(false)
    const [activeProject, setActiveProject] = useState(null)

    useEffect(() => {
        if (expandedProjectIndex !== null) {
            const project = PROJECTS_DATA[expandedProjectIndex]
            if (project && project.theme) {
                setTheme(project.theme)
            }
            setActiveProject(expandedProjectIndex)
            const timer = setTimeout(() => setIsVisible(true), 800)
            return () => clearTimeout(timer)
        } else {
            setIsVisible(false)
            // Stock color scheme reset when backing out of a project normally
            setTheme({ infil: '#FFB000', infilAlt: '#42ea96', breach: '#FF3333' })
            const timer = setTimeout(() => setActiveProject(null), 800)
            return () => clearTimeout(timer)
        }
    }, [expandedProjectIndex, setTheme])

    // Global Escape key listener to close Lightbox
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                // If lightbox is open, close it
                setLightboxMedia(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setLightboxMedia]);

    if (activeProject === null) return null

    const project = PROJECTS_DATA[activeProject] || PROJECTS_DATA[0]
    const gallery = project.images || []

    return (
        <div
            className={`absolute inset-0 z-20 pointer-events-none flex flex-col overflow-hidden transition-all duration-700 ease-out
                ${isVisible ? 'opacity-100 bg-black/40 backdrop-blur-sm' : 'opacity-0'}`}
        >
            <style>{`
                .project-scroll::-webkit-scrollbar { width: 4px; }
                .project-scroll::-webkit-scrollbar-track { background: transparent; }
                .project-scroll::-webkit-scrollbar-thumb { background: ${theme.breach}; border-radius: 0; }
                .project-scroll { scrollbar-width: thin; scrollbar-color: ${theme.breach} transparent; }
            `}</style>

            <div className="w-full h-full pointer-events-auto overflow-y-auto overflow-x-hidden project-scroll">

                <div className="w-full max-w-7xl mx-auto flex flex-col px-6 md:px-12 lg:px-16 pt-24 pb-24">

                    <div className="flex flex-col lg:flex-row justify-between items-start gap-8 lg:gap-12 w-full mb-16">
                        <div className="flex-1 flex flex-col w-full">
                            <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-12 mb-8">
                                {/* FIX: Removed 'translate-y' logic so text fades cleanly without snapping */}
                                <h1
                                    className={`text-5xl md:text-7xl lg:text-8xl font-serif transition-opacity duration-700 delay-[200ms] ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                                    style={{ color: theme.breach }}
                                >
                                    {project.title}
                                </h1>
                                <div className={`flex flex-col gap-1 font-mono text-[10px] md:text-xs tracking-wider opacity-80 mt-2 md:mt-4 transition-opacity duration-700 delay-[300ms] ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                                    {project.roles.map((role, i) => (
                                        <span key={i} style={{ color: theme.infil }}>{role}</span>
                                    ))}
                                </div>
                            </div>

                            {/* Mobile Logo Area */}
                            <div className={`flex lg:hidden w-full h-48 md:h-64 justify-center items-center my-6 transition-opacity duration-1000 delay-[400ms] ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                                {project.logo ? (
                                    <MediaRenderer src={project.logo} alt={`${project.title} Logo`} isLogo={true} onClick={(src) => setLightboxMedia(src)} />
                                ) : (
                                    <div className="text-6xl md:text-8xl font-black tracking-tighter opacity-10 text-center">
                                        {project.title.toUpperCase()}
                                    </div>
                                )}
                            </div>

                            <p
                                className={`text-sm md:text-base leading-relaxed text-[#f5f3ef] opacity-90 max-w-2xl font-sans transition-opacity duration-700 delay-[500ms] ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                                style={{ whiteSpace: 'pre-line' }}
                                dangerouslySetInnerHTML={{ __html: project.description }}
                            />
                        </div>

                        {/* Desktop Logo Area */}
                        <div className={`hidden lg:flex flex-1 w-full max-h-[50vh] justify-center items-center p-8 transition-opacity duration-1000 delay-[600ms] ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                            {project.logo ? (
                                <MediaRenderer src={project.logo} alt={`${project.title} Logo`} isLogo={true} onClick={(src) => setLightboxMedia(src)} />
                            ) : (
                                <div className="w-full h-full flex justify-center items-center">
                                    <div className="text-8xl md:text-9xl font-black tracking-tighter opacity-10 text-center">
                                        {project.title.toUpperCase()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Masonry Gallery */}
                    <div
                        className={`columns-1 md:columns-2 lg:columns-3 gap-3 md:gap-4 transition-opacity duration-1000 delay-[600ms] ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                        style={{ '--hover-border': theme.infil }}
                    >
                        {gallery.map((mediaSrc, index) => (
                            <div
                                key={index}
                                className="break-inside-avoid w-full mb-3 md:mb-4 bg-[#050505] border border-[#222222] hover:border-[var(--hover-border)] relative overflow-hidden group transition-colors duration-500"
                            >
                                <MediaRenderer src={mediaSrc} alt={`Gallery item ${index + 1}`} onClick={(src) => setLightboxMedia(src)} />
                            </div>
                        ))}
                    </div>

                </div>
            </div>

            {/* Lightbox Overlay via Portal to escape overflow-hidden containers */}
            {lightboxMedia && createPortal(
                <div
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex justify-center items-center pointer-events-auto animate-pop-in select-none"
                >
                    {lightboxMedia.match(/\.(mp4|webm|mov)$/i) ? (
                        <LightboxVideoPlayer src={lightboxMedia} theme={theme} onClose={() => setLightboxMedia(null)} />
                    ) : (
                        <ZoomableImage src={lightboxMedia} onClose={() => setLightboxMedia(null)} />
                    )}
                </div>,
                document.body
            )}
        </div>
    )
}