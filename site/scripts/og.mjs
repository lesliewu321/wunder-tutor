// Renders public/og.png (1200×630 social card) from an SVG. Run: node scripts/og.mjs
import sharp from 'sharp';
const pip = `
  <g transform="translate(820 150) scale(2.9)">
    <path d="M33 54C20 32 23 9 36 7c13 2 17 23 15 40Z" fill="#6c4df5"/><path d="M36 46c-7-14-6-29 .5-31C43 17 45 31 44 42Z" fill="#ff9bb0"/>
    <g transform="translate(120 0) scale(-1 1)"><path d="M33 54C20 32 23 9 36 7c13 2 17 23 15 40Z" fill="#6c4df5"/><path d="M36 46c-7-14-6-29 .5-31C43 17 45 31 44 42Z" fill="#ff9bb0"/></g>
    <ellipse cx="48" cy="107" rx="9.5" ry="5" fill="#5236d1"/><ellipse cx="72" cy="107" rx="9.5" ry="5" fill="#5236d1"/>
    <ellipse cx="60" cy="74" rx="36" ry="34" fill="#6c4df5"/><ellipse cx="60" cy="86" rx="22" ry="17" fill="#fff" opacity=".92"/>
    <circle cx="35" cy="79" r="5" fill="#ff6b5e" opacity=".55"/><circle cx="85" cy="79" r="5" fill="#ff6b5e" opacity=".55"/>
    <g fill="none" stroke="#2b2140" stroke-width="3.6" stroke-linecap="round"><path d="M39.5 67Q47 58 54.5 67"/><path d="M65.5 67Q73 58 80.5 67"/></g>
    <path d="M50 78Q60 95 70 78Z" fill="#5a1e33"/>
  </g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#fff8ee"/>
  <circle cx="1000" cy="120" r="330" fill="#ece7ff"/>
  ${pip}
  <text x="80" y="150" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="34" fill="#6c4df5">WUNDER TUTOR</text>
  <text font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="70" fill="#2b2140">
    <tspan x="80" y="270">Your child speaks.</tspan>
    <tspan x="80" y="356" fill="#6c4df5">Pip shows exactly</tspan>
    <tspan x="80" y="442" fill="#6c4df5">which sound to fix.</tspan>
  </text>
  <text x="80" y="530" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="32" fill="#6b6280">English pronunciation tutor · ages 5–15</text>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile(new URL('../public/og.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
console.log('public/og.png written');
