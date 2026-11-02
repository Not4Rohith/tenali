import React from 'react';

/**
 * SnakeCharacter Component
 * 
 * Renders a continuously growing snake following the full explored route:
 * - Unbroken, continuous body along corridor centerlines with consistent thickness
 * - Smooth 90-degree turns using rounded SVG line joins
 * - Expressive head with eyes looking in the direction of movement, mouth and tongue
 * - Carried numerical value displayed prominently in front of its mouth
 */
export function SnakeCharacter({ x, y, heading = 'RIGHT', segments = [], carriedValue = null, carriedValues = [] }) {
  // Normalize carried values list
  const values = Array.isArray(carriedValues) && carriedValues.length > 0
    ? carriedValues
    : (carriedValue !== null ? [carriedValue] : []);

  const isMulti = values.length > 1;

  // Head angle and badge offset based on heading
  let rotation = 0;
  let badgeOffsetX = 0;
  let badgeOffsetY = 0;

  switch (heading) {
    case 'UP':
      rotation = -90;
      badgeOffsetX = 0;
      badgeOffsetY = -26;
      break;
    case 'DOWN':
      rotation = 90;
      badgeOffsetX = 0;
      badgeOffsetY = 26;
      break;
    case 'LEFT':
      rotation = 180;
      badgeOffsetX = isMulti ? -34 : -24;
      badgeOffsetY = 0;
      break;
    case 'RIGHT':
    default:
      rotation = 0;
      badgeOffsetX = isMulti ? 34 : 24;
      badgeOffsetY = 0;
      break;
  }

  // Construct continuous path string through all segments (from tail to head)
  const pathData = segments.length > 1
    ? segments
        .slice()
        .reverse()
        .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
        .join(' ')
    : '';

  const tailPt = segments.length > 0 ? segments[segments.length - 1] : null;

  return (
    <g className="snake-character">
      {/* 1. Continuous Growing Body Trail */}
      {segments.length > 1 && (
        <g className="snake-continuous-body">
          {/* Outer stroke border for depth */}
          <path
            d={pathData}
            fill="none"
            stroke="#047857"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Main body fill */}
          <path
            d={pathData}
            fill="none"
            stroke="#10b981"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Inner spine highlight */}
          <path
            d={pathData}
            fill="none"
            stroke="#34d399"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Scale articulation marks along the path */}
          {segments.map((seg, idx) => {
            if (idx === 0) return null; // Head handled separately
            return (
              <circle
                key={`joint-${idx}`}
                cx={seg.x}
                cy={seg.y}
                r="3"
                fill="#047857"
                opacity="0.6"
              />
            );
          })}
        </g>
      )}

      {/* 2. Tapered Tail Tip */}
      {tailPt && segments.length > 1 && (
        <circle
          cx={tailPt.x}
          cy={tailPt.y}
          r="6"
          fill="#059669"
          stroke="#047857"
          strokeWidth="1.5"
        />
      )}

      {/* 3. Recognizable Snake Head */}
      <g transform={`translate(${x}, ${y}) rotate(${rotation})`}>
        {/* Tongue */}
        <path
          d="M 13 -2 L 19 -4 M 13 0 L 21 0 M 13 2 L 19 4"
          stroke="#ef4444"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />

        {/* Head Base */}
        <ellipse
          cx="2"
          cy="0"
          rx="12"
          ry="10"
          fill="#10b981"
          stroke="#047857"
          strokeWidth="2"
        />

        {/* Head Top Cap */}
        <path
          d="M -6 -5 Q 3 -9 11 0 Q 3 9 -6 5 Z"
          fill="#34d399"
        />

        {/* Left Eye */}
        <ellipse cx="4" cy="-4.5" rx="3.5" ry="3" fill="#ffffff" stroke="#047857" strokeWidth="0.8" />
        <circle cx="5" cy="-4.5" r="1.6" fill="#0f172a" />
        <circle cx="5.6" cy="-5.2" r="0.6" fill="#ffffff" />

        {/* Right Eye */}
        <ellipse cx="4" cy="4.5" rx="3.5" ry="3" fill="#ffffff" stroke="#047857" strokeWidth="0.8" />
        <circle cx="5" cy="4.5" r="1.6" fill="#0f172a" />
        <circle cx="5.6" cy="3.8" r="0.6" fill="#ffffff" />

        {/* Nostrils */}
        <circle cx="10" cy="-1.8" r="0.7" fill="#065f46" />
        <circle cx="10" cy="1.8" r="0.7" fill="#065f46" />

        {/* Mouth Smile */}
        <path
          d="M 7 -2.5 Q 11 0 7 2.5"
          fill="none"
          stroke="#065f46"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </g>

      {/* 4. Carried Intermediate Result(s) in Front of Mouth */}
      {values.length > 0 && (
        <g
          transform={`translate(${x + badgeOffsetX}, ${y + badgeOffsetY})`}
          className="carried-badge"
          style={{ transition: 'all 0.15s ease-out' }}
        >
          {values.length === 1 ? (
            <g>
              {/* Single Value Badge */}
              <rect
                x="-16"
                y="-11"
                width="32"
                height="22"
                rx="11"
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth="1.8"
                filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.6))"
              />
              <text
                x="0"
                y="4.5"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="12"
                fontWeight="800"
                fontFamily="'Fredoka', 'Outfit', sans-serif"
              >
                {values[0]}
              </text>
            </g>
          ) : (
            <g className="carried-dual-badge">
              {/* Dual Value Container */}
              <rect
                x="-28"
                y="-12"
                width="56"
                height="24"
                rx="12"
                fill="#0f172a"
                stroke="#ffffff"
                strokeWidth="1.8"
                filter="drop-shadow(0px 2px 6px rgba(0,0,0,0.7))"
              />
              {/* Value 1 Pill (Amber) */}
              <rect
                x="-25"
                y="-9.5"
                width="23"
                height="19"
                rx="9.5"
                fill="#f59e0b"
              />
              <text
                x="-13.5"
                y="4"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="800"
                fontFamily="'Fredoka', 'Outfit', sans-serif"
              >
                {values[0]}
              </text>
              {/* Value 2 Pill (Sky Blue) */}
              <rect
                x="2"
                y="-9.5"
                width="23"
                height="19"
                rx="9.5"
                fill="#0ea5e9"
              />
              <text
                x="13.5"
                y="4"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="800"
                fontFamily="'Fredoka', 'Outfit', sans-serif"
              >
                {values[1]}
              </text>
            </g>
          )}
        </g>
      )}
    </g>
  );
}
