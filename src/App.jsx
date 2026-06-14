import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { BrowserRouter as Router, Routes, Route, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrthographicCamera, MeshDistortMaterial } from '@react-three/drei'
import { useMagiStore } from './store'
import { DataIngestion } from './DataIngestion'
import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react'
import * as THREE from 'three'
import { ArchiveCylinder } from './archivecylinder'
import { ProjectExpandedView } from './ProjectExpandedView'
import { PROJECTS_DATA } from './projectsData'

const RaidoLogo = ({ className }) => (
  <svg viewBox="0 0 100 100" className={className} fill="currentColor">
    <path d="M89.83.21H10.17v99.58h9.38V19.8l58.37,79.99h11.91l-36.28-49.22L89.83.21ZM71.08,9.97l-15.11,21.02-15.3-20.98,30.41-.04ZM47.69,42.32L24.24,9.95h4.86l20.98,29.09-2.39,3.29Z" />
  </svg>
)

const Reticle = ({ className }) => (
  <svg className={className} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 0V12M0 6H12" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const hash = (x, y) => {
  let pX = x - Math.floor(x);
  let pY = y - Math.floor(y);
  pX *= 0.6180339887;
  pY *= 0.6180339887;
  pX -= Math.floor(pX);
  pY -= Math.floor(pY);
  pX *= 25.0;
  pY *= 25.0;
  let result = pX * pY * (pX + pY);
  return result - Math.floor(result);
};

const noise = (x, y) => {
  const iX = Math.floor(x);
  const iY = Math.floor(y);
  const fX = x - iX;
  const fY = y - iY;
  const uX = fX * fX * (3.0 - 2.0 * fX);
  const uY = fY * fY * (3.0 - 2.0 * fY);

  const a = hash(iX, iY);
  const b = hash(iX + 1.0, iY);
  const c = hash(iX, iY + 1.0);
  const d = hash(iX + 1.0, iY + 1.0);

  return a * (1.0 - uX) + b * uX + (c - a) * uY * (1.0 - uX) + (d - b) * uX * uY;
};

function BackgroundRadar() {
  const meshRef = useRef()
  const groupRef = useRef()

  const { displacementTexture, gravityRadius, theme } = useMagiStore()

  const activeTheme = {
    infilAlt: theme?.infilAlt || '#42ea96',
    breach: theme?.breach || '#FF3333'
  };

  const rawMouse = useRef({ x: 0, y: 0 })
  const hasMoved = useRef(false)
  const isTouch = useRef(false)
  const smoothedActivity = useRef(0)

  const previousEnergy = useRef(0)

  const impactEnvelope = useRef(0)
  const glowEnvelope = useRef(0)
  const lastWaveTime = useRef(0)
  const waveIndex = useRef(0)

  const smoothedImpact = useRef(0)
  const smoothedGlow = useRef(0)

  const waveRadii = useMemo(() => new THREE.Vector3(1000, 1000, 1000), [])
  const waveIntensities = useMemo(() => new THREE.Vector3(0, 0, 0), [])

  useEffect(() => {
    const handleMouseMove = (e) => {
      hasMoved.current = true;
      if (e.touches && e.touches.length > 0) {
        isTouch.current = true;
        rawMouse.current.x = e.touches[0].clientX;
        rawMouse.current.y = e.touches[0].clientY;
      } else if (!e.touches) {
        isTouch.current = false;
        rawMouse.current.x = e.clientX;
        rawMouse.current.y = e.clientY;
      }
    }
    const handleTouchEnd = () => {
      hasMoved.current = false;
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleMouseMove, { passive: true })
    window.addEventListener('touchstart', handleMouseMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleMouseMove)
      window.removeEventListener('touchstart', handleMouseMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  const seedX = useMemo(() => Math.random() * 1000.0, [])
  const seedY = useMemo(() => Math.random() * 1000.0, [])

  const shaderArgs = useMemo(() => {
    const colorArray = [
      parseInt(activeTheme.infilAlt.slice(1, 3), 16) / 255,
      parseInt(activeTheme.infilAlt.slice(3, 5), 16) / 255,
      parseInt(activeTheme.infilAlt.slice(5, 7), 16) / 255
    ];
    const breachArray = [
      parseInt(activeTheme.breach.slice(1, 3), 16) / 255,
      parseInt(activeTheme.breach.slice(3, 5), 16) / 255,
      parseInt(activeTheme.breach.slice(5, 7), 16) / 255
    ];

    return {
      uniforms: {
        uColor: { value: colorArray },
        uBreachColor: { value: breachArray },
        uBgColor: { value: [0.035, 0.039, 0.047] },
        uDisplacement: { value: null },
        uGravityRadius: { value: 0 },
        uAudioImpact: { value: 0 },
        uAudioGlow: { value: 0 },
        uTracerAudioPump: { value: 0 },
        uBlurSpread: { value: 6.0 },
        uSeedX: { value: seedX },
        uSeedY: { value: seedY },
        uTime: { value: 0 },
        uIntroFade: { value: 0.0 },
        uActivity: { value: 0.0 },
        uWaveRadii: { value: waveRadii },
        uWaveIntensities: { value: waveIntensities }
      },
      vertexShader: `
      uniform sampler2D uDisplacement;
      uniform float uGravityRadius;
      uniform float uAudioImpact;
      uniform float uAudioGlow;
      uniform float uBlurSpread;
      uniform float uSeedX;
      uniform float uSeedY;
      uniform float uTime;
      uniform float uActivity;
      uniform vec3 uWaveRadii;
      uniform vec3 uWaveIntensities;
      
      varying float vElevation;
      varying vec2 vUv;
      varying vec3 vPositionLocal;
      varying float vCraterDip;
      varying float vLandSignal; 
      varying float vActivityGlow; 
      varying float vTravelingGlow;
      varying float vCraterAudioGlow; 

      float hash(vec2 p) { p = fract(p * 0.6180339887); p *= 25.0; return fract(p.x * p.y * (p.x + p.y)); }
      float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                     mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
          float f = 0.0; float amp = 0.5; mat2 m = mat2(0.8, 0.6, -0.6, 0.8); 
          for(int i = 0; i < 4; i++) { f += amp * noise(p); p = m * p * 2.0; amp *= 0.5; } return f;
      }

      vec4 getBlurredTexture(sampler2D tex, vec2 uv, float spread) {
          vec4 color = vec4(0.0); float offset = spread / 512.0; 
          color += texture2D(tex, uv + vec2(-offset, -offset)); color += texture2D(tex, uv + vec2(0.0, -offset)); color += texture2D(tex, uv + vec2(offset, -offset));
          color += texture2D(tex, uv + vec2(-offset, 0.0)); color += texture2D(tex, uv + vec2(0.0, 0.0)); color += texture2D(tex, uv + vec2(offset, 0.0));
          color += texture2D(tex, uv + vec2(-offset, offset)); color += texture2D(tex, uv + vec2(0.0, offset)); color += texture2D(tex, uv + vec2(offset, offset));
          return color / 9.0; 
      }

      void main() {
          vUv = uv;
          vPositionLocal = position; 
          vec3 newPosition = position;
          
          vec2 uSeed = vec2(uSeedX, uSeedY);
          vec2 uvScale = (vUv * 48.0) + uSeed; 
          vec2 perfectPos = (vUv - 0.5) * 800.0;
          
          vec2 warp = vec2(fbm(uvScale + vec2(0.0, 0.0)), fbm(uvScale + vec2(5.2, 1.3)));
          vec2 craterCenter = vec2(-6.0, -5.0);
          float distFromCenter = distance(perfectPos, craterCenter);
          
          float staticBaseRadius = 5.25 + (uGravityRadius * 4.5);
          float craterNoise = fbm(perfectPos * 0.35 + uSeed); 
          float staticTerrainRadius = staticBaseRadius + (craterNoise * 6.75);
          
          float foregroundDampener = mix(0.15, 1.0, smoothstep(-50.0, -10.0, perfectPos.y));
          float craterShield = smoothstep(staticTerrainRadius * 2.5, staticTerrainRadius * 0.8, distFromCenter) * 0.4;
          float baseNoiseRaw = fbm(uvScale * 0.5 + warp * 1.2) + craterShield;
          
          float waterLevel = mix(0.35, 0.45, fract(sin(dot(uSeed, vec2(12.9898, 78.233))) * 43758.5453));
          float plainsBase = smoothstep(waterLevel, waterLevel + 0.3, baseNoiseRaw);
          
          vec2 mountainUv = uvScale * 0.8 + vec2(-10.0, 20.0);
          mountainUv += warp * 0.6; 
          
          float microNoiseRaw = noise(uvScale * 3.5 + vec2(42.0, 11.0));
          float platNoiseRaw = noise(uvScale * 0.35 + vec2(15.0, -10.0) + warp * 0.2); 
          float volcNoiseRaw = noise(mountainUv);
          
          float m1 = smoothstep(0.7, 1.0, microNoiseRaw);
          float m2 = smoothstep(0.88, 0.93, platNoiseRaw); 
          float m3 = smoothstep(0.975, 1.0, volcNoiseRaw);
          
          float combinedSignal = plainsBase + m1 + m2 + m3;
          float geoMask = smoothstep(0.0, 0.15, combinedSignal);
          
          float plains = pow(plainsBase, 2.0) * 5.0;
          float spireShield = smoothstep(120.0, 260.0, perfectPos.y); 

          float microSpires = pow(m1, 2.0) * 12.0;
          float plateauBumps = fbm(uvScale * 2.5) * 4.0; 
          float plateaus = (m2 * 28.0 + (m2 * plateauBumps)) * spireShield; 
          
          float calderaChance = noise(mountainUv * 0.5 + vec2(10.0, 50.0));
          float calderaDip = smoothstep(0.92, 1.0, volcNoiseRaw) * smoothstep(0.4, 0.6, calderaChance) * 0.85; 
          
          float sheerErosion = fbm(mountainUv * 2.0 + warp);
          float carveMask = smoothstep(0.3, 0.7, sheerErosion);
          
          float volcShape = max(0.0, m3 - calderaDip);
          volcShape *= mix(0.3, 1.0, carveMask);
          
          float facets = abs(fbm(mountainUv * 3.0)) * 0.5;
          float ridges = pow(1.0 - abs(noise(mountainUv * 1.8)), 3.0) * 0.8;
          
          float volcanoes = (pow(volcShape, 1.3) + (volcShape * facets) + (volcShape * ridges)) * 65.0 * spireShield;
          
          float rawElevation = (plains + microSpires + plateaus + volcanoes) * geoMask * foregroundDampener; 
          float craterSmoothing = smoothstep(staticTerrainRadius * 0.5, staticTerrainRadius * 1.8, distFromCenter);
          float baseElevation = rawElevation * craterSmoothing;
          
          vec4 texColor = getBlurredTexture(uDisplacement, vUv, uBlurSpread);
          float texH = (texColor.r + texColor.g + texColor.b) / 3.0;
          
          texH = pow(texH, 4.0); 
          texH = smoothstep(0.05, 0.9, texH);
          
          float edgeMask = smoothstep(0.0, 0.03, vUv.x) * (1.0 - smoothstep(0.97, 1.0, vUv.x)) * smoothstep(0.0, 0.03, vUv.y) * (1.0 - smoothstep(0.97, 1.0, vUv.y));
          float imageShield = smoothstep(staticTerrainRadius * 1.2, staticTerrainRadius * 4.0, distFromCenter);
          
          float imgElevation = texH * 80.0 * imageShield * edgeMask * foregroundDampener; 
          float elevation = baseElevation + imgElevation;
          vLandSignal = combinedSignal + (texH * imageShield * edgeMask * foregroundDampener);

          float basinNoise = fbm(uvScale * 1.5) * 2.0 * geoMask; 
          float repulsion = smoothstep(staticTerrainRadius * 0.8, staticTerrainRadius * 2.5, distFromCenter);
          elevation = mix(basinNoise, elevation, repulsion);

          float dynamicRadius = staticTerrainRadius + (uActivity * 2.5) + (uAudioImpact * 12.8);

          float craterIsolationMask = 1.0 - smoothstep(dynamicRadius * 0.5, dynamicRadius * 3.5, distFromCenter);
          float lightShockwave = 1.0 - smoothstep(0.0, dynamicRadius * 35.0, distFromCenter);

          float wavePhase = distFromCenter * 0.15 - (uTime * 12.0);
          float hoverRipple = sin(wavePhase) * 4.0 * craterIsolationMask; 
          float softBand = pow(cos(wavePhase) * 0.5 + 0.5, 8.0);
          float hoverGlow = softBand * lightShockwave * craterIsolationMask * 2.5;

          float totalWaveHeight = 0.0;
          float totalWaveGlow = 0.0;
          float lightPulseWave = 0.0;
          
          float dists[3];
          dists[0] = abs(distFromCenter - uWaveRadii.x);
          dists[1] = abs(distFromCenter - uWaveRadii.y);
          dists[2] = abs(distFromCenter - uWaveRadii.z);
          
          float intens[3];
          intens[0] = uWaveIntensities.x;
          intens[1] = uWaveIntensities.y;
          intens[2] = uWaveIntensities.z;

          for(int i=0; i<3; i++) {
              float waveProfile = exp(-pow(dists[i] / 4.0, 2.0));
              float lightProfile = exp(-pow(dists[i] / 1.5, 2.0));
              totalWaveHeight += waveProfile * intens[i] * 12.0;
              totalWaveGlow += waveProfile * intens[i] * 3.5; 
              lightPulseWave += lightProfile * intens[i] * 1.5; 
          }

          totalWaveHeight *= craterIsolationMask;
          totalWaveGlow *= craterIsolationMask;

          float swellForegroundShield = smoothstep(-15.0, 15.0, perfectPos.y);
          float heightSwell = exp(-pow(distFromCenter / (dynamicRadius * 2.0), 2.0)) * 5.0 * swellForegroundShield * craterIsolationMask; 
          
          float activeSwell = ((heightSwell + hoverRipple) * uActivity) + (totalWaveHeight * swellForegroundShield);
          elevation += activeSwell;
          
          float bowlRadius = dynamicRadius * 1.05; 
          float dip = exp(-pow(distFromCenter / bowlRadius, 16.0)) * (uAudioImpact * 4.0 + 12.0);
          elevation -= dip;

          vCraterDip = dip;
          float centerGlow = exp(-pow(distFromCenter / (staticTerrainRadius + uAudioImpact * 1.6), 2.0)) * uAudioGlow * 4.8;

          vCraterAudioGlow = (lightPulseWave + centerGlow) * craterIsolationMask * lightShockwave;
          vActivityGlow = lightShockwave * uActivity * craterIsolationMask; 
          vTravelingGlow = (totalWaveGlow * lightShockwave) + (hoverGlow * uActivity); 
          
          vElevation = elevation;
          newPosition.z += elevation;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
      `,
      fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uBreachColor;
      uniform vec3 uBgColor;
      uniform float uTime;
      uniform float uIntroFade;
      uniform float uActivity;
      uniform float uTracerAudioPump; 
      varying float vElevation;
      varying vec2 vUv;
      varying vec3 vPositionLocal;
      varying float vCraterDip;
      varying float vLandSignal; 
      varying float vActivityGlow; 
      varying float vTravelingGlow;
      varying float vCraterAudioGlow; 

      void main() {
          float lineFrequency = 1.75; 
          float val = vElevation * lineFrequency; 
          float rawDf = clamp(fwidth(val), 0.0001, 10.0); 
          float df = clamp(rawDf, 0.01, 0.45); 
          float pixelDist = abs(fract(val - 0.5) - 0.5) / df;
          float greenLine = 1.0 - smoothstep(0.5, 1.5, pixelDist);
          float cliffGlow = smoothstep(0.15, 0.35, rawDf);
          greenLine = max(greenLine, cliffGlow);
          float landAlpha = smoothstep(0.0, 0.45, vLandSignal);
          float beachGlow = smoothstep(0.0, 0.18, vLandSignal) * (1.0 - smoothstep(0.18, 0.60, vLandSignal));
          greenLine *= landAlpha; 
          vec3 waterColor = uColor * 0.35; 
          vec3 brightBeachColor = uColor * 0.9; 
          vec3 baseSurface = mix(waterColor, uBgColor, landAlpha);
          baseSurface = mix(baseSurface, brightBeachColor, beachGlow);
          vec3 finalColor = mix(baseSurface, uColor, greenLine);
          
          float across = vUv.x + vUv.y; 
          
          float numTracks = 240.0;
          float trackId = floor(across * numTracks);
          float trackCenter = fract(across * numTracks);
          
          float trackPos = trackId / numTracks;
          float centerBias = smoothstep(0.0, 1.0, 1.0 - abs(trackPos - 0.5) * 2.0);
          float threshold = 0.65 - (centerBias * 0.6); 
          float isActiveTrack = step(threshold, fract(sin(trackId * 12.9898) * 43758.5453));
          
          float along = vUv.x - vUv.y;
          float speed = 0.035;
          float trackPhase = fract(sin(trackId * 78.39) * 43758.5453);
          float progress1 = fract(uTime * speed + trackPhase) * 4.0 - 2.0; 
          float progress2 = fract(uTime * speed + trackPhase + 0.5) * 4.0 - 2.0; 
          float distToHead1 = progress1 - along;
          float distToHead2 = progress2 - along;
          float tail = max(smoothstep(0.8, 0.0, distToHead1) * step(0.0, distToHead1), smoothstep(0.8, 0.0, distToHead2) * step(0.0, distToHead2));
          float head = max(smoothstep(0.015, 0.0, distToHead1) * step(0.0, distToHead1), smoothstep(0.015, 0.0, distToHead2) * step(0.0, distToHead2));
          float px = fwidth(across * numTracks); 
          float thickness = mix(px * (1.0 + uActivity * 1.5), px * (4.0 + uActivity * 4.0), head);
          float isLaserLine = smoothstep(thickness + px, thickness - px, abs(trackCenter - 0.5));
          
          float beam = isLaserLine * isActiveTrack; 
          
          vec3 redTracer = uBreachColor;
          
          float audioBoost = 1.0 + (uTracerAudioPump * 2.0); 
          
          float tailPulse = (3.0 + (uActivity * 6.0)) * audioBoost;
          float headPulse = (8.0 + (uActivity * 12.0)) * audioBoost; 
          
          finalColor = mix(finalColor, redTracer * tailPulse, beam * tail);
          finalColor = mix(finalColor, redTracer * headPulse, beam * head);

          finalColor += uColor * (vActivityGlow * 0.10 + vTravelingGlow * 0.6);

          vec3 flashColor = uColor * 2.5; 
          finalColor += flashColor * vCraterAudioGlow;

          finalColor *= (0.955 + 0.045 * sin(uTime * 142.5));
          
          float depthFade = mix(0.4, 1.0, smoothstep(-35.0, 20.0, vElevation));
          finalColor *= depthFade;
          
          float craterShadow = 1.0 - (smoothstep(0.0, 20.0, vCraterDip) * 0.6);
          finalColor *= craterShadow;
          
          float uvDistFromCenter = distance(vUv, vec2(0.5));
          float alphaFade = 1.0 - smoothstep(0.35, 0.5, uvDistFromCenter);
          
          gl_FragColor = vec4(finalColor, alphaFade * uIntroFade);
      }
      `,
      transparent: true,
      depthWrite: true,
      depthTest: true
    };
  }, [seedX, seedY, waveRadii, waveIntensities])

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.material.uniforms.uSeedX.value = Math.random() * 1000.0;
      meshRef.current.material.uniforms.uSeedY.value = Math.random() * 1000.0;
    }
  }, [displacementTexture])

  useEffect(() => {
    if (meshRef.current) {
      const colorArray = [
        parseInt(activeTheme.infilAlt.slice(1, 3), 16) / 255,
        parseInt(activeTheme.infilAlt.slice(3, 5), 16) / 255,
        parseInt(activeTheme.infilAlt.slice(5, 7), 16) / 255
      ];
      meshRef.current.material.uniforms.uColor.value = colorArray;

      if (meshRef.current.material.uniforms.uBreachColor) {
        const breachArray = [
          parseInt(activeTheme.breach.slice(1, 3), 16) / 255,
          parseInt(activeTheme.breach.slice(3, 5), 16) / 255,
          parseInt(activeTheme.breach.slice(5, 7), 16) / 255
        ];
        meshRef.current.material.uniforms.uBreachColor.value = breachArray;
      }
    }
  }, [activeTheme.infilAlt, activeTheme.breach])

  useFrame((state, delta) => {
    if (!meshRef.current || !groupRef.current) return
    const { kickData } = useMagiStore.getState()

    const currentEnergy = kickData && kickData.length > 2 ? (kickData[2] || 0) / 255 : 0;
    const flux = Math.max(0, currentEnergy - previousEnergy.current);
    previousEnergy.current = currentEnergy;

    let kickTrigger = false;

    if (flux > 0.05 && currentEnergy > 0.15) {
      if (state.clock.elapsedTime - lastWaveTime.current > 0.22) {
        kickTrigger = true;
        impactEnvelope.current = 0.08;
        glowEnvelope.current = 0.70;

        waveIndex.current = (waveIndex.current + 1) % 3;
        const axis = waveIndex.current === 0 ? 'x' : waveIndex.current === 1 ? 'y' : 'z';
        waveRadii[axis] = 0.0;
        waveIntensities[axis] = 1.0;
        lastWaveTime.current = state.clock.elapsedTime;
      }
    }

    if (!kickTrigger) {
      impactEnvelope.current = impactEnvelope.current * Math.exp(-6.0 * delta);
      glowEnvelope.current = glowEnvelope.current * Math.exp(-4.0 * delta);
    }

    const isOpening = impactEnvelope.current > smoothedImpact.current;
    const easeSpeed = isOpening ? 15.0 : 3.5;
    smoothedImpact.current = THREE.MathUtils.lerp(smoothedImpact.current, impactEnvelope.current, 1.0 - Math.exp(-easeSpeed * delta));
    const glowEaseSpeed = isOpening ? 10.0 : 2.5;
    smoothedGlow.current = THREE.MathUtils.lerp(smoothedGlow.current, glowEnvelope.current, 1.0 - Math.exp(-glowEaseSpeed * delta));

    waveRadii.x += 1.5;
    waveRadii.y += 1.5;
    waveRadii.z += 1.5;
    waveIntensities.x *= Math.exp(-0.15 * delta);
    waveIntensities.y *= Math.exp(-0.15 * delta);
    waveIntensities.z *= Math.exp(-0.15 * delta);

    meshRef.current.material.uniforms.uTime.value = state.clock.elapsedTime;
    meshRef.current.material.uniforms.uAudioImpact.value = smoothedImpact.current;
    meshRef.current.material.uniforms.uAudioGlow.value = smoothedGlow.current;

    const normalizedPump = Math.min(1.0, impactEnvelope.current * 8.0);
    meshRef.current.material.uniforms.uTracerAudioPump.value = normalizedPump;

    meshRef.current.material.uniforms.uGravityRadius.value = displacementTexture ? gravityRadius : 0;
    meshRef.current.material.uniforms.uDisplacement.value = displacementTexture
    meshRef.current.material.uniforms.uIntroFade.value = Math.min(1.0, meshRef.current.material.uniforms.uIntroFade.value + 0.003);

    const isHoveringUi = document.body.classList.contains('hovering-ui');

    let px = 0;
    let py = 0;
    if (hasMoved.current && !isHoveringUi) {
      px = (rawMouse.current.x / window.innerWidth) * 2 - 1;
      py = -(rawMouse.current.y / window.innerHeight) * 2 + 1;
    }
    const dist = Math.sqrt(px * px + py * py);
    const maxDist = 0.7;
    const fullPowerDist = 0.25;
    let localMouseActivity = 0;

    if (hasMoved.current && !isTouch.current && !isHoveringUi) {
      if (dist <= fullPowerDist) localMouseActivity = 1.0;
      else if (dist < maxDist) localMouseActivity = 1.0 - ((dist - fullPowerDist) / (maxDist - fullPowerDist));
    }
    smoothedActivity.current += (localMouseActivity - smoothedActivity.current) * 0.08;
    meshRef.current.material.uniforms.uActivity.value = smoothedActivity.current;

    let globalPx = 0;
    let globalPy = 0;
    if (hasMoved.current && !isHoveringUi) {
      globalPx = (rawMouse.current.x / window.innerWidth) * 2 - 1;
      globalPy = -(rawMouse.current.y / window.innerHeight) * 2 + 1;
    }

    const targetGroupX = isTouch.current || isHoveringUi ? 0 : (globalPy * -0.3);
    const targetGroupY = isTouch.current || isHoveringUi ? 0 : (globalPx * 0.3);

    groupRef.current.rotation.x += (targetGroupX - groupRef.current.rotation.x) * 0.02;
    groupRef.current.rotation.y += (targetGroupY - groupRef.current.rotation.y) * 0.02;
    const targetMeshX = -1.2;
    meshRef.current.rotation.x += (targetMeshX - meshRef.current.rotation.x) * 0.006;
  })

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} position={[0, -10, -25]}>
        <planeGeometry args={[800, 800, 512, 512]} />
        <shaderMaterial args={[shaderArgs]} extensions={{ derivatives: true }} />
      </mesh>
    </group>
  )
}

function TopologyGrid() {
  const meshRef = useRef()
  const groupRef = useRef()
  const matRef = useRef()
  const setSphereScale = useMagiStore((state) => state.setSphereScale)
  const setSphereActivity = useMagiStore((state) => state.setSphereActivity)

  const { theme, displacementTexture } = useMagiStore()

  const [shapeIndex, setShapeIndex] = useState(() => Math.floor(Math.random() * 6));

  useEffect(() => {
    setShapeIndex(prev => {
      let next = Math.floor(Math.random() * 6);
      if (next === prev) next = (next + 1) % 6;
      return next;
    });
  }, [theme, displacementTexture]);

  const activeTheme = {
    infil: theme?.infil || '#FFB000',
    infilAlt: theme?.infilAlt || '#42ea96',
    breach: theme?.breach || '#FF3333'
  };

  const rawMouse = useRef({ x: 0, y: 0 })
  const hasMoved = useRef(false)
  const isTouch = useRef(false)
  const colorActivity = useRef(0)

  const highThreshold = useRef(0.15)
  const impactLerp = useRef(0)
  const glowLerp = useRef(0)
  const lastHitTime = useRef(0)

  useEffect(() => {
    const handleMouseMove = (e) => {
      hasMoved.current = true;
      if (e.touches && e.touches.length > 0) {
        isTouch.current = true;
        rawMouse.current.x = e.touches[0].clientX;
        rawMouse.current.y = e.touches[0].clientY;
      } else if (!e.touches) {
        isTouch.current = false;
        rawMouse.current.x = e.clientX;
        rawMouse.current.y = e.clientY;
      }
    }
    const handleTouchEnd = () => {
      hasMoved.current = false;
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleMouseMove, { passive: true })
    window.addEventListener('touchstart', handleMouseMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleMouseMove)
      window.removeEventListener('touchstart', handleMouseMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  const activeEmissive = useMemo(() => new THREE.Color(activeTheme.breach), [activeTheme.breach])
  const idleEmissive = useMemo(() => new THREE.Color(activeTheme.infilAlt), [activeTheme.infilAlt])

  const stripeTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 1024
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 4, 1024)

    ctx.fillStyle = '#ffffff'
    const numRings = 12;
    const thickness = 10;
    for (let i = 0; i < numRings; i++) {
      ctx.fillRect(0, Math.floor((i / numRings) * 1024), 4, thickness)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    return tex
  }, [])

  useFrame((state) => {
    if (!meshRef.current || !matRef.current || !groupRef.current) return

    meshRef.current.rotation.order = 'YXZ';
    groupRef.current.rotation.order = 'YXZ';

    const { audioData } = useMagiStore.getState()
    let highMax = 0;
    if (audioData && audioData.length > 0) {
      for (let i = 40; i < 120; i++) {
        if (audioData[i] > highMax) highMax = audioData[i];
      }
    }
    const highRaw = highMax / 255;

    let hitTrigger = 0;
    if (highRaw > highThreshold.current && highRaw > 0.15) {
      const transient = highRaw - highThreshold.current;
      let rawHit = Math.pow(transient * 12.0, 1.2);

      rawHit = Math.min(1.0, rawHit) * 0.8;

      if (rawHit > 0.2 && state.clock.elapsedTime - lastHitTime.current > 0.3) {
        hitTrigger = rawHit;
        highThreshold.current = highRaw * 1.2;
        lastHitTime.current = state.clock.elapsedTime;
      }
    }
    highThreshold.current = Math.max(0.15, highThreshold.current * 0.94);

    impactLerp.current += (hitTrigger - impactLerp.current) * (hitTrigger > 0 ? 0.6 : 0.06);
    glowLerp.current += (hitTrigger - glowLerp.current) * (hitTrigger > 0 ? 0.5 : 0.05);

    let px = 0;
    let py = 0;

    if (hasMoved.current) {
      px = (rawMouse.current.x / window.innerWidth) * 2 - 1;
      py = -(rawMouse.current.y / window.innerHeight) * 2 + 1;
    }

    const dist = Math.sqrt(px * px + py * py);
    const maxDist = 0.7;
    const fullPowerDist = 0.25;
    let mouseExcitement = 0;

    if (hasMoved.current && !isTouch.current) {
      if (dist <= fullPowerDist) {
        mouseExcitement = 1.0;
      } else if (dist < maxDist) {
        mouseExcitement = 1.0 - ((dist - fullPowerDist) / (maxDist - fullPowerDist));
      }
    }

    const activity = Math.min(1.0, mouseExcitement + impactLerp.current);
    const glowActivity = Math.min(1.0, mouseExcitement + glowLerp.current);

    if (setSphereActivity) {
      setSphereActivity(activity);
    }

    meshRef.current.rotation.x += 0.003;
    meshRef.current.rotation.y += 0.005;

    let targetX = 0;
    let targetY = 0;
    let parallaxX = 0;
    let parallaxY = 0;

    if (isTouch.current) {
      targetX = -0.2 + Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
      targetY = Math.cos(state.clock.elapsedTime * 0.15) * 0.05;
      parallaxX = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
      parallaxY = Math.cos(state.clock.elapsedTime * 0.2) * 0.1;
    } else {
      targetX = -0.2 + (py * 1.5 * activity);
      targetY = (px * 2.5 * activity);
      parallaxX = (px * 1.0) * activity;
      parallaxY = (py * 1.0) * activity;
    }

    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.05;
    groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.05;

    const hoverY = Math.sin(state.clock.elapsedTime * 1.2) * 0.25;
    groupRef.current.position.x += (parallaxX - groupRef.current.position.x) * 0.05;
    groupRef.current.position.y += ((parallaxY + hoverY) - groupRef.current.position.y) * 0.05;

    const targetScale = 1.0 + (impactLerp.current * 0.3) + (activity * 0.1);

    meshRef.current.scale.x += (targetScale - meshRef.current.scale.x) * 0.25;
    meshRef.current.scale.y = meshRef.current.scale.x;
    meshRef.current.scale.z = meshRef.current.scale.x;
    setSphereScale(meshRef.current.scale.x)

    if (matRef.current) {
      colorActivity.current += (glowActivity - colorActivity.current) * 0.15;
      const colorBlend = Math.min(1.0, colorActivity.current * 4.0);
      matRef.current.emissive.copy(idleEmissive).lerp(activeEmissive, colorBlend);

      const targetDistort = 0.1 + (impactLerp.current * 2.5) + (activity * 0.9);
      const targetSpeed = 2.0 + (impactLerp.current * 20.0) + (activity * 6.0);

      matRef.current.distort += (targetDistort - matRef.current.distort) * 0.25;
      matRef.current.speed += (targetSpeed - matRef.current.speed) * 0.25;

      const baseIntensity = 0.5 + (glowActivity * 0.5);
      const humAmplitude = 0.1;

      matRef.current.emissiveIntensity = baseIntensity + humAmplitude * Math.sin(state.clock.elapsedTime * 150.0);
    }
  })

  const geometries = [
    <sphereGeometry key="0" args={[1.5, 64, 48]} />,
    <boxGeometry key="1" args={[2.0, 2.0, 2.0, 32, 32, 32]} />,
    <tetrahedronGeometry key="2" args={[2.0, 0]} />,
    <octahedronGeometry key="3" args={[2.0, 0]} />,
    <dodecahedronGeometry key="4" args={[1.8, 0]} />,
    <icosahedronGeometry key="5" args={[1.8, 0]} />
  ];

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef}>
        {geometries[shapeIndex]}

        <MeshDistortMaterial
          ref={matRef}
          color="#090A0C"
          emissiveIntensity={1.0}
          speed={4}
          distort={0.4}
          wireframe={false}
          emissiveMap={stripeTexture}
          transparent={true}
          opacity={1.0}
          roughness={1.0}
          metalness={0.0}
          envMapIntensity={0.0}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function DataTicker() {
  const tickerRef = useRef(null);

  const strings = [
    "GRAPHIC DESIGN \u00A0\u2022\u00A0 ART DIRECTION \u00A0\u2022\u00A0 2D \u00A0\u2022\u00A0 3D \u00A0\u2022\u00A0 SOUND \u00A0\u2022\u00A0 GRAPHIC DESIGN \u00A0\u2022\u00A0 ART DIRECTION \u00A0\u2022\u00A0 2D \u00A0\u2022\u00A0 3D \u00A0\u2022\u00A0 SOUND \u00A0\u2022\u00A0 ",
    "GRAPHIC DESIGN \u00A0\u2022\u00A0 ART DIRECTION \u00A0\u2022\u00A0 2D \u00A0\u2022\u00A0 3D \u00A0\u2022\u00A0 SOUND \u00A0\u2022\u00A0 GRAPHIC DESIGN \u00A0\u2022\u00A0 ART DIRECTION \u00A0\u2022\u00A0 2D \u00A0\u2022\u00A0 3D \u00A0\u2022\u00A0 SOUND \u00A0\u2022\u00A0 ",
    "GRAPHIC DESIGN \u00A0\u2022\u00A0 ART DIRECTION \u00A0\u2022\u00A0 2D \u00A0\u2022\u00A0 3D \u00A0\u2022\u00A0 SOUND \u00A0\u2022\u00A0 GRAPHIC DESIGN \u00A0\u2022\u00A0 ART DIRECTION \u00A0\u2022\u00A0 2D \u00A0\u2022\u00A0 3D \u00A0\u2022\u00A0 SOUND \u00A0\u2022\u00A0 "
  ];

  const [text, setText] = useState(strings[0]);

  useGSAP(() => { gsap.to(tickerRef.current, { xPercent: -50, ease: "none", duration: 30, repeat: -1 }) }, []);

  useEffect(() => {
    const chars = "!<>-_\\/[]{}==+*^?#________"; let currentIndex = 0; let scrambleInterval;
    const scramble = () => {
      currentIndex = (currentIndex + 1) % strings.length; const target = strings[currentIndex]; let revealOrder = Array.from({ length: target.length }, (_, i) => i).sort(() => Math.random() - 0.5); let resolvedCount = 0; let tickCount = 0;
      clearInterval(scrambleInterval); scrambleInterval = setInterval(() => { tickCount++; if (tickCount % 2 === 0) resolvedCount++; const resolvedIndices = new Set(revealOrder.slice(0, resolvedCount)); setText(() => target.split("").map((char, index) => { if (resolvedIndices.has(index)) return target[index]; return chars[Math.floor(Math.random() * chars.length)]; }).join("")); if (resolvedCount >= target.length) clearInterval(scrambleInterval); }, 15);
    };

    let masterLoop;
    const ignitionPrimer = setTimeout(() => {
      scramble();
      masterLoop = setInterval(scramble, 15000);
    }, 3000);

    return () => {
      clearTimeout(ignitionPrimer);
      clearInterval(masterLoop);
      clearInterval(scrambleInterval);
    };
  }, []);

  return (
    <div className="w-full border-t border-b border-infil bg-[#090A0C] overflow-hidden py-1 lg:py-1.5 select-none flex items-center whitespace-nowrap shadow-infil shrink-0">
      <div ref={tickerRef} className="font-mono text-xs lg:text-sm text-infil tracking-widest uppercase flex items-center">
        <span>{text.repeat(3)}</span><span>{text.repeat(3)}</span>
      </div>
    </div>
  )
}

function TerminalPanel({ title, children, flexClass = "shrink-0", footer = null }) {
  return (
    <div className={`border border-infil flex flex-col p-1.5 md:p-2 bg-[#090A0C] w-full ${flexClass}`}>
      <h2 className="font-mono text-[12px] md:text-[13px] font-bold tracking-widest uppercase text-infil pb-1 shrink-0">
        {title}
      </h2>
      <div className="h-[1px] w-full bg-infil mb-1.5 shadow-infil-tight shrink-0"></div>

      <div className="font-sans text-[14px] md:text-[15px] text-[#E0E0E0] leading-relaxed flex-1 min-h-0 flex flex-col w-full">
        {children}
      </div>
      {footer && (
        <div className="pt-2 mt-auto shrink-0 border-t border-infil/30 mt-2">
          {footer}
        </div>
      )}
    </div>
  );
}

function Navigation() {
  return (
    <nav className="mb-1 lg:mb-2 flex flex-col sm:flex-row gap-2 lg:gap-3 animate-crt-flicker relative z-50">
      <NavLink to="/" className={({ isActive }) => `text-center px-2 py-1 uppercase font-sans font-bold text-xs lg:text-sm tracking-widest border transition-colors duration-100 whitespace-nowrap w-full sm:w-auto ${isActive ? 'bg-infil text-[#090A0C] border-infil' : 'bg-[#090A0C] text-[#E0E0E0] border-[#E0E0E0] hover:border-infil hover:text-infil'}`}>Home // Telemetry</NavLink>
      <NavLink to="/archive" className={({ isActive }) => `text-center px-2 py-1 uppercase font-sans font-bold text-xs lg:text-sm tracking-widest border transition-colors duration-100 whitespace-nowrap w-full sm:w-auto ${isActive ? 'bg-breach text-[#090A0C] border-breach' : 'bg-[#090A0C] text-[#E0E0E0] border-[#E0E0E0] hover:border-breach hover:text-breach'}`}>Projects // Archive</NavLink>
    </nav>
  )
}

function BackgroundFadeOverlay() {
  const location = useLocation();
  const isArchive = location.pathname === '/archive';

  return (
    <div
      className={`absolute inset-0 bg-[#090A0C] pointer-events-none transition-opacity duration-1000 ease-in-out ${isArchive ? 'opacity-100' : 'opacity-0'}`}
    />
  );
}

function Home({ uiVisible, setUiVisible }) {
  const [isMouseIdle, setIsMouseIdle] = useState(false);
  const [hasManuallyDisabled, setHasManuallyDisabled] = useState(false);

  const [sidebarScrollbarVisible, setSidebarScrollbarVisible] = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);
  const sidebarScrollTimeoutRef = useRef(null);

  const handleSidebarScroll = (e) => {
    setSidebarScrollbarVisible(true);
    if (sidebarScrollTimeoutRef.current) clearTimeout(sidebarScrollTimeoutRef.current);
    sidebarScrollTimeoutRef.current = setTimeout(() => {
      setSidebarScrollbarVisible(false);
    }, 6000);

    if (e && e.target) {
      if (e.target.scrollTop > 20) {
        setHasScrolled(true);
      } else {
        setHasScrolled(false);
      }
    }
  };

  useEffect(() => {
    handleSidebarScroll();
    return () => {
      if (sidebarScrollTimeoutRef.current) clearTimeout(sidebarScrollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let timeoutId;
    const handleActivity = () => {
      setIsMouseIdle(false);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setIsMouseIdle(true), 5000);
    };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity, { passive: true });
    window.addEventListener('touchmove', handleActivity, { passive: true });
    timeoutId = setTimeout(() => setIsMouseIdle(true), 5000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('touchmove', handleActivity);
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="flex flex-col xl:grid xl:grid-cols-12 flex-1 h-full gap-2 relative z-10 pointer-events-none min-h-0">

      <div className={`absolute bottom-0 right-0 z-50 transition-all duration-1000 ease-in-out ${!uiVisible && hasManuallyDisabled && !isMouseIdle ? 'delay-500 opacity-100 pointer-events-auto translate-y-0' : 'delay-0 opacity-0 pointer-events-none translate-y-4'}`}>
        <button
          onClick={() => setUiVisible(true)}
          className="bg-[#090A0C] px-3 py-1.5 md:px-4 md:py-2 text-infil font-mono text-[10px] lg:text-xs tracking-[0.2em] uppercase border border-infil hover:bg-infil hover:text-[#090A0C] transition-colors shadow-infil magi-glow"
        >
          [ ENABLE HUD ]
        </button>
      </div>

      <section className={`transition-all duration-1000 ease-in-out h-[40vh] md:h-[50vh] xl:h-full xl:col-span-8 flex flex-col pointer-events-none relative shrink-0 min-h-0`}>
        <div className={`xl:absolute xl:inset-0 flex-1 w-full h-full relative min-h-0 min-w-0 pointer-events-auto transition-colors duration-1000 ease-in-out border ${uiVisible ? 'border-infil' : 'border-transparent'}`}>
          <div className="absolute inset-0">
            <Canvas><ambientLight intensity={1.0} /><OrthographicCamera makeDefault position={[0, 0, 5]} zoom={80} /><TopologyGrid /></Canvas>
          </div>
          <div className={`absolute top-2 left-2 lg:top-4 lg:left-4 pointer-events-none transition-all duration-1000 ease-in-out ${uiVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}><div className="bg-[#090A0C] px-2 py-1 text-infil font-mono text-[10px] lg:text-xs tracking-[0.2em] uppercase border border-infil">[ SCANNING TOPOLOGY... ]</div></div>
        </div>
      </section>

      <section id="telemetry-sidebar" className="w-full xl:col-span-4 flex flex-col flex-1 xl:h-full min-h-0 relative pointer-events-none">

        <div onScroll={handleSidebarScroll} className={`flex flex-col gap-2 md:gap-3 xl:justify-between transition-all duration-1000 ease-in-out pointer-events-auto w-full h-full min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar pb-2 xl:pb-0 ${uiVisible ? 'translate-y-0' : 'pointer-events-none translate-y-4'} ${sidebarScrollbarVisible ? 'scrollbar-visible' : ''}`}>

          <TerminalPanel title="OPERATIVE DATA" flexClass={`shrink-0 transition-all duration-700 ease-in-out ${uiVisible ? 'delay-0 opacity-100 translate-x-0' : 'delay-[400ms] opacity-0 translate-x-8'}`}>
            <span>Giancarlo Renzi // Alias: Raido.<br />Multidisciplinary Designer.</span>
          </TerminalPanel>

          <TerminalPanel title="BIO" flexClass={`flex flex-col shrink-0 transition-all duration-700 ease-in-out ${uiVisible ? 'delay-75 opacity-100 translate-x-0' : 'delay-300 opacity-0 translate-x-8'}`}>
            <div className="flex flex-col gap-3 tracking-normal">
              <p>I am a Costarrican Multidisciplinary Designer with over a decade of experience, holding Bachelor's and Master's degrees in Industrial Design.</p>
              <p>My expertise centers on branding, developed through hands-on practice, continuous education, and dedicated research. My skill set spans graphic design, 3D modeling & product visualization, motion design, sound design, music production, signage, interior implementations, and video editing.</p>
              <p>I have collaborated with boutique studios and international clients. Since 2023 I have worked full-time freelance and currently serve as Art Director for OHM, Albany's electronic music and digital arts non-profit, where I lead branding and creative direction. Based in Albany, New York.</p>
            </div>
          </TerminalPanel>

          <TerminalPanel title="NETWORK LINKS" flexClass={`shrink-0 transition-all duration-700 ease-in-out ${uiVisible ? 'delay-150 opacity-100 translate-x-0' : 'delay-200 opacity-0 translate-x-8'}`}>
            <div className="flex flex-row flex-wrap items-center gap-x-3 gap-y-2 text-[14px] md:text-[15px]">
              <a href="https://www.instagram.com/designbyraido/" target="_blank" rel="noreferrer" className="hover:text-[#090A0C] hover:bg-infil transition-colors py-0.5">Instagram</a>
              <span className="w-[1px] h-3 bg-infil opacity-40 shrink-0"></span>
              <a href="https://www.artstation.com/raidosounds" target="_blank" rel="noreferrer" className="hover:text-[#090A0C] hover:bg-infil transition-colors py-0.5">3D Projects</a>
              <span className="w-[1px] h-3 bg-infil opacity-40 shrink-0"></span>
              <a href="https://raidosounds.bandcamp.com/" target="_blank" rel="noreferrer" className="hover:text-[#090A0C] hover:bg-infil transition-colors py-0.5">Music</a>
            </div>
          </TerminalPanel>

          <div className={`flex flex-col sm:flex-row gap-2 w-full shrink-0 mb-0.5 pointer-events-auto transition-all duration-700 ease-in-out ${uiVisible ? 'delay-200 opacity-100 translate-x-0' : 'delay-150 opacity-0 translate-x-8'}`}>
            <a href="/Raido_CV.pdf" target="_blank" rel="noreferrer" className="flex-1 group block focus:outline-none w-full">
              <div className="bg-infil p-[1px] transition-transform duration-100 group-hover:scale-[0.99] h-full" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
                <div className="bg-[#090A0C] py-2.5 md:py-3 px-2 flex items-center justify-center hover:bg-infil transition-colors duration-100 h-full" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
                  <span className="font-mono text-xs md:text-[14px] text-infil hover:text-[#090A0C] font-bold tracking-widest uppercase truncate whitespace-nowrap">[ VIEW CV ]</span>
                </div>
              </div>
            </a>

            <Link to="/archive" className="flex-1 group block focus:outline-none w-full">
              <div className="bg-breach p-[1px] transition-transform duration-100 group-hover:scale-[0.99] h-full" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
                <div className="bg-[#090A0C] py-2.5 md:py-3 px-2 flex items-center justify-center hover:bg-breach transition-colors duration-100 h-full" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
                  <span className="font-mono text-xs md:text-[14px] text-breach hover:text-[#090A0C] font-bold tracking-widest uppercase truncate whitespace-nowrap">[ PROJECTS ]</span>
                </div>
              </div>
            </Link>
          </div>

          <TerminalPanel
            title="EXTERNAL INGESTION"
            flexClass={`flex flex-col w-full shrink-0 h-80 xl:h-auto xl:flex-1 xl:min-h-[320px] transition-all duration-700 ease-in-out ${uiVisible ? 'delay-300 opacity-100 translate-x-0' : 'delay-75 opacity-0 translate-x-8'}`}
          >
            <div className="uppercase w-full flex flex-col flex-1 min-h-0">
              <DataIngestion uiVisible={uiVisible} />
            </div>
          </TerminalPanel>

          <button
            onClick={() => { setUiVisible(false); setHasManuallyDisabled(true); }}
            className={`w-full shrink-0 border border-infil p-1.5 md:p-2 text-xs font-mono tracking-widest transition-all duration-700 ease-in-out bg-[#090A0C] focus:outline-none hud-btn ${uiVisible ? 'delay-[400ms] opacity-100 translate-x-0' : 'delay-0 opacity-0 translate-x-8'}`}
          >
            [ DISABLE HUD OVERLAY ]
          </button>

        </div>

        {/* MOBILE SCROLL INDICATOR */}
        <div className={`xl:hidden absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#090A0C] via-[#090A0C]/90 to-transparent pointer-events-none flex items-end justify-center pb-3 transition-all duration-700 ease-in-out ${hasScrolled ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'} ${uiVisible ? '' : 'opacity-0'}`}>
          <div className="text-infil font-mono text-[10px] tracking-[0.2em] uppercase animate-pulse opacity-80">
            [ SCROLL DOWN \/ ]
          </div>
        </div>

      </section>

    </div>
  )
}

function ArchiveHUD() {
  const { theme, activeArchiveIndex, expandedProject } = useMagiStore()

  const numProjects = PROJECTS_DATA.length;
  const radius = 36;
  const center = 48;

  return (
    <div className={`absolute top-20 md:top-8 left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-opacity duration-700 ease-in-out ${expandedProject !== null ? 'opacity-0' : 'opacity-100'}`}>
      <svg width="96" height="96" viewBox="0 0 96 96" className="overflow-visible">
        {/* Central solid circle */}
        <circle cx={center} cy={center} r={18} fill={theme.breach} />

        {/* Ring of small circles */}
        {PROJECTS_DATA.map((_, i) => {
          const angle = -Math.PI / 2 + (i / numProjects) * Math.PI * 2;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          const isActive = i === activeArchiveIndex;

          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={isActive ? 6 : 4.5}
              fill={isActive ? theme.breach : 'transparent'}
              stroke={theme.breach}
              strokeWidth={1.5}
              className="transition-all duration-300 ease-out"
            />
          );
        })}
      </svg>
    </div>
  )
}

function Archive() {
  const { expandedProject, setExpandedProject, setTheme } = useMagiStore()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleReturn = () => {
    const state = useMagiStore.getState()
    if (state.lightboxMedia !== null) {
      state.setLightboxMedia(null)
    } else if (expandedProject !== null) {
      setExpandedProject(null)
    } else {
      navigate('/')
    }
  }

  // FIX: Robust cleanup that kills the weird shadow-border glitch
  // If you navigate away while a project is open, forcefully reset the state and theme globally.
  useEffect(() => {
    return () => {
      const state = useMagiStore.getState();
      if (state.expandedProject !== null) {
        state.setExpandedProject(null);
      }
      if (state.lightboxMedia !== null) {
        state.setLightboxMedia(null);
      }
      // Guarantee stock theme restores
      state.setTheme({ infil: '#FFB000', infilAlt: '#42ea96', breach: '#FF3333' });
    }
  }, [])

  return (
    <section
      onPointerEnter={() => document.body.classList.add('hovering-ui')}
      onPointerLeave={() => document.body.classList.remove('hovering-ui')}
      className="flex-1 w-full h-full flex flex-col min-h-0 border border-breach relative shadow-breach pointer-events-auto"
    >
      <div className="flex-1 bg-[#090A0C] relative overflow-hidden flex items-center justify-center min-h-0" style={{ touchAction: 'none' }}>

        <ArchiveHUD />

        <Canvas camera={{ position: [0, 0, 5], fov: isMobile ? 42 : 60 }}>
          <ambientLight intensity={1.0} />
          <Suspense fallback={null}>
            <ArchiveCylinder />
          </Suspense>
        </Canvas>

        <ProjectExpandedView expandedProjectIndex={expandedProject} />

        <div className="absolute top-2 left-2 lg:top-4 lg:left-4 pointer-events-none z-30 flex flex-col items-start">
          <div className="bg-[#090A0C] px-2 py-1 text-breach font-mono text-[10px] lg:text-xs tracking-[0.2em] uppercase border border-breach">
            [ ARCHIVE ACCESS ]
          </div>
        </div>

        <div className="absolute top-2 right-2 lg:top-4 lg:right-4 pointer-events-none z-30 flex flex-col items-end">
          <button onClick={handleReturn} className="bg-[#090A0C] px-2 py-1 text-breach font-mono text-[10px] lg:text-xs tracking-[0.2em] uppercase border border-breach hover:bg-breach hover:text-[#090A0C] transition-colors duration-300 pointer-events-auto">
            [ RETURN ]
          </button>
        </div>

        <div className={`absolute bottom-4 right-4 text-breach font-mono text-[9px] md:text-[10px] pointer-events-none z-10 flex flex-col items-end transition-opacity duration-500 ${expandedProject !== null ? 'opacity-0' : 'opacity-100'}`}>
          <span>SECTOR 22GR</span>
          <span className="animate-crt-flicker opacity-80">[ DRAG OR SCROLL ]</span>
        </div>

        <div className={`absolute top-1/2 left-2 md:left-4 -translate-y-1/2 text-breach font-mono text-4xl md:text-2xl font-black pointer-events-none transition-opacity duration-500 ${expandedProject !== null ? 'opacity-0' : 'opacity-30'}`}>{'<'}</div>
        <div className={`absolute top-1/2 right-2 md:right-4 -translate-y-1/2 text-breach font-mono text-4xl md:text-2xl font-black pointer-events-none transition-opacity duration-500 ${expandedProject !== null ? 'opacity-0' : 'opacity-30'}`}>{'>'}</div>
      </div>
    </section>
  )
}

function AnimatedRoutes({ uiVisible, setUiVisible }) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionState, setTransitionState] = useState('in');

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setTransitionState('out');
      const t1 = setTimeout(() => {
        setDisplayLocation(location);
        const t2 = setTimeout(() => {
          setTransitionState('in');
        }, 50);
        return () => clearTimeout(t2);
      }, 700);
      return () => clearTimeout(t1);
    }
  }, [location.pathname, displayLocation.pathname]);

  return (
    // FIX: Removed the vertical translate/scale logic here to completely kill the "snapping" page transitions
    <div className={`w-full h-full flex flex-col min-h-0 transition-opacity duration-700 ease-in-out pointer-events-none ${transitionState === 'in' ? 'opacity-100' : 'opacity-0'}`}>
      <Routes location={displayLocation}>
        <Route path="/" element={<Home uiVisible={uiVisible} setUiVisible={setUiVisible} />} />
        <Route path="/archive" element={<Archive />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const [uiVisible, setUiVisible] = useState(false);
  const { theme } = useMagiStore();
  const activeTheme = { infil: theme?.infil || '#FFB000', infilAlt: theme?.infilAlt || '#42ea96', breach: theme?.breach || '#FF3333' };

  useEffect(() => {
    const timer = setTimeout(() => setUiVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const mainScrollRef = useRef(null);

  useEffect(() => {
    if (!uiVisible && mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [uiVisible]);

  return (
    <Router>
      <div className="relative w-full h-[100dvh] md:h-screen overflow-hidden bg-[#090A0C]" style={{ '--theme-infil': activeTheme.infil, '--theme-infil-alt': activeTheme.infilAlt, '--theme-breach': activeTheme.breach }}>

        <div className="absolute inset-0 z-0">
          <Canvas><OrthographicCamera makeDefault position={[0, 0, 10]} zoom={40} near={-1000} far={1000} /><BackgroundRadar /></Canvas>
          <div className="absolute inset-0 scanlines opacity-30 pointer-events-none"></div>
          <BackgroundFadeOverlay />
        </div>

        <div className="absolute inset-0 p-3 md:p-5 lg:p-6 flex flex-col pointer-events-none z-10">
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=Orbitron:wght@900&display=swap');

            .magi-glow { filter: url(#magi-glow); }
            .text-infil, .hover\\:text-infil:hover { color: var(--theme-infil) !important; text-shadow: 0 0 4px var(--theme-infil) !important; }
            .border-infil, .hover\\:border-infil:hover { border-color: var(--theme-infil) !important; }
            .bg-infil, .hover\\:bg-infil:hover { background-color: var(--theme-infil) !important; }
            .shadow-infil { box-shadow: 0 0 4px var(--theme-infil) !important; }
            .shadow-infil-tight { box-shadow: 0 0 2px var(--theme-infil) !important; }
            .text-breach, .hover\\:text-breach:hover { color: var(--theme-breach) !important; text-shadow: 0 0 4px var(--theme-breach) !important; }
            .border-breach, .hover\\:border-breach:hover { border-color: var(--theme-breach) !important; }
            .bg-breach, .hover\\:bg-breach:hover { background-color: var(--theme-breach) !important; }
            .shadow-breach { box-shadow: 4px 4px 0px var(--theme-breach) !important; }
            @keyframes crt-flicker { 0% { opacity: 0.95; } 5% { opacity: 0.85; } 10% { opacity: 0.95; } 15% { opacity: 1; } 100% { opacity: 1; } }
            .animate-crt-flicker { animation: crt-flicker 0.15s infinite; }
            @keyframes hud-fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
            .animate-hud-fade { animation: hud-fade-in 4.0s ease-out forwards; }
            .scanlines { background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.3)); background-size: 100% 4px; }
            
            .custom-scrollbar {
              scrollbar-width: thin;
              scrollbar-color: transparent rgba(0, 0, 0, 0.3);
              transition: scrollbar-color 0.5s ease-in-out;
            }
            .custom-scrollbar.scrollbar-visible {
              scrollbar-color: var(--theme-infil) rgba(0, 0, 0, 0.3);
            }
            .custom-scrollbar::-webkit-scrollbar {
              width: 8px;
              height: 8px;
              -webkit-appearance: none;
              appearance: none;
              display: block;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: rgba(0, 0, 0, 0.3);
              border-radius: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: transparent;
              border-radius: 4px;
              border: 1px solid transparent;
              transition: background-color 0.5s ease-in-out, border-color 0.5s ease-in-out;
            }
            .custom-scrollbar.scrollbar-visible::-webkit-scrollbar-thumb {
              background: var(--theme-infil);
              border: 1px solid #090A0C;
            }
            .custom-scrollbar.scrollbar-visible::-webkit-scrollbar-thumb:hover {
              background: var(--theme-infil-alt);
            }

            .font-sans, .font-mono, p, span, a, div { font-family: 'IBM Plex Mono', monospace !important; }
            h2.font-mono { font-family: 'IBM Plex Mono', monospace !important; font-weight: 700; }
            .font-orbitron { font-family: 'Orbitron', sans-serif !important; }

            .data-ingest-wrapper * { white-space: nowrap !important; }
            .hud-btn { color: var(--theme-infil); text-shadow: 0 0 4px var(--theme-infil); }
            .hud-btn:hover, .hud-btn:active { background-color: var(--theme-infil) !important; color: #090A0C !important; text-shadow: none !important; }
          `}</style>

          <div className={`flex-1 relative flex flex-col text-[#E0E0E0] transition-colors duration-1000 ease-in-out border min-h-0 min-w-0 ${uiVisible ? 'border-infil magi-glow' : 'border-transparent'}`}>

            <div className={`absolute inset-0 pointer-events-none transition-all duration-1000 ease-in-out z-[60] ${uiVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
              <svg style={{ position: 'absolute', width: 0, height: 0 }}><filter id="magi-glow" x="-20%" y="-30%" width="140%" height="160%"><feColorMatrix type="matrix" values="1 0 0 0 -0.05 0 1 0 0 -0.05 0 0 1 0 -0.05 0 0 0 1 0" in="SourceGraphic" result="extracted" /><feGaussianBlur in="extracted" stdDeviation="0.6" result="tightGlow" /><feComponentTransfer in="tightGlow" result="clinicalFalloff"><feFuncA type="gamma" exponent="3" amplitude="2" /></feComponentTransfer><feBlend mode="screen" in="clinicalFalloff" in2="SourceGraphic" /></filter></svg>

              <Reticle className="absolute top-1 left-1 w-2 h-2 md:top-[7px] md:left-[7px] md:w-[10px] md:h-[10px] lg:top-2.5 lg:left-2.5 lg:w-3 lg:h-3 text-infil opacity-90" />
              <Reticle className="absolute top-1 right-1 w-2 h-2 md:top-[7px] md:right-[7px] md:w-[10px] md:h-[10px] lg:top-2.5 lg:right-2.5 lg:w-3 lg:h-3 text-infil opacity-90" />
              <Reticle className="absolute bottom-1 left-1 w-2 h-2 md:bottom-[7px] md:left-[7px] md:w-[10px] md:h-[10px] lg:bottom-2.5 lg:left-2.5 lg:w-3 lg:h-3 text-infil opacity-90" />
              <Reticle className="absolute bottom-1 right-1 w-2 h-2 md:bottom-[7px] md:right-[7px] md:w-[10px] md:h-[10px] lg:bottom-2.5 lg:right-2.5 lg:w-3 lg:h-3 text-infil opacity-90" />
            </div>

            <div ref={mainScrollRef} className="absolute inset-0 flex flex-col gap-2 overflow-hidden pointer-events-none p-3 md:p-5 lg:p-6">

              <div className={`transition-all duration-1000 ease-in-out pointer-events-auto shrink-0 flex flex-col gap-2 ${uiVisible ? 'opacity-100 translate-y-0' : 'opacity-0 !pointer-events-none -translate-y-4'}`}>

                <div className="animate-crt-flicker bg-[#090A0C] border border-infil w-full flex justify-between shrink-0">
                  <div className="py-2 px-3 md:py-3 md:px-4 flex flex-col justify-center gap-1 md:gap-1.5 w-full lg:w-max min-w-0">
                    <h1 className="font-orbitron font-black text-[19.5px] min-[360px]:text-[22.5px] sm:text-[29.5px] md:text-[32px] text-[#E0E0E0] leading-none m-0 tracking-[0.14em] sm:tracking-[0.18em] truncate">
                      DESIGN BY RAIDO
                    </h1>
                    <Navigation />
                  </div>

                  <div className="w-14 sm:w-16 md:w-24 shrink-0 border-l border-infil flex items-center justify-center p-2 md:p-3">
                    <RaidoLogo className="w-full h-full text-infil drop-shadow-[0_0_4px_var(--theme-infil)]" />
                  </div>
                </div>

                <DataTicker />
              </div>

              <main className="w-full flex-1 flex flex-col min-h-0 bg-transparent pointer-events-none">
                <AnimatedRoutes uiVisible={uiVisible} setUiVisible={setUiVisible} />
              </main>
            </div>
          </div>
        </div>
      </div>
    </Router>
  )
}