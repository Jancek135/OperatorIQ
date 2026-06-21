import type { Machine, Snapshot } from '@/lib/types'
import { sparklineData } from '@/lib/calculations'

interface SparklineProps {
  machine: Machine
  snapshots: Snapshot[]
}

export default function Sparkline({ machine, snapshots }: SparklineProps) {
  const d = sparklineData(machine, snapshots)
  if (!d.hasData) return null

  return (
    <svg
      viewBox="0 0 54 20"
      width="54"
      height="20"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <polyline
        points={d.points}
        fill="none"
        stroke={d.color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.75}
      />
      <circle
        cx={d.dotCx}
        cy={d.dotCy}
        r="2.5"
        fill={d.color}
      />
    </svg>
  )
}
