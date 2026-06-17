import { describe, expect, it } from 'vitest';
import {
  computeHomography,
  createCssQuadTransform,
  matrix3dFromHomography,
  type Matrix3x3,
  type Point,
  type Quad,
} from '../../../src/overlays/html/homography.ts';

const EPSILON = 1e-7;
const CORNERS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const;

function applyMatrix(matrix: Matrix3x3, point: Point): Point {
  const denominator = matrix[2][0] * point.x + matrix[2][1] * point.y + matrix[2][2];

  return {
    x: (matrix[0][0] * point.x + matrix[0][1] * point.y + matrix[0][2]) / denominator,
    y: (matrix[1][0] * point.x + matrix[1][1] * point.y + matrix[1][2]) / denominator,
  };
}

function expectPointClose(actual: Point, expected: Point, epsilon = EPSILON): void {
  expect(actual.x).toBeCloseTo(expected.x, Math.ceil(-Math.log10(epsilon)));
  expect(actual.y).toBeCloseTo(expected.y, Math.ceil(-Math.log10(epsilon)));
}

function expectMatrixMapsQuad(source: Quad, destination: Quad, epsilon = EPSILON): void {
  const matrix = computeHomography(source, destination);
  expect(matrix).not.toBeNull();

  for (const corner of CORNERS) {
    expectPointClose(
      applyMatrix(matrix as Matrix3x3, source[corner]),
      destination[corner],
      epsilon,
    );
  }
}

function matrixFromCssMatrix3d(transform: string): Matrix3x3 {
  expect(transform.startsWith('matrix3d(')).toBe(true);

  const values = transform
    .slice('matrix3d('.length, -1)
    .split(',')
    .map((value) => Number(value.trim()));

  expect(values).toHaveLength(16);
  expect(values.every(Number.isFinite)).toBe(true);

  return [
    [values[0], values[4], values[12]],
    [values[1], values[5], values[13]],
    [values[3], values[7], values[15]],
  ];
}

function expectCssPlacementMapsQuad(
  placement: NonNullable<ReturnType<typeof createCssQuadTransform>>,
  destination: Quad,
  epsilon = 1e-6,
): void {
  const matrix = matrixFromCssMatrix3d(placement.transform);
  const elementQuad: Quad = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: placement.width, y: 0 },
    bottomRight: { x: placement.width, y: placement.height },
    bottomLeft: { x: 0, y: placement.height },
  };

  for (const corner of CORNERS) {
    const transformed = applyMatrix(matrix, elementQuad[corner]);
    expectPointClose(
      {
        x: placement.left + transformed.x,
        y: placement.top + transformed.y,
      },
      destination[corner],
      epsilon,
    );
  }
}

describe('computeHomography', () => {
  it('maps an identity rectangle to itself', () => {
    const source: Quad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 200, y: 0 },
      bottomRight: { x: 200, y: 100 },
      bottomLeft: { x: 0, y: 100 },
    };

    expectMatrixMapsQuad(source, source);
  });

  it('maps a rectangle through translation', () => {
    const source: Quad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 120, y: 0 },
      bottomRight: { x: 120, y: 80 },
      bottomLeft: { x: 0, y: 80 },
    };
    const destination: Quad = {
      topLeft: { x: 37, y: 49 },
      topRight: { x: 157, y: 49 },
      bottomRight: { x: 157, y: 129 },
      bottomLeft: { x: 37, y: 129 },
    };

    expectMatrixMapsQuad(source, destination);
  });

  it('maps a rectangle through scale', () => {
    const source: Quad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 50, y: 0 },
      bottomRight: { x: 50, y: 40 },
      bottomLeft: { x: 0, y: 40 },
    };
    const destination: Quad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 150, y: 0 },
      bottomRight: { x: 150, y: 80 },
      bottomLeft: { x: 0, y: 80 },
    };

    expectMatrixMapsQuad(source, destination);
  });

  it('maps a rectangle to a projected tilted quadrilateral', () => {
    const source: Quad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 300, y: 0 },
      bottomRight: { x: 300, y: 180 },
      bottomLeft: { x: 0, y: 180 },
    };
    const destination: Quad = {
      topLeft: { x: 82, y: 41 },
      topRight: { x: 365, y: 73 },
      bottomRight: { x: 316, y: 222 },
      bottomLeft: { x: 46, y: 184 },
    };

    expectMatrixMapsQuad(source, destination, 1e-6);
  });

  it('returns null for singular or non-finite input', () => {
    const source: Quad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 0, y: 0 },
      bottomRight: { x: 0, y: 0 },
      bottomLeft: { x: 0, y: 0 },
    };
    const destination: Quad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 100, y: 0 },
      bottomRight: { x: 100, y: 100 },
      bottomLeft: { x: 0, y: 100 },
    };

    expect(computeHomography(source, destination)).toBeNull();
    expect(
      computeHomography(destination, {
        ...destination,
        bottomRight: { x: Number.POSITIVE_INFINITY, y: 100 },
      }),
    ).toBeNull();
    expect(
      computeHomography(destination, {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 50, y: 50 },
        bottomRight: { x: 100, y: 100 },
        bottomLeft: { x: 150, y: 150 },
      }),
    ).toBeNull();
  });
});

describe('matrix3dFromHomography', () => {
  it('outputs finite CSS matrix3d values', () => {
    const matrix: Matrix3x3 = [
      [1.25, 0.1, 20],
      [0.2, 0.8, 30],
      [0.001, -0.002, 1],
    ];

    const css = matrix3dFromHomography(matrix);
    const values = css
      .slice('matrix3d('.length, -1)
      .split(',')
      .map((value) => Number(value.trim()));

    expect(css.startsWith('matrix3d(')).toBe(true);
    expect(values).toHaveLength(16);
    expect(values.every(Number.isFinite)).toBe(true);
  });

  it('sanitizes non-finite matrix values', () => {
    const css = matrix3dFromHomography([
      [1, Number.NaN, 0],
      [0, 1, Number.POSITIVE_INFINITY],
      [0, 0, 1],
    ]);
    const values = css
      .slice('matrix3d('.length, -1)
      .split(',')
      .map((value) => Number(value.trim()));

    expect(values).toHaveLength(16);
    expect(values.every(Number.isFinite)).toBe(true);
  });
});

describe('createCssQuadTransform', () => {
  it('creates a source-sized transform positioned at the destination footprint', () => {
    const sourceRect = { width: 200, height: 100 };
    const destination: Quad = {
      topLeft: { x: 50, y: 20 },
      topRight: { x: 260, y: 35 },
      bottomRight: { x: 240, y: 155 },
      bottomLeft: { x: 38, y: 132 },
    };
    const result = createCssQuadTransform(sourceRect, destination);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      left: 38,
      top: 20,
      width: sourceRect.width,
      height: sourceRect.height,
      boundsWidth: 222,
      boundsHeight: 135,
      transformOrigin: '0 0',
    });
    expect(result?.transform.startsWith('matrix3d(')).toBe(true);
    expectCssPlacementMapsQuad(result!, destination);
  });

  it('recalculates a different transform when projected pitch corners change', () => {
    const sourceRect = { width: 320, height: 180 };
    const flat = createCssQuadTransform(sourceRect, {
      topLeft: { x: 100, y: 100 },
      topRight: { x: 420, y: 100 },
      bottomRight: { x: 420, y: 280 },
      bottomLeft: { x: 100, y: 280 },
    });
    const pitched = createCssQuadTransform(sourceRect, {
      topLeft: { x: 132, y: 116 },
      topRight: { x: 396, y: 126 },
      bottomRight: { x: 450, y: 286 },
      bottomLeft: { x: 76, y: 272 },
    });

    expect(flat).not.toBeNull();
    expect(pitched).not.toBeNull();
    expect(pitched?.transform).not.toBe(flat?.transform);
    expect(flat).toMatchObject({
      width: sourceRect.width,
      height: sourceRect.height,
      transformOrigin: '0 0',
    });
    expect(pitched).toMatchObject({
      width: sourceRect.width,
      height: sourceRect.height,
      transformOrigin: '0 0',
    });

    const flatDestination: Quad = {
      topLeft: { x: 100, y: 100 },
      topRight: { x: 420, y: 100 },
      bottomRight: { x: 420, y: 280 },
      bottomLeft: { x: 100, y: 280 },
    };
    const pitchedDestination: Quad = {
      topLeft: { x: 132, y: 116 },
      topRight: { x: 396, y: 126 },
      bottomRight: { x: 450, y: 286 },
      bottomLeft: { x: 76, y: 272 },
    };

    expectCssPlacementMapsQuad(flat!, flatDestination);
    expectCssPlacementMapsQuad(pitched!, pitchedDestination);
  });

  it('returns null for zero-area or too-small inputs', () => {
    const destination: Quad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 100, y: 0 },
      bottomRight: { x: 100, y: 100 },
      bottomLeft: { x: 0, y: 100 },
    };

    expect(createCssQuadTransform({ width: 0, height: 100 }, destination)).toBeNull();
    expect(createCssQuadTransform({ width: 100, height: 0 }, destination)).toBeNull();
    expect(
      createCssQuadTransform(
        { width: 100, height: 100 },
        {
          topLeft: { x: 5, y: 5 },
          topRight: { x: 5, y: 5 },
          bottomRight: { x: 5, y: 5 },
          bottomLeft: { x: 5, y: 5 },
        },
      ),
    ).toBeNull();
    expect(
      createCssQuadTransform(
        { width: 100, height: 100 },
        {
          topLeft: { x: 0, y: 0 },
          topRight: { x: 50, y: 50 },
          bottomRight: { x: 100, y: 100 },
          bottomLeft: { x: 150, y: 150 },
        },
      ),
    ).toBeNull();
  });
});
