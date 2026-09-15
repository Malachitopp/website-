import sceneJson from './assets/studio-scene.json'

// Where the studio renders were taken from, written by tools/studio-render/render.mjs next to
// the images: every camera (frame by frame for the walks) and the points in the scene the
// page pins its live overlays to. All in metres: x across the hall, y up, z down the hall.
export type Vec3 = [number, number, number]

// A camera as the renderer's shader uses it: the ray through a pixel runs along
// fwd + x·right + y·up, where y goes from -tanY to tanY across the height of the frame.
export type Camera = { pos: Vec3; right: Vec3; up: Vec3; fwd: Vec3; tanY: number }

export type Framing = {
  size: [number, number] // the rendered frame, px
  overview: Camera
  music: Camera
  walk: Camera[] // one per frame of the walk-in video (the walk out plays them backwards)
}

export type Scene = {
  loopSeconds: number
  walk: { seconds: number; fps: number }
  anchors: {
    musicBoard: [Vec3, Vec3, Vec3, Vec3] // the music board's slate: top left, top right, bottom right, bottom left
    record: Vec3 // the middle of the top of the record
    albumCover: [Vec3, Vec3, Vec3, Vec3] // a sleeve leaning on the box's right side, same corner order
    albumShadow: [Vec3, Vec3, Vec3, Vec3] // the floor under it, from the box's side outwards
    candle: Vec3 // the middle of the candle's flame
    musicCorner: Vec3[] // corners of everything in the music corner
  }
  // The candle's light as the renderer does it, so the page can light its own things the same way
  candle: {
    flicker: [number, number, number][] // its strength over time: 1 + Σ amplitude · sin(2π · cycles · t / loop + phase)
    strength: number
    soft: number // m, softens the fall-off close to it
    rgb: [number, number, number]
    jar: { rim: number; radius: number; light: [number, number] } // the rim's height and radius, and the heights the light comes from (m)
  }
  landscape: Framing
  portrait: Framing
}

export const scene = sceneJson as unknown as Scene

// A camera looking at a screen: the rendered frame covers the viewport the way
// object-fit: cover does, centred.
export type Lens = { camera: Camera; size: [number, number]; width: number; height: number }

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const along = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]

// A point on a quad ([top left, top right, bottom right, bottom left]) at fractions u across and
// v down, and the way its front faces
export function quadPoint([tl, tr, , bl]: Vec3[], u: number, v: number): Vec3 {
  return [0, 1, 2].map((i) => tl[i] + (tr[i] - tl[i]) * u + (bl[i] - tl[i]) * v) as Vec3
}
export function quadNormal([tl, tr, , bl]: Vec3[]): Vec3 {
  const n = cross(sub(tr, tl), sub(bl, tl))
  const length = Math.hypot(...n)
  return [n[0] / length, n[1] / length, n[2] / length]
}

// How strong the candle's light is t seconds into the scene's time (the renderer's time: 0 is the
// overview's still)
export function candleFlicker(t: number) {
  return scene.candle.flicker.reduce((sum, [amp, cycles, phase]) => sum + amp * Math.sin((2 * Math.PI * cycles * t) / scene.loopSeconds + phase), 1)
}

// How much of the light falling on a point (facing along normal) is the candle's, from 0 to 1:
// its light worked out as the renderer's shader does (candleLight), against the tubes' light on
// a surface standing up in the hall (TUBE_LIGHT, in the same units: the tubes straight onto the
// music board's face come to 0.18, integrated as directLight does, and about as much again
// bounces off the floor and walls). Low down, the jar's rim hides part of the flame, as it does
// in the render.
const TUBE_LIGHT = 0.45
export function candleWarmth(point: Vec3, normal: Vec3) {
  const { strength, soft, jar } = scene.candle
  const flame = scene.anchors.candle
  const v = sub(flame, point)
  const d2 = dot(v, v)
  const cos = Math.max(0, dot(normal, v) / Math.sqrt(d2))
  // the lowest part of the flame this point sees over the rim nearest it
  const across = Math.hypot(v[0], v[2])
  const k = Math.min(0.99, jar.radius / across)
  const lowest = (jar.rim - point[1] * k) / (1 - k)
  const seen = Math.min(1, Math.max(0, (jar.light[1] - lowest) / (jar.light[1] - jar.light[0])))
  const light = (strength * cos * seen) / ((d2 + soft * soft) * Math.PI)
  return light / (light + TUBE_LIGHT)
}

// Screen pixels per unit of x/z or y/z in camera space
function focal({ camera, size: [w, h], width, height }: Lens) {
  return (Math.max(width / w, height / h) * h) / (2 * camera.tanY)
}

// Where a point in the scene lands on screen (CSS px from the top left), how far in front
// of the camera it is, and how many px a metre spans at that distance.
export function project(lens: Lens, point: Vec3) {
  const { camera, width, height } = lens
  const v = sub(point, camera.pos)
  const z = dot(v, camera.fwd)
  const k = focal(lens)
  return { x: width / 2 + (k * dot(v, camera.right)) / z, y: height / 2 - (k * dot(v, camera.up)) / z, z, pxPerMetre: k / z }
}

// The CSS transform (with transform-origin 0 0, on an element at the viewport's top left)
// that lays an element of width × height px onto a quad in the scene given as
// [top left, top right, bottom right, bottom left], in perspective. A point (u, v) of the
// element sits at tl + u·(tr - tl)/width + v·(bl - tl)/height in the scene; seen through
// the lens its screen position is a projective (matrix3d) function of u and v.
export function planeTransform(lens: Lens, [tl, tr, , bl]: Vec3[], width: number, height: number) {
  const { camera, width: vw, height: vh } = lens
  const k = focal(lens)
  const column = (d: Vec3) => {
    const z = dot(d, camera.fwd)
    return [(vw / 2) * z + k * dot(d, camera.right), (vh / 2) * z - k * dot(d, camera.up), z]
  }
  const scale = (d: Vec3, s: number): Vec3 => [d[0] * s, d[1] * s, d[2] * s]
  const [xu, yu, wu] = column(scale(sub(tr, tl), 1 / width))
  const [xv, yv, wv] = column(scale(sub(bl, tl), 1 / height))
  const [x1, y1, w1] = column(sub(tl, camera.pos))
  const m = [xu, yu, 0, wu, xv, yv, 0, wv, 0, 0, w1, 0, x1, y1, 0, w1].map((n) => n / w1)
  return `matrix3d(${m.join(',')})`
}

// The part of a quad (as for planeTransform, width × height px) that is on screen with a
// margin to spare, as a rectangle in the element's px. Found by sampling a grid over the
// quad, which is plenty for a board seen more or less face on.
export function visiblePart(lens: Lens, [tl, tr, br, bl]: Vec3[], width: number, height: number, margin: number) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  const steps = 48
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps / 2; j++) {
      const u = i / steps, v = j / (steps / 2)
      const p = project(lens, along(along(tl, tr, u), along(bl, br, u), v))
      if (p.z > 0 && p.x >= margin && p.x <= lens.width - margin && p.y >= margin && p.y <= lens.height - margin) {
        left = Math.min(left, u * width)
        right = Math.max(right, u * width)
        top = Math.min(top, v * height)
        bottom = Math.max(bottom, v * height)
      }
    }
  }
  return left < right ? { left, top, width: right - left, height: bottom - top } : { left: 0, top: 0, width, height }
}
