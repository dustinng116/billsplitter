import { Injectable } from '@angular/core';

// ─────────────────────────────────────────────────────────────────────────────
// Surface Equations  (ported from vue-web-liquid-glass/src/lib/surfaceEquations.ts)
// ─────────────────────────────────────────────────────────────────────────────

const CONVEX_CIRCLE_FN = (x: number) => Math.sqrt(1 - (1 - x) ** 2);

// Convex squircle — smoother than circle, preferred for pill shapes
const CONVEX_FN = (x: number) => Math.pow(1 - Math.pow(1 - x, 4), 1 / 4);

const LIP_FN = (x: number) => {
  const convex = CONVEX_FN(x * 2);
  const concave = 1 - CONVEX_CIRCLE_FN(x) + 0.1;
  const smootherstep = 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
  return convex * (1 - smootherstep) + concave * smootherstep;
};

export type BezelType = 'convex_squircle' | 'convex_circle' | 'concave' | 'lip';

function getSurfaceFn(bezel: BezelType): (x: number) => number {
  switch (bezel) {
    case 'convex_circle': return CONVEX_CIRCLE_FN;
    case 'concave': return (x) => 1 - CONVEX_CIRCLE_FN(x);
    case 'lip': return LIP_FN;
    default: return CONVEX_FN;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Displacement Map  (ported from vue-web-liquid-glass/src/lib/displacementMap.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate per-pixel displacement using Snell's law refraction.
 * Returns an array of displacement magnitudes indexed by bezel proximity.
 */
function calculateDisplacementProfile(
  glassThickness = 200,
  bezelWidth = 50,
  bezelHeightFn: (x: number) => number = (x) => x,
  refractiveIndex = 1.5,
  samples = 128,
): number[] {
  const eta = 1 / refractiveIndex;

  function refract(nx: number, ny: number): [number, number] | null {
    const dot = ny;
    const k = 1 - eta * eta * (1 - dot * dot);
    if (k < 0) return null; // total internal reflection
    const kSqrt = Math.sqrt(k);
    return [-(eta * dot + kSqrt) * nx, eta - (eta * dot + kSqrt) * ny];
  }

  return Array.from({ length: samples }, (_, i) => {
    const x = i / samples;
    const y = bezelHeightFn(x);
    const dx = x < 1 ? 0.0001 : -0.0001;
    const y2 = bezelHeightFn(x + dx);
    const derivative = (y2 - y) / dx;
    const mag = Math.sqrt(derivative * derivative + 1);
    const normal: [number, number] = [-derivative / mag, -1 / mag];
    const refracted = refract(normal[0], normal[1]);
    if (!refracted) return 0;
    return refracted[0] * ((y * bezelWidth + glassThickness) / refracted[1]);
  });
}

/**
 * Paint the displacement profile onto a canvas ImageData for a pill shape.
 * Red channel = X displacement, Green channel = Y displacement.
 * Neutral (no displacement) = 128 in both channels.
 */
function buildDisplacementImageData(
  width: number,
  height: number,
  bezelWidth: number,
  maxDisplacement: number,
  profile: number[],
  dpr = 1,
): ImageData {
  const bw = Math.floor(width * dpr);
  const bh = Math.floor(height * dpr);
  const img = new ImageData(bw, bh);
  const bezel = bezelWidth * dpr;

  // Fill neutral
  new Uint32Array(img.data.buffer).fill(0xff008080);

  const r = Math.min(bw, bh) / 2; // pill radius = half of shorter side
  const wBetween = Math.max(0, bw - r * 2);
  const hBetween = Math.max(0, bh - r * 2);

  for (let y1 = 0; y1 < bh; y1++) {
    for (let x1 = 0; x1 < bw; x1++) {
      const idx = (y1 * bw + x1) * 4;

      const onLeft  = x1 < r;
      const onRight = x1 >= bw - r;
      const onTop   = y1 < r;
      const onBot   = y1 >= bh - r;

      let cx = 0, cy = 0;
      let distToEdge = 0;
      let normalX = 0, normalY = 0;
      let inBezel = false;

      if ((onLeft || onRight) && (onTop || onBot)) {
        // Corner
        cx = onLeft ? x1 - r : x1 - (bw - r);
        cy = onTop  ? y1 - r : y1 - (bh - r);
        const d = Math.sqrt(cx * cx + cy * cy);
        distToEdge = r - d;
        if (distToEdge >= -1 && distToEdge <= bezel) {
          inBezel = true;
          normalX = cx / (d || 1);
          normalY = cy / (d || 1);
        }
      } else if (onLeft || onRight) {
        distToEdge = onLeft ? x1 : (bw - 1 - x1);
        if (distToEdge <= bezel) {
          inBezel = true;
          normalX = onLeft ? -1 : 1;
          normalY = 0;
        }
      } else if (onTop || onBot) {
        distToEdge = onTop ? y1 : (bh - 1 - y1);
        if (distToEdge <= bezel) {
          inBezel = true;
          normalX = 0;
          normalY = onTop ? -1 : 1;
        }
      }

      if (inBezel && distToEdge >= 0) {
        const opacity = 1; // already clamped
        const bi = Math.min(profile.length - 1, Math.max(0, ((distToEdge / bezel) * profile.length) | 0));
        const dist = profile[bi] ?? 0;
        const dX = (-normalX * dist) / maxDisplacement;
        const dY = (-normalY * dist) / maxDisplacement;
        img.data[idx]     = 128 + dX * 127 * opacity;
        img.data[idx + 1] = 128 + dY * 127 * opacity;
        img.data[idx + 2] = 0;
        img.data[idx + 3] = 255;
      }
    }
  }
  return img;
}

// ─────────────────────────────────────────────────────────────────────────────
// Specular Map  (ported from vue-web-liquid-glass/src/lib/specular.ts)
// ─────────────────────────────────────────────────────────────────────────────

function buildSpecularImageData(
  width: number,
  height: number,
  radius: number,
  bezelWidth: number,
  specularAngle = Math.PI / 3,
  dpr = 1,
): ImageData {
  const bw = Math.floor(width * dpr);
  const bh = Math.floor(height * dpr);
  const img = new ImageData(bw, bh);
  new Uint32Array(img.data.buffer).fill(0x00000000);

  const r = radius * dpr;
  const bz = bezelWidth * dpr;
  const sv = [Math.cos(specularAngle), Math.sin(specularAngle)];

  const rSq = r * r;
  const rPlus = (r + dpr) ** 2;
  const rMinus = (r - bz) ** 2;
  const wBetween = bw - r * 2;
  const hBetween = bh - r * 2;

  for (let y1 = 0; y1 < bh; y1++) {
    for (let x1 = 0; x1 < bw; x1++) {
      const idx = (y1 * bw + x1) * 4;

      const onLeft  = x1 < r;
      const onRight = x1 >= bw - r;
      const onTop   = y1 < r;
      const onBot   = y1 >= bh - r;

      const x = onLeft ? x1 - r : onRight ? x1 - r - wBetween : 0;
      const y = onTop  ? y1 - r : onBot   ? y1 - r - hBetween : 0;

      const dSq = x * x + y * y;
      const inBezel = dSq <= rPlus && dSq >= rMinus;

      if (inBezel) {
        const dc = Math.sqrt(dSq);
        const distFromSide = r - dc;
        const opacity = dSq < rSq
          ? 1
          : 1 - (dc - Math.sqrt(rSq)) / (Math.sqrt(rPlus) - Math.sqrt(rSq));

        const cos = x / dc;
        const sin = -y / dc;
        const dot = Math.abs(cos * sv[0] + sin * sv[1]);
        const coeff = dot * Math.sqrt(1 - (1 - distFromSide / dpr) ** 2);
        const color = 255 * coeff;
        const alpha = color * coeff * opacity;

        img.data[idx]     = color;
        img.data[idx + 1] = color;
        img.data[idx + 2] = color;
        img.data[idx + 3] = alpha;
      }
    }
  }
  return img;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: ImageData → data URL via canvas
// ─────────────────────────────────────────────────────────────────────────────

function imageDataToDataUrl(data: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width  = data.width;
  canvas.height = data.height;
  canvas.getContext('2d')?.putImageData(data, 0, 0);
  return canvas.toDataURL('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Service
// ─────────────────────────────────────────────────────────────────────────────

export interface LiquidGlassAssets {
  displacementUrl: string;
  specularUrl: string;
  scale: number;
}

export interface LiquidGlassOptions {
  width: number;
  height: number;
  bezelWidth?: number;
  glassThickness?: number;
  refractiveIndex?: number;
  bezelType?: BezelType;
  scaleRatio?: number;
  specularAngle?: number;
  dpr?: number;
}

@Injectable({ providedIn: 'root' })
export class LiquidGlassService {

  /** Generate displacement + specular image data URLs for a given element size */
  generate(opts: LiquidGlassOptions): LiquidGlassAssets {
    const {
      width, height,
      bezelWidth     = 32,
      glassThickness = 120,
      refractiveIndex = 1.5,
      bezelType      = 'convex_squircle',
      scaleRatio     = 1,
      specularAngle  = Math.PI / 3,
      dpr            = (typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1),
    } = opts;

    const surfaceFn = getSurfaceFn(bezelType);
    const profile   = calculateDisplacementProfile(glassThickness, bezelWidth, surfaceFn, refractiveIndex);
    const maxDisp   = Math.max(...profile.map(Math.abs)) || 1;

    const dispData = buildDisplacementImageData(width, height, bezelWidth, maxDisp, profile, dpr);
    const specData = buildSpecularImageData(width, height, Math.min(width, height) / 2, bezelWidth, specularAngle, dpr);

    return {
      displacementUrl: imageDataToDataUrl(dispData),
      specularUrl: imageDataToDataUrl(specData),
      scale: maxDisp * scaleRatio,
    };
  }
}
