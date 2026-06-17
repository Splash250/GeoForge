export type Point = {
  x: number;
  y: number;
};

export type Quad = {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
};

export type Matrix3x3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

export type SourceRect = {
  width: number;
  height: number;
};

export type CssQuadTransform = {
  width: number;
  height: number;
  boundsWidth: number;
  boundsHeight: number;
  left: number;
  top: number;
  transform: string;
  transformOrigin: '0 0';
};

const MIN_SIZE = 1e-8;
const PIVOT_EPSILON = 1e-12;

function quadPoints(quad: Quad): [Point, Point, Point, Point] {
  return [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
}

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function isFiniteQuad(quad: Quad): boolean {
  return quadPoints(quad).every(isFinitePoint);
}

function isFiniteMatrix(matrix: Matrix3x3): boolean {
  return matrix.every((row) => row.every(Number.isFinite));
}

function determinant3x3(matrix: Matrix3x3): number {
  return (
    matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
    matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
    matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0])
  );
}

function solveLinearSystem(matrix: number[][], values: number[]): number[] | null {
  const size = values.length;
  const augmented = matrix.map((row, index) => [...row, values[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    let pivotValue = Math.abs(augmented[column][column]);

    for (let row = column + 1; row < size; row += 1) {
      const candidate = Math.abs(augmented[row][column]);

      if (candidate > pivotValue) {
        pivotValue = candidate;
        pivotRow = row;
      }
    }

    if (pivotValue <= PIVOT_EPSILON) {
      return null;
    }

    if (pivotRow !== column) {
      [augmented[column], augmented[pivotRow]] = [augmented[pivotRow], augmented[column]];
    }

    const pivot = augmented[column][column];

    for (let entry = column; entry <= size; entry += 1) {
      augmented[column][entry] /= pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }

      const factor = augmented[row][column];

      if (factor === 0) {
        continue;
      }

      for (let entry = column; entry <= size; entry += 1) {
        augmented[row][entry] -= factor * augmented[column][entry];
      }
    }
  }

  const solution = augmented.map((row) => row[size]);

  return solution.every(Number.isFinite) ? solution : null;
}

export function computeHomography(source: Quad, destination: Quad): Matrix3x3 | null {
  if (!isFiniteQuad(source) || !isFiniteQuad(destination)) {
    return null;
  }

  const sourcePoints = quadPoints(source);
  const destinationPoints = quadPoints(destination);
  const matrix: number[][] = [];
  const values: number[] = [];

  for (let index = 0; index < sourcePoints.length; index += 1) {
    const { x, y } = sourcePoints[index];
    const target = destinationPoints[index];

    matrix.push([x, y, 1, 0, 0, 0, -x * target.x, -y * target.x]);
    values.push(target.x);

    matrix.push([0, 0, 0, x, y, 1, -x * target.y, -y * target.y]);
    values.push(target.y);
  }

  const solution = solveLinearSystem(matrix, values);

  if (!solution) {
    return null;
  }

  const homography: Matrix3x3 = [
    [solution[0], solution[1], solution[2]],
    [solution[3], solution[4], solution[5]],
    [solution[6], solution[7], 1],
  ];

  if (!isFiniteMatrix(homography) || Math.abs(determinant3x3(homography)) <= PIVOT_EPSILON) {
    return null;
  }

  return homography;
}

export function matrix3dFromHomography(matrix: Matrix3x3): string {
  if (!isFiniteMatrix(matrix)) {
    return 'matrix3d(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1)';
  }

  const values = [
    matrix[0][0],
    matrix[1][0],
    0,
    matrix[2][0],
    matrix[0][1],
    matrix[1][1],
    0,
    matrix[2][1],
    0,
    0,
    1,
    0,
    matrix[0][2],
    matrix[1][2],
    0,
    matrix[2][2],
  ];

  return `matrix3d(${values.join(', ')})`;
}

export function createCssQuadTransform(
  sourceRect: SourceRect,
  destinationQuad: Quad,
): CssQuadTransform | null {
  if (
    !Number.isFinite(sourceRect.width) ||
    !Number.isFinite(sourceRect.height) ||
    sourceRect.width <= MIN_SIZE ||
    sourceRect.height <= MIN_SIZE ||
    !isFiniteQuad(destinationQuad)
  ) {
    return null;
  }

  const destinationPoints = quadPoints(destinationQuad);
  const xValues = destinationPoints.map((point) => point.x);
  const yValues = destinationPoints.map((point) => point.y);
  const left = Math.min(...xValues);
  const top = Math.min(...yValues);
  const boundsWidth = Math.max(...xValues) - left;
  const boundsHeight = Math.max(...yValues) - top;

  if (boundsWidth <= MIN_SIZE || boundsHeight <= MIN_SIZE) {
    return null;
  }

  const sourceQuad: Quad = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: sourceRect.width, y: 0 },
    bottomRight: { x: sourceRect.width, y: sourceRect.height },
    bottomLeft: { x: 0, y: sourceRect.height },
  };
  const relativeDestination: Quad = {
    topLeft: { x: destinationQuad.topLeft.x - left, y: destinationQuad.topLeft.y - top },
    topRight: { x: destinationQuad.topRight.x - left, y: destinationQuad.topRight.y - top },
    bottomRight: {
      x: destinationQuad.bottomRight.x - left,
      y: destinationQuad.bottomRight.y - top,
    },
    bottomLeft: {
      x: destinationQuad.bottomLeft.x - left,
      y: destinationQuad.bottomLeft.y - top,
    },
  };
  const matrix = computeHomography(sourceQuad, relativeDestination);

  if (!matrix) {
    return null;
  }

  return {
    width: sourceRect.width,
    height: sourceRect.height,
    boundsWidth,
    boundsHeight,
    left,
    top,
    transform: matrix3dFromHomography(matrix),
    transformOrigin: '0 0',
  };
}
