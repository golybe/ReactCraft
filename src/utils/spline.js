/**
 * Spline Interpolation System
 *
 * Provides smooth interpolation between control points.
 * Used for height mapping, biome transitions, etc.
 */

// =====================================================
// CUBIC HERMITE SPLINE (Catmull-Rom variant)
// =====================================================

export class CubicSpline {
  constructor(points) {
    this.points = points.sort((a, b) => a[0] - b[0]);
    this.tangents = this.computeTangents();
  }

  computeTangents() {
    const n = this.points.length;
    const tangents = new Array(n);

    for (let i = 0; i < n; i++) {
      if (i === 0) {
        tangents[i] = (this.points[1][1] - this.points[0][1]) /
                      (this.points[1][0] - this.points[0][0]);
      } else if (i === n - 1) {
        tangents[i] = (this.points[n - 1][1] - this.points[n - 2][1]) /
                      (this.points[n - 1][0] - this.points[n - 2][0]);
      } else {
        tangents[i] = (this.points[i + 1][1] - this.points[i - 1][1]) /
                      (this.points[i + 1][0] - this.points[i - 1][0]);
      }
    }

    return tangents;
  }

  h00(t) { return (1 + 2 * t) * (1 - t) * (1 - t); }
  h10(t) { return t * (1 - t) * (1 - t); }
  h01(t) { return t * t * (3 - 2 * t); }
  h11(t) { return t * t * (t - 1); }

  getValue(x) {
    const n = this.points.length;

    if (x <= this.points[0][0]) return this.points[0][1];
    if (x >= this.points[n - 1][0]) return this.points[n - 1][1];

    let i = 0;
    while (i < n - 1 && this.points[i + 1][0] < x) {
      i++;
    }

    const x0 = this.points[i][0];
    const x1 = this.points[i + 1][0];
    const y0 = this.points[i][1];
    const y1 = this.points[i + 1][1];
    const m0 = this.tangents[i];
    const m1 = this.tangents[i + 1];

    const t = (x - x0) / (x1 - x0);
    const h = x1 - x0;

    return this.h00(t) * y0 +
           this.h10(t) * h * m0 +
           this.h01(t) * y1 +
           this.h11(t) * h * m1;
  }

  get(x) {
    return this.getValue(x);
  }
}

// =====================================================
// SMOOTHSTEP SPLINE (faster, simpler)
// =====================================================

export class SmoothSpline {
  constructor(points) {
    this.points = points.sort((a, b) => a[0] - b[0]);
  }

  smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  getValue(x) {
    const n = this.points.length;

    if (x <= this.points[0][0]) return this.points[0][1];
    if (x >= this.points[n - 1][0]) return this.points[n - 1][1];

    for (let i = 0; i < n - 1; i++) {
      const [x0, y0] = this.points[i];
      const [x1, y1] = this.points[i + 1];

      if (x >= x0 && x <= x1) {
        const t = (x - x0) / (x1 - x0);
        return y0 + (y1 - y0) * this.smoothstep(t);
      }
    }

    return 0;
  }

  get(x) {
    return this.getValue(x);
  }
}

// =====================================================
// LINEAR SPLINE (fastest)
// =====================================================

export class LinearSpline {
  constructor(points) {
    this.points = points.sort((a, b) => a[0] - b[0]);
  }

  getValue(x) {
    const n = this.points.length;

    if (x <= this.points[0][0]) return this.points[0][1];
    if (x >= this.points[n - 1][0]) return this.points[n - 1][1];

    for (let i = 0; i < n - 1; i++) {
      const [x0, y0] = this.points[i];
      const [x1, y1] = this.points[i + 1];

      if (x >= x0 && x <= x1) {
        const t = (x - x0) / (x1 - x0);
        return y0 + (y1 - y0) * t;
      }
    }

    return 0;
  }

  get(x) {
    return this.getValue(x);
  }
}

// =====================================================
// MULTI-DIMENSIONAL SPLINE (for biome parameters)
// =====================================================

export class MultiSpline {
  constructor(splines) {
    this.splines = splines;
  }

  getValue(params) {
    let result = 0;
    for (const [key, spline] of Object.entries(this.splines)) {
      if (params[key] !== undefined) {
        result += spline.getValue(params[key]);
      }
    }
    return result;
  }
}

// =====================================================
// HELPER: Create spline from simple height map
// =====================================================

export function createHeightSpline(points) {
  return new CubicSpline(points);
}

// Backward compatibility - export as default Spline class
export const Spline = SmoothSpline;

export default {
  CubicSpline,
  SmoothSpline,
  LinearSpline,
  MultiSpline,
  Spline,
  createHeightSpline
};
