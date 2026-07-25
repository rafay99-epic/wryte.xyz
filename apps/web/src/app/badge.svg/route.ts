/**
 * "Published with Wryte" README badge — shields-style, hand-authored SVG.
 *
 * Static content with long cache headers: GitHub's camo proxy (and any
 * CDN) caches it, so READMEs cost this origin roughly one request a day.
 * No user input is interpolated — zero escaping surface. Convex is never
 * involved.
 *
 * Usage (copy snippet lives in Settings → Publishing):
 *   [![Published with Wryte](https://wryte.xyz/badge.svg)](https://wryte.xyz/gh?utm_medium=badge)
 */

const BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="146" height="22" role="img" aria-label="Published with Wryte">
  <title>Published with Wryte</title>
  <defs>
    <linearGradient id="amber" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbbf24"/>
      <stop offset="1" stop-color="#d97706"/>
    </linearGradient>
    <clipPath id="round"><rect width="146" height="22" rx="4"/></clipPath>
  </defs>
  <g clip-path="url(#round)">
    <rect width="100" height="22" fill="#2b2b33"/>
    <rect x="100" width="46" height="22" fill="url(#amber)"/>
  </g>
  <g clip-path="url(#round)">
    <rect x="5" y="5" width="12" height="12" rx="3" fill="url(#amber)"/>
    <text x="11" y="14.5" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="9" font-weight="bold" fill="#2d2d08" text-anchor="middle">W</text>
  </g>
  <text x="59" y="15" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="10" fill="#e7e5e4" text-anchor="middle">published with</text>
  <text x="123" y="15" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="10" font-weight="bold" fill="#2d2d08" text-anchor="middle">wryte</text>
</svg>
`;

export function GET() {
  return new Response(BADGE_SVG, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // A day at the edge + a week of stale-while-revalidate: camo/CDNs
      // absorb README traffic; a badge redesign propagates within a day.
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
