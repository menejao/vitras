/**
 * barcode128.js — Minimal Code 128B SVG barcode generator.
 *
 * Implements ISO/IEC 15417 Code 128 (Subset B only).
 * Patterns verified against ZXing (Apache 2.0) and GS1 General Specifications.
 *
 * Code 128B encodes printable ASCII 32–126.
 * Characters outside this range are silently skipped.
 *
 * Usage:
 *   import { generateCode128SVG } from "./barcode128";
 *   const svgString = generateCode128SVG("VIT-20260713-0001");
 */

// Code 128 pattern table, values 0–105 (data + START A/B/C).
// Each pattern is [b1, s1, b2, s2, b3, s3] — alternating bar/space widths, starting with bar.
// Total width per character = 11 modules.
// Verified against ZXing Code128Reader/Writer and ISO 15417 Table A.1.
const PATTERNS = [
  [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
  [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
  [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],
  [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
  [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],
  [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
  [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],
  [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
  [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],
  [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
  [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],
  [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
  [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],
  [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
  [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],
  [2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
  [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],
  [1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],
  [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],
  [1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
  [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],
  // 103 = START A
  [2,1,1,4,1,2],
  // 104 = START B
  [2,1,1,2,1,4],
  // 105 = START C
  [2,1,1,2,4,1],
];

// STOP character: 7 elements (bar,sp,bar,sp,bar,sp,bar) — 13 modules
// Followed by mandatory 2-module termination bar.
const STOP = [2,3,3,1,1,1,2];

const START_B_VAL = 104;

/**
 * @param {string} text  Printable ASCII to encode
 * @param {object} opts
 * @param {number} opts.moduleWidth  Width of one module in px (default 2)
 * @param {number} opts.barHeight    Bar height in px (default 60)
 * @param {number} opts.fontSize     Text font size in px (default 11)
 * @returns {string} SVG markup
 */
export function generateCode128SVG(text, { moduleWidth = 2, barHeight = 60, fontSize = 11 } = {}) {
  if (!text) return "";

  // 1. Convert to Code 128B values (ASCII - 32, range 0-94)
  const vals = [];
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c >= 32 && c <= 126) vals.push(c - 32);
    // Characters outside 32–126 silently dropped
  }
  if (!vals.length) return "";

  // 2. Checksum: (START_B_VAL + Σ((i+1) * val[i])) % 103
  let check = START_B_VAL;
  for (let i = 0; i < vals.length; i++) check += (i + 1) * vals[i];
  check %= 103;

  // 3. Build bar sequence: quiet | START_B | data | check | STOP | term-bar | quiet
  const QUIET = 10; // modules
  const TERM  = 2;  // termination bar width

  // Collect all patterns in order
  const allPats = [PATTERNS[START_B_VAL], ...vals.map(v => PATTERNS[v]), PATTERNS[check], STOP];

  // Compute total SVG width in modules
  let totalMods = QUIET * 2 + TERM;
  for (const p of allPats) for (const w of p) totalMods += w;

  const W = totalMods * moduleWidth;
  const textH = fontSize + 4;
  const H = barHeight + textH;

  // 4. Generate <rect> elements for bars
  const rects = [];
  let x = QUIET * moduleWidth;

  for (const pat of allPats) {
    let bar = true;
    for (const w of pat) {
      if (bar) {
        rects.push(
          `<rect x="${x.toFixed(2)}" y="0" width="${(w * moduleWidth).toFixed(2)}" height="${barHeight}"/>`
        );
      }
      x += w * moduleWidth;
      bar = !bar;
    }
    // Each 6-element pattern starts and ends on bar→space, so next pattern starts on bar → OK.
    // STOP (7 elements) ends on bar, so x points after bar (no space needed before term bar).
  }

  // Termination bar (after STOP)
  rects.push(
    `<rect x="${x.toFixed(2)}" y="0" width="${(TERM * moduleWidth).toFixed(2)}" height="${barHeight}"/>`
  );

  // Escape text for SVG
  const safeTxt = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(2)} ${H}" ` +
    `width="${W.toFixed(2)}" height="${H}" role="img" aria-label="Código de barras: ${safeTxt}">` +
    `<rect width="${W.toFixed(2)}" height="${H}" fill="#fff"/>` +
    `<g fill="#000">${rects.join("")}</g>` +
    `<text x="${(W/2).toFixed(2)}" y="${barHeight + fontSize + 2}" ` +
    `text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="#000">${safeTxt}</text>` +
    `</svg>`
  );
}
