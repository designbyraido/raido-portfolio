import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useMagiStore } from './store'
import { PROJECTS_DATA } from './projectsData'

export function ArchiveCylinder() {
    const { theme, expandedProject, setExpandedProject } = useMagiStore()
    const activeTheme = { infil: theme?.infil || '#FFB000', breach: theme?.breach || '#FF3333' }

    // FIX: Dynamically count the projects array so it scales perfectly when you add new projects
    const numItems = PROJECTS_DATA.length
    const radius = 19.2
    const cardWidth = 7.8
    const cardHeight = 5.4
    const snapAngle = (Math.PI * 2) / numItems

    const cylinderRotation = useRef(0)
    const targetRotation = useRef(0)
    const velocity = useRef(0)
    const isDragging = useRef(false)
    const previousX = useRef(0)

    const handlePointerDown = (e) => {
        if (expandedProject !== null) return
        e.stopPropagation()
        e.target.setPointerCapture(e.pointerId)
        isDragging.current = true
        previousX.current = e.clientX
        velocity.current = 0
        document.body.style.cursor = 'grabbing'
    }

    const handlePointerMove = (e) => {
        if (!isDragging.current || expandedProject !== null) return
        e.stopPropagation()
        const deltaX = e.clientX - previousX.current
        velocity.current = -deltaX * 0.002 // INVERTED math for intuitive swiping
        targetRotation.current += velocity.current
        previousX.current = e.clientX
    }

    const handlePointerUp = (e) => {
        if (expandedProject !== null) return
        e.target.releasePointerCapture(e.pointerId)
        isDragging.current = false
        document.body.style.cursor = 'auto'
    }

    const handleWheel = (e) => {
        if (expandedProject !== null) return
        e.stopPropagation()
        targetRotation.current += e.deltaY * 0.0015 // INVERTED math for intuitive scrolling
        velocity.current = 0
    }

    const handleCardClick = (index, isActive) => {
        if (expandedProject === index) {
            setExpandedProject(null)
        } else if (expandedProject === null) {
            if (isActive && Math.abs(velocity.current) < 0.01) {
                setExpandedProject(index)
            } else {
                const target = index * snapAngle // INVERTED target angle
                const diff = targetRotation.current - target
                const wraps = Math.round(diff / (Math.PI * 2))
                targetRotation.current = target + wraps * Math.PI * 2
                velocity.current = 0
            }
        }
    }

    useFrame((state, delta) => {
        if (expandedProject === null) {
            if (!isDragging.current) {
                velocity.current *= 0.92
                targetRotation.current += velocity.current

                if (Math.abs(velocity.current) < 0.002) {
                    const nearest = Math.round(targetRotation.current / snapAngle) * snapAngle
                    targetRotation.current += (nearest - targetRotation.current) * 4.0 * delta
                }
            }
        }
        cylinderRotation.current += (targetRotation.current - cylinderRotation.current) * 8.0 * delta

        // Calculate and update global active index for the HUD
        const newActiveIndex = ((Math.round(cylinderRotation.current / snapAngle) % numItems) + numItems) % numItems;
        if (useMagiStore.getState().activeArchiveIndex !== newActiveIndex) {
            useMagiStore.setState({ activeArchiveIndex: newActiveIndex });
        }
    })

    const texturePaths = useMemo(() => PROJECTS_DATA.map(p => {
        if (p.logo) return p.logo;
        const validImage = p.images && p.images.find(img => !img.toLowerCase().endsWith('.mp4'));
        return validImage || '/project_thumb_1_1781201731671.png';
    }), [PROJECTS_DATA])
    const textures = useTexture(texturePaths)

    return (
        <group
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onClick={(e) => {
                if (e.target.name === 'hitbox' && expandedProject !== null) setExpandedProject(null)
            }}
        >
            <mesh name="hitbox" visible={false}>
                <cylinderGeometry args={[radius + 1, radius + 1, cardHeight * 4, 32]} />
                <meshBasicMaterial side={THREE.DoubleSide} />
            </mesh>

            {PROJECTS_DATA.map((project, index) => (
                <ProjectCard
                    key={project.id}
                    index={index}
                    project={project}
                    numItems={numItems}
                    radius={radius}
                    theme={activeTheme}
                    args={[cardWidth, cardHeight]}
                    cylinderRotation={cylinderRotation}
                    onCardClick={handleCardClick}
                    expandedProject={expandedProject}
                    texture={textures[index]}
                />
            ))}
        </group>
    )
}

function ProjectCard({ index, project, numItems, radius, theme, args, cylinderRotation, onCardClick, expandedProject, texture }) {
    const meshRef = useRef()
    const matRef = useRef()

    const baseAngle = Math.PI - (index / numItems) * Math.PI * 2

    const shaderArgs = useMemo(() => {
        const w = texture && texture.image && texture.image.width ? texture.image.width : 1.0
        const h = texture && texture.image && texture.image.height ? texture.image.height : 1.0
        let texAspect = w / h
        if (isNaN(texAspect) || !isFinite(texAspect)) texAspect = 1.0

        const isLogo = project.logo ? 1.0 : 0.0
        const cardAspect = args[0] / args[1]

        const colorArray = [
            parseInt(theme.breach.slice(1, 3), 16) / 255,
            parseInt(theme.breach.slice(3, 5), 16) / 255,
            parseInt(theme.breach.slice(5, 7), 16) / 255
        ]

        return {
            uniforms: {
                uColor: { value: colorArray },
                uActive: { value: 0 },
                uExpanded: { value: 0 },
                uTime: { value: 0 },
                uFade: { value: 1.0 },
                tDiffuse: { value: texture },
                uTextureAspect: { value: texAspect },
                uCardAspect: { value: cardAspect },
                uIsLogo: { value: isLogo }
            },
            vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform vec3 uColor;
        uniform float uActive;
        uniform float uExpanded;
        uniform float uTime;
        uniform float uFade;
        uniform sampler2D tDiffuse;
        uniform float uTextureAspect;
        uniform float uCardAspect;
        uniform float uIsLogo;
        varying vec2 vUv;

        void main() {
          // THE FIX: Mathematically lock the expansion value so it can NEVER glitch past 1.0
          float exp = clamp(uExpanded, 0.0, 1.0);

          float bx = 0.015;
          float by = 0.025;
          float isBorder = step(vUv.x, bx) + step(1.0 - bx, vUv.x) + step(vUv.y, by) + step(1.0 - by, vUv.y);
          isBorder = clamp(isBorder, 0.0, 1.0);

          float grid = step(0.95, fract(vUv.x * 20.0)) + step(0.95, fract(vUv.y * 12.0));
          grid = clamp(grid, 0.0, 1.0) * 0.15;

          vec2 coverUv = vUv;
          vec2 containUv = vUv;

          if (uTextureAspect > uCardAspect) {
              coverUv.x = (vUv.x - 0.5) * (uCardAspect / uTextureAspect) + 0.5;
              containUv.y = (vUv.y - 0.5) * (uTextureAspect / uCardAspect) + 0.5;
          } else {
              coverUv.y = (vUv.y - 0.5) * (uTextureAspect / uCardAspect) + 0.5;
              containUv.x = (vUv.x - 0.5) * (uCardAspect / uTextureAspect) + 0.5;
          }

          float bounds = step(0.0, containUv.x) * step(containUv.x, 1.0) * step(0.0, containUv.y) * step(containUv.y, 1.0);
          vec2 imageUv = mix(coverUv, containUv, uIsLogo);
          vec4 texColor = texture2D(tDiffuse, imageUv);

          float alphaMask = mix(1.0, bounds, uIsLogo);
          float finalAlpha = texColor.a * alphaMask;
          vec3 bg = vec3(0.05, 0.05, 0.05); 
          vec3 blendedTex = mix(bg, texColor.rgb, mix(1.0, finalAlpha, uIsLogo));

          vec3 darkImage = blendedTex * 0.25;
          vec3 brightImage = blendedTex;
          vec3 contentColor = mix(darkImage, brightImage, uActive);

          float scanlines = step(0.5, fract(vUv.y * 60.0 - uTime * 2.0)) * 0.15;
          vec3 activeColor = contentColor + (uColor * grid * max(uActive, 1.0 - exp)) + (uColor * scanlines * max(uActive, 1.0 - exp));

          // THE SMOOTH TRANSITION: No noise, just a buttery dissolve to the dark UI background
          vec3 uiBgColor = vec3(0.035, 0.039, 0.047); 
          
          float dissolveProgress = smoothstep(0.0, 0.65, exp);
          vec3 finalColor = mix(activeColor, uiBgColor, dissolveProgress);
          
          float transitionPulse = smoothstep(0.0, 0.5, exp) * (1.0 - smoothstep(0.5, 1.0, exp));
          finalColor += uColor * transitionPulse * 0.15;

          float borderAlpha = isBorder * (1.0 - smoothstep(0.4, 0.9, exp));
          finalColor = mix(finalColor, uColor, borderAlpha);
          
          float alpha = mix(0.4, 1.0, max(uActive, exp)) * uFade; 

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        }
    }, [theme.breach, index, texture, project.logo, args])

    useFrame((state, delta) => {
        if (!meshRef.current || !matRef.current) return

        const isExpanded = expandedProject === index
        const isSomeoneElseExpanded = expandedProject !== null && expandedProject !== index

        const currentGlobalAngle = baseAngle + cylinderRotation.current
        const targetX = Math.sin(currentGlobalAngle) * radius
        const targetZ = Math.cos(currentGlobalAngle) * radius
        const targetRotY = currentGlobalAngle + Math.PI

        let activeTarget = Math.max(0, 1.0 - Math.abs(targetX) / 6.0)

        const finalTargetPos = new THREE.Vector3(targetX, 0, targetZ)
        const finalTargetRot = new THREE.Euler(0, targetRotY, 0)
        let targetScale = 1.0
        let targetExpandedUniform = 0.0
        let targetFade = 1.0

        if (isExpanded) {
            finalTargetPos.set(0, 0, 3.8)
            finalTargetRot.set(0, 0, 0)
            targetScale = 3.0
            targetExpandedUniform = 1.0
            activeTarget = 1.0
        } else {
            finalTargetPos.y = Math.sin(state.clock.elapsedTime * 2.0 + index) * 0.2 * activeTarget

            if (isSomeoneElseExpanded) {
                finalTargetPos.z -= 4.0
                finalTargetPos.y -= 1.0
                targetScale = 0.8
                activeTarget = 0.0
                targetFade = 0.0
            }
        }

        const lerpSpeed = isExpanded || isSomeoneElseExpanded ? 2.5 * delta : 6.0 * delta

        meshRef.current.position.lerp(finalTargetPos, lerpSpeed)
        meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), lerpSpeed)

        const currentQuat = meshRef.current.quaternion
        const targetQuat = new THREE.Quaternion().setFromEuler(finalTargetRot)
        currentQuat.slerp(targetQuat, lerpSpeed)

        // FIX: Clamp the JS uniforms as well, guaranteeing they never send > 1.0 to the shader
        const factor = 1.0 - Math.exp(-lerpSpeed);
        let nextActive = matRef.current.uniforms.uActive.value + (activeTarget - matRef.current.uniforms.uActive.value) * factor;
        let nextExpanded = matRef.current.uniforms.uExpanded.value + (targetExpandedUniform - matRef.current.uniforms.uExpanded.value) * factor;
        let nextFade = matRef.current.uniforms.uFade.value + (targetFade - matRef.current.uniforms.uFade.value) * factor;

        matRef.current.uniforms.uActive.value = Math.max(0, Math.min(1.0, nextActive));
        matRef.current.uniforms.uExpanded.value = Math.max(0, Math.min(1.0, nextExpanded));
        matRef.current.uniforms.uFade.value = Math.max(0, Math.min(1.0, nextFade));
        matRef.current.uniforms.uTime.value = state.clock.elapsedTime
    })

    return (
        <mesh
            ref={meshRef}
            onClick={(e) => {
                e.stopPropagation()
                const isActive = matRef.current.uniforms.uActive.value > 0.5
                onCardClick(index, isActive)
            }}
        >
            <planeGeometry args={args} />
            <shaderMaterial ref={matRef} args={[shaderArgs]} />

            <Html
                transform
                position={[0, args[1] / 2 + 0.9, 0]}
                style={{
                    transition: 'opacity 0.3s ease-in-out',
                    opacity: expandedProject !== null ? 0 : 1,
                    pointerEvents: 'none',
                    color: theme.breach,
                    textShadow: `0 0 10px ${theme.breach}, 0 0 20px ${theme.breach}, 0 2px 4px rgba(0,0,0,0.8)`
                }}
            >
                <div className="font-orbitron font-black text-sm md:text-base lg:text-lg tracking-[0.2em] whitespace-nowrap text-center">
                    {project.title.toUpperCase()}
                </div>
            </Html>

            <Html
                transform
                position={[-args[0] / 2, -args[1] / 2 - 0.4, 0]}
                style={{
                    width: '0px',
                    height: '0px',
                    transition: 'opacity 0.3s ease-in-out',
                    opacity: expandedProject !== null ? 0 : 1,
                    pointerEvents: 'none',
                    color: theme.breach,
                    textShadow: `0 0 6px ${theme.breach}, 0 1px 3px rgba(0,0,0,0.8)`
                }}
            >
                <div className="flex flex-col items-start gap-1 font-mono text-[15px] min-[360px]:text-[16px] sm:text-[18px] md:text-[15px] lg:text-[14px] uppercase tracking-wider whitespace-nowrap opacity-80">
                    {project.roles.map((role, i) => (
                        <div key={i}>{role}</div>
                    ))}
                </div>
            </Html>
        </mesh>
    )
}