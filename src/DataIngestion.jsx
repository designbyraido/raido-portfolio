import React, { useRef, useState, useEffect } from 'react'
import * as THREE from 'three'
import { useMagiStore } from './store'

const extractPaletteFromImage = (img, callback) => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = 64;
        canvas.height = 64;
        ctx.drawImage(img, 0, 0, 64, 64);
        const data = ctx.getImageData(0, 0, 64, 64).data;

        const colorMap = {};
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a < 128 || (r < 30 && g < 30 && b < 30) || (r > 240 && g > 240 && b > 240)) continue;
            const qR = Math.floor(r / 16) * 16;
            const qG = Math.floor(g / 16) * 16;
            const qB = Math.floor(b / 16) * 16;
            const hex = "#" + ((1 << 24) + (qR << 16) + (qG << 8) + qB).toString(16).slice(1).toUpperCase();
            colorMap[hex] = (colorMap[hex] || 0) + 1;
        }

        const topColors = Object.entries(colorMap).sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 50);

        const getLuma = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        };

        const getHue = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h = 0;
            if (max === min) h = 0;
            else if (max === r) h = (g - b) / (max - min) + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / (max - min) + 2;
            else if (max === b) h = (r - g) / (max - min) + 4;
            return h / 6;
        };

        const ensureNeonHex = (hex, minLuma = 0.5) => {
            let r = parseInt(hex.slice(1, 3), 16) / 255;
            let g = parseInt(hex.slice(3, 5), 16) / 255;
            let b = parseInt(hex.slice(5, 7), 16) / 255;
            let max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h = 0, s = 0, l = (max + min) / 2;

            if (max !== min) {
                let d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
                else if (max === g) h = (b - r) / d + 2;
                else if (max === b) h = (r - g) / d + 4;
                h /= 6;
                s = 1.0;
            } else {
                s = 0.0;
            }

            l = Math.max(minLuma, l);
            if (l > 0.65) l = 0.65;

            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            let p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);

            const toHex = (c) => {
                const hexStr = Math.round(c * 255).toString(16).toUpperCase();
                return hexStr.length === 1 ? "0" + hexStr : hexStr;
            };
            return "#" + toHex(r) + toHex(g) + toHex(b);
        };

        const getSaturation = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            if (max === min) return 0;
            const l = (max + min) / 2;
            return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
        };

        let vibrantColor = null;
        for (const c of topColors) {
            if (getSaturation(c) > 0.1) {
                vibrantColor = c;
                break;
            }
        }

        let infilAlt = vibrantColor || topColors[0] || '#42ea96';
        infilAlt = ensureNeonHex(infilAlt, 0.4);

        let infil = vibrantColor || topColors[0];
        let maxLuma = -1;
        for (const c of topColors) {
            const luma = getLuma(c);
            if (luma > maxLuma && getSaturation(c) > 0.05) {
                maxLuma = luma;
                infil = c;
            }
        }
        if (!infil) infil = '#FFB000';
        infil = ensureNeonHex(infil, 0.6);

        const baseHue = getHue(infilAlt);
        let breach = null;
        let maxHueDist = -1;
        for (const c of topColors) {
            if (getSaturation(c) < 0.05) continue;
            const h = getHue(c);
            let dist = Math.abs(h - baseHue);
            if (dist > 0.5) dist = 1.0 - dist;
            if (dist > maxHueDist && dist > 0.08) {
                maxHueDist = dist;
                breach = c;
            }
        }

        if (!breach) {
            for (const c of topColors) {
                if (c !== vibrantColor) {
                    breach = c;
                    break;
                }
            }
            if (!breach) breach = '#FF3333';
        }
        breach = ensureNeonHex(breach, 0.55);

        callback({
            infil: infil,
            infilAlt: infilAlt,
            breach: breach
        });
    } catch (err) {
        console.error("MAGI: Color extraction failed.", err);
    }
};

const generateRandomNeonTheme = () => {
    const randomHue1 = Math.random();
    const randomHue2 = (randomHue1 + 0.3 + Math.random() * 0.4) % 1.0;

    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    const neonFromHue = (h, minLuma) => {
        let s = 1.0;
        let l = minLuma;
        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;
        let r = hue2rgb(p, q, h + 1 / 3);
        let g = hue2rgb(p, q, h);
        let b = hue2rgb(p, q, h - 1 / 3);
        const toHex = (c) => {
            const hexStr = Math.round(c * 255).toString(16).toUpperCase();
            return hexStr.length === 1 ? "0" + hexStr : hexStr;
        };
        return "#" + toHex(r) + toHex(g) + toHex(b);
    };

    return {
        infilAlt: neonFromHue(randomHue1, 0.4),
        infil: neonFromHue(randomHue1, 0.6),
        breach: neonFromHue(randomHue2, 0.55)
    };
};

const generateRandomTopology = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, 512, 512);

    const numFeatures = Math.floor(Math.random() * 20) + 10;
    for (let i = 0; i < numFeatures; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = Math.random() * 150 + 50;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        const luma = Math.floor(Math.random() * 255);
        grad.addColorStop(0, `rgba(${luma}, ${luma}, ${luma}, 1)`);
        grad.addColorStop(1, `rgba(${luma}, ${luma}, ${luma}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
};

export function DataIngestion({ uiVisible = true }) {
    const setDisplacementTexture = useMagiStore(state => state.setDisplacementTexture)
    const setAudioData = useMagiStore(state => state.setAudioData)
    const setKickData = useMagiStore(state => state.setKickData)
    const setTheme = useMagiStore(state => state.setTheme)
    const randomizeShape = useMagiStore(state => state.randomizeShape)

    const [scrollbarVisible, setScrollbarVisible] = useState(true);
    const scrollTimeoutRef = useRef(null);

    const showScrollbar = () => {
        setScrollbarVisible(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
            setScrollbarVisible(false);
        }, 6000);
    };

    useEffect(() => {
        showScrollbar();
        return () => {
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        };
    }, []);

    const mainAudioRef = useRef(null)
    const sideAudioRef = useRef(null)
    const mainAnalyserRef = useRef(null)
    const kickAnalyserRef = useRef(null)
    const dataArrayRef = useRef(null)
    const kickArrayRef = useRef(null)
    const reqRef = useRef(null)

    const PRELOADED_TRACKS = [
        { title: 'Raido - Sol Dos', main: '/audio/Raido - Sol Dos.mp3', side: '/audio/Raido - Sol Dos_KICK.mp3' },
        { title: 'Raido - Shaker', main: '/audio/Raido - Shaker.mp3', side: '/audio/Raido - Shaker_KICK.mp3' },
        { title: 'Raido - RVN', main: '/audio/Raido - RVN.mp3', side: '/audio/Raido - RVN_KICK.mp3' },
        { title: 'Raido - Empire Plaza', main: '/audio/Raido - Empire Plaza.mp3', side: '/audio/Raido - Empire Plaza_KICK.mp3' },
        { title: 'Raido - Spoiled', main: '/audio/Raido - Spoiled.mp3', side: '/audio/Raido - Spoiled_KICK.mp3' }
    ];

    const [currentTrack, setCurrentTrack] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [volume, setVolume] = useState(0.6);
    const canvasRef = useRef(null);

    const handleVolumeChange = (e) => {
        const newVol = parseFloat(e.target.value);
        setVolume(newVol);
        if (mainAudioRef.current) {
            mainAudioRef.current.volume = newVol;
        }
    };

    const initAudio = () => {
        if (!mainAudioRef.current) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContext();

            const mainAudio = new Audio(PRELOADED_TRACKS[currentTrack].main);
            mainAudio.crossOrigin = "anonymous";
            mainAudio.volume = volume;
            mainAudioRef.current = mainAudio;

            const sideAudio = new Audio(PRELOADED_TRACKS[currentTrack].side);
            sideAudio.crossOrigin = "anonymous";
            sideAudio.volume = 1.0;
            sideAudioRef.current = sideAudio;

            const mainSource = audioCtx.createMediaElementSource(mainAudio);
            const sideSource = audioCtx.createMediaElementSource(sideAudio);

            const mainAnalyser = audioCtx.createAnalyser();
            mainAnalyser.fftSize = 1024;
            mainAnalyser.minDecibels = -85;
            mainAnalyser.maxDecibels = -5;
            mainAnalyser.smoothingTimeConstant = 0.5;

            const kickAnalyser = audioCtx.createAnalyser();
            kickAnalyser.fftSize = 1024;
            kickAnalyser.minDecibels = -85;
            kickAnalyser.maxDecibels = -5;
            kickAnalyser.smoothingTimeConstant = 0.0;

            mainSource.connect(mainAnalyser);
            mainAnalyser.connect(audioCtx.destination);
            sideSource.connect(kickAnalyser);

            mainAnalyserRef.current = mainAnalyser;
            kickAnalyserRef.current = kickAnalyser;

            dataArrayRef.current = new Uint8Array(mainAnalyser.frequencyBinCount);
            kickArrayRef.current = new Uint8Array(kickAnalyser.frequencyBinCount);

            mainAudio.addEventListener('timeupdate', () => {
                setProgress((mainAudio.currentTime / mainAudio.duration) * 100 || 0);
            });

            mainAudio.addEventListener('ended', () => {
                setIsPlaying(false);
                setProgress(0);
            });

            const updateAudioData = () => {
                if (!mainAnalyserRef.current || !kickAnalyserRef.current) return;

                mainAnalyserRef.current.getByteFrequencyData(dataArrayRef.current);
                setAudioData(dataArrayRef.current);

                kickAnalyserRef.current.getByteFrequencyData(kickArrayRef.current);
                if (setKickData) setKickData(kickArrayRef.current);

                drawVisualizer(dataArrayRef.current);
                reqRef.current = requestAnimationFrame(updateAudioData);
            };
            updateAudioData();
        }
    };

    const drawVisualizer = (dataArray) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        const currentTheme = useMagiStore.getState().theme || {};
        const infil = currentTheme.infil || '#FFB000';
        const infilAlt = currentTheme.infilAlt || '#42ea96';
        const breach = currentTheme.breach || '#FF3333';

        const numBars = 16;
        const barWidth = width / numBars;
        const step = Math.floor(dataArray.length / 2 / numBars);

        for (let i = 0; i < numBars; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) {
                sum += dataArray[i * step + j];
            }
            const avg = sum / step;

            let normalizedHeight = (avg / 255) * 1.6;
            normalizedHeight = Math.min(1.0, normalizedHeight);
            const barHeight = normalizedHeight * height;

            const grad = ctx.createLinearGradient(0, height, 0, 0);
            grad.addColorStop(0, infilAlt);
            grad.addColorStop(0.5, infil);
            grad.addColorStop(1, breach);

            ctx.fillStyle = grad;

            const chunkHeight = 2;
            const chunkGap = 1;
            const numChunks = Math.floor(barHeight / (chunkHeight + chunkGap));

            for (let c = 0; c < numChunks; c++) {
                const y = height - (c + 1) * (chunkHeight + chunkGap);
                ctx.fillRect(i * barWidth + 1, y, barWidth - 2, chunkHeight);
            }
        }
    };

    const togglePlay = () => {
        if (!mainAudioRef.current) {
            initAudio();
        }

        if (isPlaying) {
            mainAudioRef.current.pause();
            if (sideAudioRef.current) sideAudioRef.current.pause();
            setIsPlaying(false);
        } else {
            mainAudioRef.current.play().catch(e => console.log("Play failed:", e));
            if (sideAudioRef.current) sideAudioRef.current.play().catch(e => console.log(e));
            setIsPlaying(true);
        }
    };

    const selectTrack = (index) => {
        if (index === currentTrack && isPlaying) {
            togglePlay();
            return;
        }

        setCurrentTrack(index);

        if (!mainAudioRef.current) {
            initAudio();
            setTimeout(() => {
                if (mainAudioRef.current && sideAudioRef.current) {
                    mainAudioRef.current.src = PRELOADED_TRACKS[index].main;
                    sideAudioRef.current.src = PRELOADED_TRACKS[index].side;
                    mainAudioRef.current.play();
                    sideAudioRef.current.play().then(() => setIsPlaying(true));
                }
            }, 50);
            return;
        }

        mainAudioRef.current.src = PRELOADED_TRACKS[index].main;
        sideAudioRef.current.src = PRELOADED_TRACKS[index].side;
        mainAudioRef.current.play();
        sideAudioRef.current.play().then(() => setIsPlaying(true));
    };

    const handleSeek = (e) => {
        if (!mainAudioRef.current || !mainAudioRef.current.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const newTime = (clickX / width) * mainAudioRef.current.duration;

        mainAudioRef.current.currentTime = newTime;
        if (sideAudioRef.current) sideAudioRef.current.currentTime = newTime;
        setProgress((clickX / width) * 100);
    };

    useEffect(() => {
        return () => {
            if (reqRef.current) cancelAnimationFrame(reqRef.current);
            if (mainAudioRef.current) {
                mainAudioRef.current.pause();
                mainAudioRef.current.src = "";
            }
            if (sideAudioRef.current) {
                sideAudioRef.current.pause();
                sideAudioRef.current.src = "";
            }
        };
    }, []);

    const handleImageUpload = (e) => {
        const file = e.target.files[0]
        if (!file) return

        const imageUrl = URL.createObjectURL(file)

        const textureLoader = new THREE.TextureLoader()
        textureLoader.load(imageUrl, (texture) => {
            setDisplacementTexture(texture)
            if (texture.image) {
                extractPaletteFromImage(texture.image, (newTheme) => {
                    if (setTheme) {
                        setTheme(newTheme);
                    }
                });
            }
        })
    }

    const handleRandomizeTheme = () => {
        const newTheme = generateRandomNeonTheme();
        if (setTheme) {
            setTheme(newTheme);
        }

        if (setDisplacementTexture) {
            const randomTexture = generateRandomTopology();
            setDisplacementTexture(randomTexture);
        }

        if (randomizeShape) {
            randomizeShape();
        }
    };

    return (
        <div className="flex flex-col gap-2 w-full flex-1 min-h-0">
            <style>{`
                input[type=range].terminal-slider {
                    -webkit-appearance: none;
                    appearance: none;
                    background: transparent;
                }
                input[type=range].terminal-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 4px;
                    height: 12px;
                    background: var(--theme-infil);
                    cursor: pointer;
                }
                input[type=range].terminal-slider::-moz-range-thumb {
                    width: 4px;
                    height: 12px;
                    background: var(--theme-infil);
                    cursor: pointer;
                    border: none;
                }
            `}</style>

            <div className="flex gap-1 sm:gap-2 w-full shrink-0">
                <label className="cursor-pointer text-center p-2 sm:p-2.5 border border-[#E0E0E0] text-[#E0E0E0] text-[9.5px] min-[380px]:text-[11px] sm:text-[13px] font-mono tracking-wider sm:tracking-widest hover:bg-[#E0E0E0] hover:text-[#090A0C] transition-colors flex-[1.5] flex items-center justify-center whitespace-nowrap overflow-hidden">
                    [&nbsp;LOAD&nbsp;TOPOLOGY&nbsp;.JPG&nbsp;]
                    <input type="file" accept="image/jpeg, image/png" className="hidden" onChange={handleImageUpload} />
                </label>
                <button onClick={handleRandomizeTheme} className="cursor-pointer text-center p-2 sm:p-2.5 border border-[#E0E0E0] text-[#E0E0E0] text-[9.5px] min-[380px]:text-[11px] sm:text-[13px] font-mono tracking-wider sm:tracking-widest hover:bg-[#E0E0E0] hover:text-[#090A0C] transition-colors flex-[1] flex items-center justify-center whitespace-nowrap overflow-hidden">
                    [&nbsp;RANDOMIZE&nbsp;]
                </button>
            </div>

            <div className="border border-breach p-2 md:p-3 flex flex-col gap-2 md:gap-3 relative group flex-1 min-h-0">
                <div className="absolute inset-0 bg-breach opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none"></div>

                <div className="flex items-center gap-3 relative z-10 shrink-0">
                    <div className="flex-1 border border-[#222222] bg-[#050505] h-16 relative overflow-hidden flex items-center justify-center">
                        <canvas ref={canvasRef} width={200} height={64} className="absolute inset-0 w-full h-full" />
                        {!isPlaying && progress === 0 && <span className="absolute text-[#333] font-mono text-[13px] tracking-widest pointer-events-none">AWAITING SIGNAL</span>}
                    </div>

                    <button onClick={togglePlay} className="text-[#090A0C] bg-breach hover:bg-infil transition-colors w-12 h-16 shrink-0 flex items-center justify-center">
                        {isPlaying ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                        )}
                    </button>
                </div>

                <div className="w-full h-[6px] bg-[#1a1a1a] cursor-pointer group/progress relative z-10 shrink-0" onClick={handleSeek}>
                    <div className="h-full bg-breach group-hover/progress:bg-infil transition-colors" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="flex flex-col gap-1 relative z-10 mt-1 flex-1 min-h-0">
                    <div className="flex justify-between items-center border-b border-[#333] pb-2 mb-1 shrink-0">
                        <span className="text-infil font-mono text-[13px] uppercase tracking-widest opacity-50">AUDIO_SYS.OP // SELECT</span>

                        <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--theme-infil)">
                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                            </svg>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volume}
                                onChange={handleVolumeChange}
                                className="terminal-slider w-16 h-[2px] outline-none bg-[#1a1a1a]"
                                style={{
                                    backgroundImage: `linear-gradient(var(--theme-infil), var(--theme-infil))`,
                                    backgroundSize: `${volume * 100}% 100%`,
                                    backgroundRepeat: 'no-repeat'
                                }}
                            />
                        </div>
                    </div>

                    {/* FIX: CSS Mask visually fades the bottom to hint at more content. pb-6 ensures the last track clears the fade when scrolled down. */}
                    <div 
                        onScroll={showScrollbar} 
                        className={`flex flex-col gap-1 transition-all duration-1000 ease-in-out pr-1 pb-6 overflow-y-auto custom-scrollbar flex-1 min-h-[68px] ${scrollbarVisible ? 'scrollbar-visible' : ''}`}
                        style={{ maskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)' }}
                    >
                        {PRELOADED_TRACKS.map((track, idx) => {
                            const trackName = track.title;
                            const isActive = currentTrack === idx;

                            return (
                                <div
                                    key={idx}
                                    onClick={() => selectTrack(idx)}
                                    className={`cursor-pointer font-mono text-[12px] uppercase tracking-widest px-2 py-1 transition-colors flex justify-between items-center shrink-0 ${isActive
                                        ? 'bg-breach text-[#090A0C] font-bold'
                                        : 'text-infil hover:bg-[#1a1a1a]'
                                        }`}
                                >
                                    <span className="truncate pr-2">
                                        {isActive ? '> ' : ''}{trackName}
                                    </span>
                                    <span className="opacity-70 text-[10px]">
                                        {isActive && isPlaying ? '||' : '►'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </div>
    )
}