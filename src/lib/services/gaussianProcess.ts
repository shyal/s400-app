// ── Gaussian Process regression (pure math, no domain logic) ──

export interface GPHyperparams {
  lengthScale: number; // correlation distance in minutes
  signalVariance: number; // (mg/dL)² — prior variance of the function
  noiseVariance: number; // (mg/dL)² — observation noise
}

export interface GPPrediction {
  mean: number;
  variance: number;
}

export function defaultHyperparams(): GPHyperparams {
  return {
    lengthScale: 30, // glucose dynamics ~30-60 min timescales
    signalVariance: 400, // parametric model could be off by ~20 mg/dL → (20)²
    noiseVariance: 25, // finger-prick accuracy ~5 mg/dL → (5)²
  };
}

/** Squared exponential (RBF) kernel */
export function rbfKernel(
  x1: number,
  x2: number,
  params: GPHyperparams,
): number {
  const diff = x1 - x2;
  return (
    params.signalVariance *
    Math.exp(-(diff * diff) / (2 * params.lengthScale * params.lengthScale))
  );
}

/** Build N×N kernel matrix with noise on diagonal */
export function buildKernelMatrix(
  X: number[],
  params: GPHyperparams,
): number[][] {
  const n = X.length;
  const K: number[][] = Array.from({ length: n }, () => new Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const k = rbfKernel(X[i], X[j], params);
      K[i][j] = k + (i === j ? params.noiseVariance : 0);
      K[j][i] = K[i][j];
    }
  }
  return K;
}

/** Cholesky decomposition: returns lower triangular L where A = L Lᵀ */
export function choleskyDecompose(A: number[][]): number[][] {
  const n = A.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const JITTER = 1e-6;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const diag = A[i][i] - sum;
        L[i][j] = Math.sqrt(Math.max(diag, JITTER));
      } else {
        L[i][j] = (A[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

/** Solve L x = b via forward substitution (L is lower triangular) */
function forwardSolve(L: number[][], b: number[]): number[] {
  const n = b.length;
  const x = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < i; j++) sum += L[i][j] * x[j];
    x[i] = (b[i] - sum) / L[i][i];
  }
  return x;
}

/** Solve Lᵀ x = b via back substitution */
function backSolve(L: number[][], b: number[]): number[] {
  const n = b.length;
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) sum += L[j][i] * x[j];
    x[i] = (b[i] - sum) / L[i][i];
  }
  return x;
}

/** Solve A x = b using Cholesky: L Lᵀ x = b */
export function choleskySolve(L: number[][], b: number[]): number[] {
  const y = forwardSolve(L, b);
  return backSolve(L, y);
}

/** GP prediction at test points given training data */
export function gpPredict(
  trainX: number[],
  trainY: number[],
  testX: number[],
  params: GPHyperparams,
): GPPrediction[] {
  const n = trainX.length;

  // No training data → prior (zero mean, full variance)
  if (n === 0) {
    return testX.map(() => ({ mean: 0, variance: params.signalVariance }));
  }

  // K = kernel(trainX, trainX) + noise·I
  const K = buildKernelMatrix(trainX, params);
  const L = choleskyDecompose(K);
  const alpha = choleskySolve(L, trainY); // K⁻¹ y

  return testX.map((x) => {
    // k* = kernel(trainX, x*)
    const kStar = trainX.map((xi) => rbfKernel(xi, x, params));

    // mean = k*ᵀ α
    let mean = 0;
    for (let i = 0; i < n; i++) mean += kStar[i] * alpha[i];

    // v = L⁻¹ k* (forward solve)
    const v = forwardSolve(L, kStar);
    let vSum = 0;
    for (let i = 0; i < n; i++) vSum += v[i] * v[i];

    // variance = k** - vᵀ v
    const kStarStar = params.signalVariance; // rbf(x*, x*) = signalVariance
    const variance = Math.max(0, kStarStar - vSum);

    return { mean, variance };
  });
}
