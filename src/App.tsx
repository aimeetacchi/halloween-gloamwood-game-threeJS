import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, PerspectiveCamera, Sparkles, useAnimations, useGLTF } from '@react-three/drei'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Ghost, Heart, Menu, Moon, Pause, Play, RotateCcw, Sparkles as SparkleIcon, Volume2, VolumeX, Wind, X } from 'lucide-react'

type GhostInfo = { id: string; name: string; kind: string; color: string; accent: string; x: number; z: number; rarity: string }
const ghostRoster: GhostInfo[] = [
  { id: 'boo', name: 'Boo Berry', kind: 'Marshmallow Wisp', color: '#c9f5e9', accent: '#8bdcc8', x: -3.2, z: -1.3, rarity: 'COMMON' },
  { id: 'ember', name: 'Ember', kind: 'Lantern Sprite', color: '#ffbc85', accent: '#f58c5c', x: 3.4, z: -2.4, rarity: 'UNCOMMON' },
  { id: 'moss', name: 'Moss', kind: 'Garden Haunt', color: '#d0e6a1', accent: '#9ebc6a', x: 1.6, z: 2.3, rarity: 'RARE' },
  { id: 'cobweb', name: 'Cobweb', kind: 'Dusty Crypt Wisp', color: '#d9c6f2', accent: '#ad91d4', x: -4.4, z: 2.6, rarity: 'UNCOMMON' },
  { id: 'moonbeam', name: 'Moonbeam', kind: 'Moonlit Spirit', color: '#a9c8ff', accent: '#759ef0', x: 4.35, z: 1.45, rarity: 'RARE' },
]

function CourtyardCamera() {
  const { camera, size } = useThree()
  const portrait = size.width / size.height < 0.75
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    camera.fov = portrait ? 58 : 42
    camera.updateProjectionMatrix()
  }, [camera, portrait])
  return <PerspectiveCamera makeDefault position={[10, 14, 12]} fov={42} near={0.1} far={100} onUpdate={(view) => view.lookAt(0, 0, 0)} />
}

function Ghostling({ data, caught, player, onApproach, onCatch }: { data: GhostInfo; caught: boolean; player: [number, number]; onApproach: (id: string, near: boolean) => void; onCatch: (id: string) => void }) {
  const group = useRef<THREE.Group>(null)
  const sheetGhost = useGLTF('/models/nikkimorin-ghost.glb')
  const batGhost = useGLTF('/models/quaternius-ghost.glb')
  const useBatGhost = data.id === 'ember'
  const source = useBatGhost ? batGhost : sheetGhost
  const model = useMemo(() => {
    const root = clone(source.scene)
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.material = Array.isArray(object.material) ? object.material.map(material => material.clone()) : object.material.clone()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        if ('color' in material) (material as THREE.MeshStandardMaterial).color.set(data.color)
        if ('emissive' in material) {
          (material as THREE.MeshStandardMaterial).emissive.set(data.color)
          ;(material as THREE.MeshStandardMaterial).emissiveIntensity = 0.16
        }
      })
    })
    return root
  }, [source.scene, data.color])
  const { actions } = useAnimations(source.animations, model)
  const phase = useRef(Math.random() * 5)
  useEffect(() => {
    const flight = actions['CharacterArmature|Flying_Idle'] ?? actions['CharacterArmature|Fast_Flying']
    flight?.reset().play()
    return () => { flight?.stop() }
  }, [actions])
  useEffect(() => { return () => onApproach(data.id, false) }, [data.id, onApproach])
  useEffect(() => {
    const d = Math.hypot(data.x - player[0], data.z - player[1])
    onApproach(data.id, d < 2.05 && !caught)
  }, [data, player, caught, onApproach])
  useFrame(({ clock }) => {
    if (!group.current || caught) return
    const t = clock.elapsedTime + phase.current
    group.current.position.set(data.x + Math.sin(t * 0.55) * 0.42, 0.72 + Math.sin(t * 1.6) * 0.16, data.z + Math.cos(t * 0.45) * 0.3)
    group.current.rotation.y = Math.sin(t * 0.7) * 0.18
  })
  if (caught) return null
  return <group ref={group} onClick={(event) => { event.stopPropagation(); onCatch(data.id) }}><primitive object={model} scale={useBatGhost ? 0.28 : 0.42} /><mesh position={[0, 0.76, 0]}><sphereGeometry args={[0.72, 12, 10]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh><pointLight color={data.color} intensity={0.75} distance={2.7} /></group>
}

function Player({ input, paused, playerRef, onMove, netSwing, resetVersion }: { input: React.MutableRefObject<Set<string>>; paused: boolean; playerRef: React.MutableRefObject<THREE.Group | null>; onMove: (x: number, z: number) => void; netSwing: number; resetVersion: number }) {
  const adventurer = useGLTF('/models/quaternius-adventurer.glb')
  const character = useMemo(() => clone(adventurer.scene), [adventurer.scene])
  const { actions } = useAnimations(adventurer.animations, character)
  const fishingNet = useGLTF('/models/poly-pizza-fishing-net.glb')
  const netModel = useMemo(() => {
    const root = clone(fishingNet.scene)
    root.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(root)
    const size = bounds.getSize(new THREE.Vector3())
    const fitScale = 0.92 / Math.max(size.x, size.y, size.z)
    const handle = root.getObjectByName('Cylinder001')
    const handleBounds = handle ? new THREE.Box3().setFromObject(handle) : bounds
    const handleSize = handleBounds.getSize(new THREE.Vector3())
    const grip = new THREE.Vector3(handleBounds.min.x + handleSize.x / 2, handleBounds.min.y + handleSize.y / 2, handleBounds.max.z)
    root.scale.setScalar(fitScale)
    root.position.copy(grip).multiplyScalar(-fitScale)
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const tinted = materials.map(material => {
        const copy = material.clone()
        if (object.name.startsWith('Sphere001') && 'color' in copy) {
          const standard = copy as THREE.MeshStandardMaterial
          standard.color.set('#c4afd5')
          standard.emissive.set('#6b4e82')
          standard.emissiveIntensity = 0.42
        }
        if (object.name.startsWith('Cylinder001') && 'color' in copy) {
          const standard = copy as THREE.MeshStandardMaterial
          standard.color.set(copy.name === '02___Default' ? '#e28b4b' : '#d2ad75')
          standard.emissive.set(copy.name === '02___Default' ? '#6f3016' : '#493317')
          standard.emissiveIntensity = 0.22
        }
        return copy
      })
      object.material = Array.isArray(object.material) ? tinted : tinted[0]
    })
    return root
  }, [fishingNet.scene])
  const activeAction = useRef<THREE.AnimationAction | null>(null)
  const lastReport = useRef(0)
  const netRef = useRef<THREE.Group>(null)
  const netSwingStart = useRef(0)
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    player.position.set(0, 0, 0)
    player.rotation.set(0, 0, 0)
    player.userData.walking = false
    input.current.clear()
    lastReport.current = 0
  }, [input, playerRef, resetVersion])
  useEffect(() => { if (netSwing > 0) netSwingStart.current = performance.now() }, [netSwing])
  useEffect(() => {
    const idle = actions['CharacterArmature|Idle_Neutral'] ?? actions['CharacterArmature|Idle']
    if (idle) { idle.reset().play(); activeAction.current = idle }
    return () => { Object.values(actions).forEach(action => action?.stop()) }
  }, [actions])
  useFrame((_, delta) => {
    const p = playerRef.current
    if (!p || paused) return
    const keys = input.current
    let dx = Number(keys.has('ArrowRight') || keys.has('d')) - Number(keys.has('ArrowLeft') || keys.has('a'))
    let dz = Number(keys.has('ArrowDown') || keys.has('s')) - Number(keys.has('ArrowUp') || keys.has('w'))
    if (dx || dz) {
      const len = Math.hypot(dx, dz); dx /= len; dz /= len
      p.position.x = THREE.MathUtils.clamp(p.position.x + dx * delta * 3.1, -5.2, 5.2)
      p.position.z = THREE.MathUtils.clamp(p.position.z + dz * delta * 3.1, -3.8, 3.8)
      p.rotation.y = Math.atan2(dx, dz)
      p.userData.walking = true
    } else p.userData.walking = false
    p.position.y = p.userData.walking ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.07 : 0
    const nextAction = p.userData.walking
      ? (actions['CharacterArmature|Walk'] ?? actions['CharacterArmature|Run'])
      : (actions['CharacterArmature|Idle_Neutral'] ?? actions['CharacterArmature|Idle'])
    if (nextAction && activeAction.current !== nextAction) {
      activeAction.current?.fadeOut(0.18)
      nextAction.reset().fadeIn(0.18).play()
      activeAction.current = nextAction
    }
    if (performance.now() - lastReport.current > 100) { lastReport.current = performance.now(); onMove(p.position.x, p.position.z) }
    if (netRef.current) {
      const progress = Math.min(1, (performance.now() - netSwingStart.current) / 560)
      const arc = netSwingStart.current > 0 ? Math.sin(progress * Math.PI) : 0
      netRef.current.rotation.set(arc * 0.32, Math.PI + arc * 1.65, -arc * 1.05)
      netRef.current.position.z = 0.08 + arc * 0.32
    }
  })
  return <group ref={playerRef} position={[0, 0, 0]}>
    <primitive object={character} />
    <group ref={netRef} position={[0.28, 1.08, 0.08]}><primitive object={netModel} /></group>
  </group>
}

function WitchKeeper({ caught, player, onApproach, onCatch }: { caught: boolean; player: [number, number]; onApproach: (id: string, near: boolean) => void; onCatch: (id: string) => void }) {
  const gltf = useGLTF('/models/quaternius-witch.glb')
  const model = useMemo(() => clone(gltf.scene), [gltf.scene])
  const { actions } = useAnimations(gltf.animations, model)
  useEffect(() => {
    const idle = actions['CharacterArmature|Idle'] ?? actions['CharacterArmature|Idle_Neutral']
    idle?.reset().play()
    return () => { idle?.stop() }
  }, [actions])
  useEffect(() => {
    onApproach('witch', !caught && Math.hypot(-2.5 - player[0], 1.3 - player[1]) < 2.05)
  }, [caught, player, onApproach])
  useEffect(() => () => onApproach('witch', false), [onApproach])
  if (caught) return null
  return <group position={[-2.5, 0, 1.3]} rotation={[0, Math.PI * 0.82, 0]} scale={0.82} onClick={(event) => { event.stopPropagation(); onCatch('witch') }}>
    <primitive object={model} />
    <mesh position={[0, 0.9, 0]}><sphereGeometry args={[0.7, 12, 10]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    <pointLight position={[0, 1.1, 0.15]} color="#ffcf93" intensity={0.32} distance={2.4} />
  </group>
}

function Torch({ position }: { position: [number, number, number] }) {
  return <group position={position}>
    <mesh position={[0, 0.65, 0]} castShadow><cylinderGeometry args={[0.055, 0.09, 1.3, 8]} /><meshStandardMaterial color="#553c32" /></mesh>
    <mesh position={[0, 1.35, 0]}><sphereGeometry args={[0.18, 12, 12]} /><meshBasicMaterial color="#ff9d52" /></mesh>
    <pointLight position={[0, 1.4, 0]} color="#ff8b42" intensity={2.5} distance={5} />
  </group>
}

function Pumpkin({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return <group position={position} scale={scale}>
    <mesh castShadow position={[0, 0.25, 0]} scale={[1, 0.82, 0.92]}><sphereGeometry args={[0.42, 16, 12]} /><meshStandardMaterial color="#d87832" roughness={0.8} /></mesh>
    <mesh position={[0, 0.64, 0]} rotation={[0.2, 0, 0.2]}><cylinderGeometry args={[0.045, 0.07, 0.2, 7]} /><meshStandardMaterial color="#60784a" /></mesh>
    <mesh position={[-0.15, 0.36, 0.35]} rotation={[0, 0, 0.3]}><coneGeometry args={[0.06, 0.12, 3]} /><meshBasicMaterial color="#39272c" /></mesh>
    <mesh position={[0.15, 0.36, 0.35]} rotation={[0, 0, -0.3]}><coneGeometry args={[0.06, 0.12, 3]} /><meshBasicMaterial color="#39272c" /></mesh>
    <pointLight position={[0, 0.4, 0.52]} color="#ff9d43" intensity={0.35} distance={1.3} />
  </group>
}

function Grave({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <mesh castShadow position={[0, 0.45, 0]}><boxGeometry args={[0.66, 0.9, 0.16]} /><meshStandardMaterial color="#585364" roughness={1} /></mesh>
    <mesh position={[0, 0.73, 0]}><boxGeometry args={[0.66, 0.35, 0.16]} /><meshStandardMaterial color="#585364" /></mesh>
    <mesh position={[0, 0.52, 0.09]}><boxGeometry args={[0.28, 0.035, 0.02]} /><meshBasicMaterial color="#827c91" /></mesh>
  </group>
}

function CastleScene({ caught, player, input, paused, onMove, onApproach, onCatchSpirit, netSwing, resetVersion }: { caught: string[]; player: [number, number]; input: React.MutableRefObject<Set<string>>; paused: boolean; onMove: (x: number, z: number) => void; onApproach: (id: string, near: boolean) => void; onCatchSpirit: (id: string) => void; netSwing: number; resetVersion: number }) {
  const playerRef = useRef<THREE.Group | null>(null)
  return <>
    <color attach="background" args={['#11101d']} />
    <fog attach="fog" args={['#11101d', 13, 25]} />
    <CourtyardCamera />
    <ambientLight intensity={1.1} color="#c0bad8" />
    <directionalLight position={[-5, 12, 6]} intensity={2.2} color="#d8d0ff" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#161822" roughness={1} /></mesh>
    <mesh position={[0, -0.015, 0]} receiveShadow><boxGeometry args={[13, 0.14, 10]} /><meshStandardMaterial color="#403d4b" roughness={0.95} /></mesh>
    {/* courtyard paving */}
    {Array.from({ length: 7 }, (_, ix) => Array.from({ length: 5 }, (_, iz) => <mesh key={`${ix}-${iz}`} rotation={[-Math.PI / 2, 0, 0]} position={[-5.15 + ix * 1.7, 0.062, -3.95 + iz * 1.7]} receiveShadow><planeGeometry args={[1.62, 1.62]} /><meshStandardMaterial color={(ix + iz) % 3 === 0 ? '#55515e' : '#4a4754'} roughness={1} /></mesh>))}
    {/* far castle keep and towers */}
    <mesh position={[0, 4.05, -5.65]} castShadow><boxGeometry args={[9, 8.1, 1.1]} /><meshStandardMaterial color="#292637" roughness={0.92} /></mesh>
    <mesh position={[0, 8.35, -5.65]} castShadow><boxGeometry args={[9.5, 0.3, 1.35]} /><meshStandardMaterial color="#403a4c" /></mesh>
    {[-4.3, -2.9, -1.5, 0, 1.5, 2.9, 4.3].map((x, i) => <group key={x} position={[x, 8.45 + (i % 2 ? 0.15 : -0.1), -5.65]}><mesh castShadow><boxGeometry args={[0.55, 0.8, 1.2]} /><meshStandardMaterial color="#393549" /></mesh><mesh position={[0, 0.55, 0]}><coneGeometry args={[0.45, 0.75, 4]} /><meshStandardMaterial color="#51465c" /></mesh></group>)}
    {[-3.65, 3.65].map((x) => <group key={x} position={[x, 0, -5.4]}><mesh position={[0, 4, 0]} castShadow><cylinderGeometry args={[1.15, 1.3, 8, 8]} /><meshStandardMaterial color="#353144" /></mesh><mesh position={[0, 8.15, 0]}><coneGeometry args={[1.4, 1.9, 8]} /><meshStandardMaterial color="#51455e" /></mesh><mesh position={[0, 1.6, 0.67]}><boxGeometry args={[0.48, 1.15, 0.08]} /><meshBasicMaterial color="#efaa63" /></mesh></group>)}
    {/* courtyard walls */}
    <mesh position={[-6.35, 1.6, 0]} castShadow><boxGeometry args={[0.3, 3.2, 10]} /><meshStandardMaterial color="#373442" /></mesh>
    <mesh position={[6.35, 1.6, 0]} castShadow><boxGeometry args={[0.3, 3.2, 10]} /><meshStandardMaterial color="#373442" /></mesh>
    {[-4.5, -2.3, 0, 2.3, 4.5].map((z) => <group key={z}><mesh position={[-6.35, 3.35, z]}><boxGeometry args={[0.55, 0.4, 0.55]} /><meshStandardMaterial color="#464252" /></mesh><mesh position={[6.35, 3.35, z]}><boxGeometry args={[0.55, 0.4, 0.55]} /><meshStandardMaterial color="#464252" /></mesh></group>)}
    {/* arched door */}
    <mesh position={[0, 1.05, -5.02]}><boxGeometry args={[2.2, 2.2, 0.1]} /><meshBasicMaterial color="#11101a" /></mesh>
    <mesh position={[0, 2.1, -5.02]}><cylinderGeometry args={[1.1, 1.1, 0.1, 24, 1, false, 0, Math.PI]} /><meshBasicMaterial color="#11101a" /></mesh>
    {[-4.8, 4.8].map((x) => <Torch key={x} position={[x, 0, -3.2]} />)}
    <Torch position={[-5.65, 0, 2.5]} /><Torch position={[5.65, 0, 2.5]} />
    <Pumpkin position={[-4.7, 0, 2.6]} /><Pumpkin position={[4.7, 0, 2.9]} scale={0.8} /><Pumpkin position={[-1.8, 0, -3.6]} scale={0.65} />
    <Grave position={[-4.2, 0, -0.1]} rotation={0.1} /><Grave position={[4.25, 0, -0.1]} rotation={-0.2} /><Grave position={[2.8, 0, 3.3]} rotation={0.15} />
    <mesh position={[0, 0.18, 2.1]}><cylinderGeometry args={[0.85, 0.95, 0.35, 24]} /><meshStandardMaterial color="#353445" /></mesh>
    <mesh position={[0, 0.37, 2.1]}><cylinderGeometry args={[0.62, 0.68, 0.06, 24]} /><meshStandardMaterial color="#5a5264" /></mesh>
    <Player input={input} paused={paused} playerRef={playerRef} onMove={onMove} netSwing={netSwing} resetVersion={resetVersion} />
    <WitchKeeper caught={caught.includes('witch')} player={player} onApproach={onApproach} onCatch={onCatchSpirit} />
    {ghostRoster.map(g => <Ghostling key={g.id} data={g} caught={caught.includes(g.id)} player={player} onApproach={onApproach} onCatch={onCatchSpirit} />)}
    <Sparkles count={70} scale={[12, 6, 12]} size={2} speed={0.25} color="#b3a6dc" opacity={0.48} />
    <ContactShadows position={[0, 0.01, 0]} opacity={0.3} scale={18} blur={2.5} far={8} />
  </>
}

function App() {
  const input = useRef(new Set<string>())
  const [player, setPlayer] = useState<[number, number]>([0, 0])
  const [caught, setCaught] = useState<string[]>([])
  const [lives, setLives] = useState(3)
  const [gameOver, setGameOver] = useState(false)
  const [resetVersion, setResetVersion] = useState(0)
  const collisionCooldown = useRef(new Set<string>())
  const [nearby, setNearby] = useState<string | null>(null)
  const [notice, setNotice] = useState('A little wisp is hiding somewhere nearby…')
  const [paused, setPaused] = useState(true)
  const [sound, setSound] = useState(false)
  const [throwing, setThrowing] = useState(false)
  const [showCollection, setShowCollection] = useState(false)
  const [showHud, setShowHud] = useState(false)
  const [showCongratulations, setShowCongratulations] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)
  const [netSwing, setNetSwing] = useState(0)
  const music = useRef<HTMLAudioElement>(null)
  const handleMove = useCallback((x: number, z: number) => {
    setPlayer([x, z])
    if (paused || gameOver || showCongratulations) return
    const witchDistance = Math.hypot(-2.5 - x, 1.3 - z)
    if (witchDistance < 0.78 && !caught.includes('witch')) {
      setGameOver(true)
      setPaused(true)
      setNotice('The Witch Keeper caught you in her spell!')
      return
    }
    if (witchDistance > 1.05) collisionCooldown.current.delete('witch')
    for (const ghost of ghostRoster) {
      if (caught.includes(ghost.id)) continue
      const distance = Math.hypot(ghost.x - x, ghost.z - z)
      if (distance > 0.85) collisionCooldown.current.delete(ghost.id)
      if (distance < 0.68 && !collisionCooldown.current.has(ghost.id)) {
        collisionCooldown.current.add(ghost.id)
        const remaining = Math.max(0, lives - 1)
        setLives(remaining)
        if (remaining === 0) {
          setGameOver(true)
          setPaused(true)
          setNotice('The spirits drained all your courage. Try again!')
        } else setNotice(`A ghost bumped into you! ${remaining} ${remaining === 1 ? 'life' : 'lives'} left.`)
      }
    }
  }, [caught, gameOver, lives, paused, showCongratulations])
  const markApproach = useCallback((id: string, near: boolean) => { setNearby(current => near ? id : current === id ? null : current) }, [])
  const catchGhost = useCallback((requestedId?: string) => {
    setNetSwing(value => value + 1)
    if (paused || throwing) return
    const selected = requestedId ?? nearby
    const target = selected ? ghostRoster.find(g => g.id === selected && !caught.includes(g.id)) : null
    const targetId = target?.id ?? (selected === 'witch' && !caught.includes('witch') ? 'witch' : null)
    if (!targetId) { setNotice('Too far away! Get a little closer to a ghost.'); return }
    const targetName = target?.name ?? 'the Witch Keeper'
    setThrowing(true)
    setNotice(`Whoosh! Your net is flying toward ${targetName}…`)
    window.setTimeout(() => {
      setCaught(prev => prev.includes(targetId) ? prev : [...prev, targetId])
      setThrowing(false)
      setNotice(targetId === 'witch' ? 'Bonus caught! The Witch Keeper joined your collection! ✨' : `${targetName} joined your ghost collection! ✨`)
    }, 700)
  }, [caught, nearby, paused, throwing])
  const tapSpirit = useCallback((id: string) => {
    if (paused || throwing) return
    const ghost = ghostRoster.find(item => item.id === id)
    const targetX = id === 'witch' ? -2.5 : ghost?.x
    const targetZ = id === 'witch' ? 1.3 : ghost?.z
    if (targetX === undefined || targetZ === undefined) return
    const outOfReach = Math.hypot(targetX - player[0], targetZ - player[1]) > 2.05
    if (outOfReach && !window.matchMedia('(pointer: coarse)').matches) {
      setNotice('Too far away! Move closer, then tap the spirit to catch it.')
      return
    }
    catchGhost(id)
  }, [catchGhost, paused, player, throwing])
  const toggleSound = () => {
    const enabled = !sound
    setSound(enabled)
    if (!music.current) return
    music.current.volume = 0.42
    if (enabled) void music.current.play()
    else music.current.pause()
  }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
      input.current.add(e.key.toLowerCase() === ' ' ? ' ' : e.key.length === 1 ? e.key.toLowerCase() : e.key)
      if (e.key === ' ' && !e.repeat) catchGhost()
      if (e.key.toLowerCase() === 'p' && !e.repeat && !showWelcome && !gameOver && !showCongratulations) setPaused(v => !v)
    }
    const up = (e: KeyboardEvent) => input.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key)
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [catchGhost, gameOver, showCongratulations, showWelcome])
  useEffect(() => {
    if (caught.includes('witch') && ghostRoster.every(g => caught.includes(g.id))) {
      setShowCongratulations(true)
      setPaused(true)
    }
  }, [caught])
  const reset = () => { input.current.clear(); setResetVersion(value => value + 1); setCaught([]); setLives(3); setGameOver(false); collisionCooldown.current.clear(); setNearby(null); setThrowing(false); setNotice('A little wisp is hiding somewhere nearby…'); setPlayer([0, 0]); setPaused(false); setShowCollection(false); setShowCongratulations(false) }
  const startGame = () => {
    input.current.clear()
    setShowWelcome(false)
    setPaused(false)
    if (music.current) {
      music.current.volume = 0.42
      void music.current.play().then(() => setSound(true)).catch(() => setSound(false))
    }
  }
  const ghostsCaught = ghostRoster.filter(g => caught.includes(g.id)).length
  const control = (key: string) => ({ onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); input.current.add(key) }, onPointerUp: () => input.current.delete(key), onPointerLeave: () => input.current.delete(key), onPointerCancel: () => input.current.delete(key) })

  return <main className="game-shell">
    <audio ref={music} src="/audio/silent-spooky-halloween.mp3" loop preload="none" />
    <div className="game-scene"><Canvas shadows dpr={[1, 1.6]} gl={{ antialias: true }}><CastleScene caught={caught} player={player} input={input} paused={paused} onMove={handleMove} onApproach={markApproach} onCatchSpirit={tapSpirit} netSwing={netSwing} resetVersion={resetVersion} /></Canvas><div className="scene-vignette" /><div className="scene-grain" />
      <div className="scene-topline"><span><span className="live-dot" /> LIVE IN GLOAMWOOD</span></div>
    </div>
    <aside className={`hud ${showHud ? 'hud-open' : ''}`}>
      <header className="brand"><div className="brand-mark"><Moon size={21} fill="currentColor" /></div><div><div className="brand-name">GLOAMWOOD</div><div className="brand-sub">THE GHOST KEEPER'S JOURNAL</div></div>{showHud && <button className="journal-close" aria-label="Close journal" title="Close journal" onClick={() => setShowHud(false)}><X size={17} /></button>}</header>
      <div className="location"><div className="eyebrow">LOCATION <span className="location-pin">✦</span></div><h1>Castle<br /><em>Courtyard</em></h1><p>The moon is up. The spirits are restless.</p></div>
      <div className="stat-row"><div className="stat-card"><div className="stat-label"><SparkleIcon size={13} /> GHOSTS FOUND</div><div className="stat-value">{String(ghostsCaught).padStart(2, '0')}<span> / {String(ghostRoster.length).padStart(2, '0')}</span></div><div className="progress"><i style={{ width: `${ghostsCaught / ghostRoster.length * 100}%` }} /></div></div><div className="stat-card"><div className="stat-label"><Heart size={13} /> LIVES LEFT</div><div className="life-hearts" aria-label={`${lives} lives remaining`}>{Array.from({ length: 3 }, (_, i) => <Heart key={i} size={17} fill={i < lives ? 'currentColor' : 'transparent'} className={i < lives ? 'life-heart-active' : 'life-heart-lost'} />)}</div><div className="luck-sub">Witch Keeper: avoid her!</div></div></div>
      <section className="collection-section"><div className="section-heading"><span>YOUR LITTLE HAUNTS</span><button className="text-button" onClick={() => setShowCollection(!showCollection)}>{showCollection ? 'CLOSE' : 'VIEW ALL'} <span>↗</span></button></div>
        {showCollection ? <div className="collection-list">{ghostRoster.map(g => <div className="collection-entry" key={g.id}><span className="ghost-dot" style={{ background: g.color, boxShadow: `0 0 12px ${g.color}` }} /><div><strong>{caught.includes(g.id) ? g.name : '???'}</strong><small>{caught.includes(g.id) ? g.kind : 'Not yet discovered'}</small></div><span className="rarity">{caught.includes(g.id) ? g.rarity : '—'}</span></div>)}<div className="collection-entry"><span className="ghost-dot" style={{ background: '#d7a5ff', boxShadow: '0 0 12px #d7a5ff' }} /><div><strong>{caught.includes('witch') ? 'Witch Keeper' : '???'}</strong><small>{caught.includes('witch') ? 'Bonus capture' : 'Bonus capture — still wandering'}</small></div><span className="rarity">{caught.includes('witch') ? 'BONUS' : '—'}</span></div></div> : <div className="ghost-cards">{ghostRoster.map(g => <div className={`ghost-card ${caught.includes(g.id) ? 'discovered' : ''}`} key={g.id} title={caught.includes(g.id) ? g.kind : 'A ghost to discover'}><div className="ghost-orb" style={{ '--ghost-color': g.color, '--ghost-accent': g.accent } as React.CSSProperties}><Ghost size={23} strokeWidth={1.3} /></div><span>{caught.includes(g.id) ? g.name : '???'}</span></div>)}</div>}
      </section>
      <section className="field-note"><div className="note-icon"><Wind size={17} /></div><div><div className="note-heading">FIELD NOTE <span>№ 014</span></div><p>{notice}</p></div></section>
      <div className="controls"><div className="controls-title">HOW TO PLAY <span>✦</span></div><div className="control-line"><div className="key-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div><span>Wander the courtyard</span></div><div className="control-line"><kbd className="space-key">SPACE</kbd><span>Throw your catching net</span></div><div className="control-line"><kbd>P</kbd><span>Take a little pause</span></div></div>
      <div className="sound-control-row"><span><Volume2 size={14} /> AMBIENT SOUND</span><button className="icon-button sound-button" title={sound ? 'Mute ambient sound' : 'Play ambient sound'} aria-label={sound ? 'Mute ambient sound' : 'Play ambient sound'} onClick={toggleSound}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button></div>
      <footer className="hud-footer"><span>MADE FOR MOONLIT NIGHTS</span></footer>
    </aside>
    {!showHud && <button className="journal-toggle" aria-label="Open journal" title="Open journal" onClick={() => setShowHud(true)}><Menu size={18} /></button>}
    <div className="game-top-actions"><button className="action-icon" title={paused ? 'Resume' : 'Pause'} onClick={() => setPaused(!paused)}>{paused ? <Play size={17} /> : <Pause size={17} />}</button><button className="action-icon" title="Start over" onClick={reset}><RotateCcw size={16} /></button></div>
    <div className="bottom-left"><span className="coord">{Math.round(player[0] * 10) / 10}° W &nbsp; · &nbsp; {Math.round(player[1] * 10) / 10}° N</span></div>
    <div className="move-pad"><button aria-label="Move up" {...control('ArrowUp')}><ArrowUp size={17} /></button><div><button aria-label="Move left" {...control('ArrowLeft')}><ArrowLeft size={17} /></button><button className="pad-center"><span>✦</span></button><button aria-label="Move right" {...control('ArrowRight')}><ArrowRight size={17} /></button></div><button aria-label="Move down" {...control('ArrowDown')}><ArrowDown size={17} /></button></div>
    {paused && !showCongratulations && !gameOver && !showWelcome && <div className="paused-overlay"><div className="pause-card"><Moon size={29} fill="currentColor" /><span>REST YOUR FEET</span><h2>The courtyard<br /><em>can wait.</em></h2><button onClick={() => setPaused(false)}>BACK TO THE NIGHT <Play size={13} fill="currentColor" /></button></div></div>}
    <button className={`net-button ${nearby && !paused ? 'net-ready' : ''} ${throwing ? 'net-throwing' : ''}`} onClick={() => catchGhost()} disabled={paused || throwing}><span className="net-icon">✧</span><span><strong>{throwing ? 'CATCHING…' : nearby === 'witch' ? 'CATCH BONUS' : nearby ? 'CATCH GHOST' : 'THROW YOUR NET'}</strong><small>{nearby === 'witch' ? 'TAP THE WITCH FOR A BONUS' : nearby ? 'TAP A SPIRIT OR THROW YOUR NET' : 'GET CLOSE TO A SPIRIT'}</small></span><kbd>SPACE</kbd></button>
    {showCongratulations && <div className="congrats-overlay"><section className="congrats-card" role="dialog" aria-modal="true" aria-labelledby="congrats-title"><div className="congrats-moon"><Moon size={27} fill="currentColor" /><SparkleIcon size={14} /></div><span className="congrats-eyebrow">GLOAMWOOD FIELD GUIDE COMPLETE</span><h2 id="congrats-title">The night is<br /><em>yours, Keeper.</em></h2><p>You caught every little haunt and found the Witch Keeper bonus. The courtyard is finally at peace.</p><div className="congrats-count"><SparkleIcon size={14} /> {ghostRoster.length + 1} / {ghostRoster.length + 1} HAUNTS COLLECTED</div><div className="congrats-actions"><button className="congrats-primary" onClick={reset}>PLAY AGAIN <RotateCcw size={14} /></button><button className="congrats-secondary" onClick={() => { setShowCongratulations(false); setPaused(false) }}>KEEP EXPLORING</button></div></section></div>}
    {showWelcome && <div className="congrats-overlay welcome-overlay"><section className="congrats-card welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><div className="congrats-moon"><Moon size={27} fill="currentColor" /><SparkleIcon size={14} /></div><span className="congrats-eyebrow">A MOONLIT ADVENTURE</span><h2 id="welcome-title">Welcome to<br /><em>Gloamwood.</em></h2><p>Wander the castle courtyard, catch mischievous ghosts, and watch out for the Witch Keeper.</p><div className="welcome-controls"><span><kbd className="wasd-keys" aria-label="W A S D"><i>W</i><i>A</i><i>S</i><i>D</i></kbd> MOVE</span><span><kbd>SPACE</kbd> CATCH</span></div><div className="congrats-actions"><button className="congrats-primary" onClick={startGame}>PLAY GAME <Play size={14} fill="currentColor" /></button></div></section></div>}
    {gameOver && <div className="congrats-overlay"><section className="congrats-card game-over-card" role="dialog" aria-modal="true" aria-labelledby="game-over-title"><div className="congrats-moon"><Ghost size={27} /><SparkleIcon size={14} /></div><span className="congrats-eyebrow">YOUR COURTYARD ADVENTURE ENDS</span><h2 id="game-over-title">The night<br /><em>claims you.</em></h2><p>{lives === 0 ? 'The ghosts used up all your lives.' : 'The Witch Keeper caught you in her spell.'} Take a breath, then try the courtyard again.</p><div className="congrats-actions"><button className="congrats-primary" onClick={reset}>TRY AGAIN <RotateCcw size={14} /></button></div></section></div>}
  </main>
}

export default App
