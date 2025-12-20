'use client'

import { useState } from 'react'

interface ChartDataPoint {
  month: string
  avgScore: number
  bestScore: number
}

const mockData: ChartDataPoint[] = [
  { month: 'Jan', avgScore: 65, bestScore: 78 },
  { month: 'Feb', avgScore: 72, bestScore: 85 },
  { month: 'Mar', avgScore: 68, bestScore: 82 },
  { month: 'Apr', avgScore: 80, bestScore: 92 },
  { month: 'May', avgScore: 75, bestScore: 88 },
  { month: 'Jun', avgScore: 85, bestScore: 95 },
  { month: 'Jul', avgScore: 82, bestScore: 93 },
  { month: 'Aug', avgScore: 88, bestScore: 96 },
  { month: 'Sep', avgScore: 86, bestScore: 94 },
  { month: 'Oct', avgScore: 92, bestScore: 98 },
  { month: 'Nov', avgScore: 88, bestScore: 96 },
  { month: 'Dec', avgScore: 95, bestScore: 100 },
]

export default function PerformanceChart() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const maxScore = 100
  const chartHeight = 256
  const chartWidth = 800
  const padding = { top: 20, right: 20, bottom: 40, left: 50 }

  // Calculate points for the lines
  const getX = (index: number) => {
    const availableWidth = chartWidth - padding.left - padding.right
    return padding.left + (index / (mockData.length - 1)) * availableWidth
  }

  const getY = (score: number) => {
    const availableHeight = chartHeight - padding.top - padding.bottom
    return padding.top + (1 - score / maxScore) * availableHeight
  }

  // Generate smooth bezier curve like stock charts
  const createSmoothPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return ''

    let path = `M ${points[0].x} ${points[0].y}`

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i]
      const next = points[i + 1]

      // Calculate control points for smooth bezier curve
      const xDiff = (next.x - current.x) * 0.5
      const cp1x = current.x + xDiff
      const cp1y = current.y
      const cp2x = next.x - xDiff
      const cp2y = next.y

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`
    }

    return path
  }

  const avgPoints = mockData.map((d, i) => ({ x: getX(i), y: getY(d.avgScore) }))
  const bestPoints = mockData.map((d, i) => ({ x: getX(i), y: getY(d.bestScore) }))

  const avgPath = createSmoothPath(avgPoints)
  const bestPath = createSmoothPath(bestPoints)

  // Create filled area under average line
  const avgAreaPath = avgPath + ` L ${getX(mockData.length - 1)} ${chartHeight - padding.bottom} L ${padding.left} ${chartHeight - padding.bottom} Z`

  return (
    <div className="relative">
      {/* Legend */}
      <div className="flex items-center justify-end gap-6 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Average Score</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Best Score</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative bg-white rounded-xl p-6 border border-gray-100">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full"
          style={{ height: '320px' }}
        >
          <defs>
            {/* Gradient for area fill */}
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
            {/* Gradient for best score area */}
            <linearGradient id="bestGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((value) => (
            <g key={value}>
              <line
                x1={padding.left}
                y1={getY(value)}
                x2={chartWidth - padding.right}
                y2={getY(value)}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={getY(value)}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-xs fill-gray-400"
              >
                {value}
              </text>
            </g>
          ))}

          {/* Best Score Area Fill */}
          <path
            d={bestPath + ` L ${getX(mockData.length - 1)} ${chartHeight - padding.bottom} L ${padding.left} ${chartHeight - padding.bottom} Z`}
            fill="url(#bestGradient)"
          />

          {/* Average Score Area Fill */}
          <path
            d={avgAreaPath}
            fill="url(#areaGradient)"
          />

          {/* Best Score Line */}
          <path
            d={bestPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.7"
          />

          {/* Average Score Line */}
          <path
            d={avgPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive overlay points (invisible but clickable) */}
          {avgPoints.map((point, index) => (
            <circle
              key={`hover-${index}`}
              cx={point.x}
              cy={point.y}
              r={20}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}

          {/* Visible data point on hover */}
          {hoveredIndex !== null && (
            <>
              {/* Vertical line */}
              <line
                x1={getX(hoveredIndex)}
                y1={padding.top}
                x2={getX(hoveredIndex)}
                y2={chartHeight - padding.bottom}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              {/* Average point */}
              <circle
                cx={avgPoints[hoveredIndex].x}
                cy={avgPoints[hoveredIndex].y}
                r={5}
                fill="white"
                stroke="#3b82f6"
                strokeWidth="2.5"
              />
              {/* Best point */}
              <circle
                cx={bestPoints[hoveredIndex].x}
                cy={bestPoints[hoveredIndex].y}
                r={5}
                fill="white"
                stroke="#10b981"
                strokeWidth="2.5"
              />
            </>
          )}

          {/* X-axis labels */}
          {mockData.map((data, index) => (
            <text
              key={data.month}
              x={getX(index)}
              y={chartHeight - padding.bottom + 20}
              textAnchor="middle"
              className="text-xs fill-gray-400 font-medium"
            >
              {data.month}
            </text>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredIndex !== null && (
          <div
            className="absolute bg-white border border-gray-200 shadow-xl px-4 py-3 rounded-lg text-sm z-10 pointer-events-none"
            style={{
              left: `${(getX(hoveredIndex) / chartWidth) * 100}%`,
              top: '20px',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-semibold text-gray-900 mb-2 text-xs">{mockData[hoveredIndex].month} 2024</div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-6">
                <span className="text-gray-500 text-xs">Average</span>
                <span className="font-semibold text-primary-600">{mockData[hoveredIndex].avgScore}%</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-gray-500 text-xs">Best</span>
                <span className="font-semibold text-emerald-600">{mockData[hoveredIndex].bestScore}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="text-center p-4 bg-gray-50 rounded-xl">
          <div className="text-2xl font-bold text-gray-900">87%</div>
          <div className="text-xs text-gray-500">Overall Average</div>
        </div>
        <div className="text-center p-4 bg-primary-50 rounded-xl">
          <div className="text-2xl font-bold text-primary-600">+18%</div>
          <div className="text-xs text-gray-500">Improvement</div>
        </div>
        <div className="text-center p-4 bg-emerald-50 rounded-xl">
          <div className="text-2xl font-bold text-emerald-600">100%</div>
          <div className="text-xs text-gray-500">Peak Score</div>
        </div>
      </div>
    </div>
  )
}
