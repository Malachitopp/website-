// The cloud is a union of overlapping puffs. Drawing them twice at shrinking radii
// gives an ink outline around a cream fill.
const PUFFS: [number, number, number][] = [
  [62, 95, 42],
  [100, 55, 44],
  [160, 44, 44],
  [220, 58, 42],
  [252, 105, 40],
  [225, 158, 40],
  [160, 170, 38],
  [95, 162, 40],
  [48, 135, 32],
]

function Puffs({ grow = 0 }: { grow?: number }) {
  return (
    <>
      <ellipse cx="150" cy="108" rx={110 + grow} ry={68 + grow} />
      {PUFFS.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r + grow} />
      ))}
    </>
  )
}

function ThoughtCloud() {
  return (
    <svg className="thought-cloud__svg" viewBox="-10 -10 320 230" aria-hidden="true">
      <g fill="#2b2420">
        <Puffs grow={7} />
      </g>
      <g fill="#fffdf7">
        <Puffs grow={3} />
      </g>
      <text className="thought-cloud__text" x="150" y="112" textAnchor="middle" dominantBaseline="middle">
        click me!
      </text>
    </svg>
  )
}

export default ThoughtCloud
