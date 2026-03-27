import { describe, it, expect } from "vitest";
import {
  rbfKernel,
  buildKernelMatrix,
  choleskyDecompose,
  choleskySolve,
  gpPredict,
  defaultHyperparams,
  type GPHyperparams,
} from "$lib/services/gaussianProcess";

const hp = defaultHyperparams();

// ── rbfKernel ──

describe("rbfKernel", () => {
  it("returns signalVariance for same point", () => {
    expect(rbfKernel(100, 100, hp)).toBe(hp.signalVariance);
  });

  it("returns ~0 for very distant points", () => {
    expect(rbfKernel(0, 10000, hp)).toBeCloseTo(0, 10);
  });

  it("is symmetric", () => {
    expect(rbfKernel(10, 50, hp)).toBe(rbfKernel(50, 10, hp));
  });

  it("decays with distance", () => {
    const close = rbfKernel(0, 10, hp);
    const far = rbfKernel(0, 100, hp);
    expect(close).toBeGreaterThan(far);
  });

  it("increases with lengthScale", () => {
    const short = rbfKernel(0, 30, { ...hp, lengthScale: 10 });
    const long = rbfKernel(0, 30, { ...hp, lengthScale: 100 });
    expect(long).toBeGreaterThan(short);
  });

  it("scales with signalVariance", () => {
    const low = rbfKernel(0, 10, { ...hp, signalVariance: 100 });
    const high = rbfKernel(0, 10, { ...hp, signalVariance: 1000 });
    expect(high / low).toBeCloseTo(10, 5);
  });
});

// ── buildKernelMatrix ──

describe("buildKernelMatrix", () => {
  it("returns correct dimensions", () => {
    const K = buildKernelMatrix([0, 30, 60], hp);
    expect(K).toHaveLength(3);
    expect(K[0]).toHaveLength(3);
    expect(K[1]).toHaveLength(3);
    expect(K[2]).toHaveLength(3);
  });

  it("is symmetric", () => {
    const K = buildKernelMatrix([0, 30, 60, 90], hp);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        expect(K[i][j]).toBe(K[j][i]);
      }
    }
  });

  it("has signalVariance + noiseVariance on diagonal", () => {
    const K = buildKernelMatrix([0, 100], hp);
    expect(K[0][0]).toBe(hp.signalVariance + hp.noiseVariance);
    expect(K[1][1]).toBe(hp.signalVariance + hp.noiseVariance);
  });

  it("handles single point", () => {
    const K = buildKernelMatrix([42], hp);
    expect(K).toHaveLength(1);
    expect(K[0][0]).toBe(hp.signalVariance + hp.noiseVariance);
  });

  it("handles empty input", () => {
    const K = buildKernelMatrix([], hp);
    expect(K).toHaveLength(0);
  });
});

// ── choleskyDecompose ──

describe("choleskyDecompose", () => {
  it("decomposes 2x2 known matrix", () => {
    const A = [
      [4, 2],
      [2, 5],
    ];
    const L = choleskyDecompose(A);
    // L should be lower triangular
    expect(L[0][1]).toBe(0);
    // Reconstruct: L * Lᵀ should ≈ A
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        let sum = 0;
        for (let k = 0; k < 2; k++) sum += L[i][k] * L[j][k];
        expect(sum).toBeCloseTo(A[i][j], 5);
      }
    }
  });

  it("decomposes 3x3 known matrix", () => {
    const A = [
      [25, 15, -5],
      [15, 18, 0],
      [-5, 0, 11],
    ];
    const L = choleskyDecompose(A);
    // Upper triangle of L should be 0
    expect(L[0][1]).toBe(0);
    expect(L[0][2]).toBe(0);
    expect(L[1][2]).toBe(0);
    // Reconstruct
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) sum += L[i][k] * L[j][k];
        expect(sum).toBeCloseTo(A[i][j], 5);
      }
    }
  });

  it("handles 1x1 matrix", () => {
    const L = choleskyDecompose([[9]]);
    expect(L[0][0]).toBeCloseTo(3, 5);
  });

  it("handles identity matrix", () => {
    const I = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const L = choleskyDecompose(I);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(L[i][j]).toBeCloseTo(i === j ? 1 : 0, 5);
      }
    }
  });

  it("reconstructs kernel matrix from buildKernelMatrix", () => {
    const X = [0, 30, 60];
    const K = buildKernelMatrix(X, hp);
    const L = choleskyDecompose(K);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) sum += L[i][k] * L[j][k];
        expect(sum).toBeCloseTo(K[i][j], 4);
      }
    }
  });
});

// ── choleskySolve ──

describe("choleskySolve", () => {
  it("solves known 2x2 system", () => {
    // A = [[4, 2], [2, 5]], b = [8, 13] → x = [1, 2.2]? Let's verify:
    // 4*1 + 2*2.2 = 8.4 ≠ 8. Use exact: Ax = b → x = A⁻¹b
    // Manually: 4x + 2y = 8, 2x + 5y = 13 → x = (8 - 2y)/4
    // 2(8-2y)/4 + 5y = 13 → (16-4y)/4 + 5y = 13 → 4-y+5y = 13 → 4y = 9 → y = 2.25, x = 0.875
    const A = [
      [4, 2],
      [2, 5],
    ];
    const L = choleskyDecompose(A);
    const x = choleskySolve(L, [8, 13]);
    expect(x[0]).toBeCloseTo(0.875, 5);
    expect(x[1]).toBeCloseTo(2.25, 5);
  });

  it("solves identity system", () => {
    const I = [
      [1, 0],
      [0, 1],
    ];
    const L = choleskyDecompose(I);
    const x = choleskySolve(L, [3, 7]);
    expect(x[0]).toBeCloseTo(3, 10);
    expect(x[1]).toBeCloseTo(7, 10);
  });

  it("round-trips through kernel matrix solve", () => {
    const X = [0, 60, 120];
    const K = buildKernelMatrix(X, hp);
    const L = choleskyDecompose(K);
    const b = [10, -5, 3];
    const x = choleskySolve(L, b);
    // Verify Kx ≈ b
    for (let i = 0; i < 3; i++) {
      let sum = 0;
      for (let j = 0; j < 3; j++) sum += K[i][j] * x[j];
      expect(sum).toBeCloseTo(b[i], 3);
    }
  });
});

// ── gpPredict ──

describe("gpPredict", () => {
  it("returns prior with empty training set", () => {
    const results = gpPredict([], [], [0, 60, 120], hp);
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.mean).toBe(0);
      expect(r.variance).toBe(hp.signalVariance);
    }
  });

  it("returns single prediction for single test point", () => {
    const results = gpPredict([60], [10], [60], hp);
    expect(results).toHaveLength(1);
  });

  it("zero residuals → ~0 correction everywhere", () => {
    const trainX = [60, 120, 180];
    const trainY = [0, 0, 0];
    const testX = [0, 60, 90, 120, 180, 240];
    const results = gpPredict(trainX, trainY, testX, hp);
    for (const r of results) {
      expect(Math.abs(r.mean)).toBeLessThan(0.01);
    }
  });

  it("matches training data closely at training points", () => {
    // Use low noise to ensure close recovery
    const lowNoise: GPHyperparams = { ...hp, noiseVariance: 0.01 };
    const trainX = [60, 180];
    const trainY = [15, -10];
    const results = gpPredict(trainX, trainY, trainX, lowNoise);
    // At training points with low noise, GP mean should be close to training values
    expect(results[0].mean).toBeCloseTo(15, 0);
    expect(results[1].mean).toBeCloseTo(-10, 0);
  });

  it("has low variance near training data", () => {
    const trainX = [60, 120, 180];
    const trainY = [5, -3, 8];
    const nearTrain = gpPredict(trainX, trainY, [60, 120, 180], hp);
    const farFromTrain = gpPredict(trainX, trainY, [500, 800, 1200], hp);

    for (const r of nearTrain) {
      expect(r.variance).toBeLessThan(hp.signalVariance * 0.5);
    }
    for (const r of farFromTrain) {
      expect(r.variance).toBeGreaterThan(nearTrain[0].variance);
    }
  });

  it("has high variance far from training data", () => {
    const results = gpPredict([60], [10], [10000], hp);
    // Far from the single training point, variance should be close to prior
    expect(results[0].variance).toBeCloseTo(hp.signalVariance, -1);
  });

  it("interpolates between training points", () => {
    const trainX = [0, 120];
    const trainY = [20, 20]; // both positive, same value
    const results = gpPredict(trainX, trainY, [60], hp);
    // Midpoint should be pulled positive
    expect(results[0].mean).toBeGreaterThan(0);
  });

  it("variance is always non-negative", () => {
    const trainX = [0, 10, 20, 30, 40, 50];
    const trainY = [1, 2, 3, 4, 5, 6];
    const testX = Array.from({ length: 20 }, (_, i) => i * 5);
    const results = gpPredict(trainX, trainY, testX, hp);
    for (const r of results) {
      expect(r.variance).toBeGreaterThanOrEqual(0);
    }
  });

  it("works with single observation", () => {
    const results = gpPredict([100], [5], [80, 100, 120], hp);
    expect(results).toHaveLength(3);
    // At training point
    expect(results[1].mean).toBeCloseTo(5, 0);
    // Symmetric around training point
    expect(results[0].variance).toBeCloseTo(results[2].variance, 2);
  });
});

// ── defaultHyperparams ──

describe("defaultHyperparams", () => {
  it("returns expected defaults", () => {
    const hp = defaultHyperparams();
    expect(hp.lengthScale).toBe(30);
    expect(hp.signalVariance).toBe(400);
    expect(hp.noiseVariance).toBe(25);
  });
});
