export interface BundleBudget {
  name: string;
  file: string;
  limitBytes: number;
}

export interface BundleBudgetArtifact extends BundleBudget {
  bytes: number | null;
}

export interface SourcemapArtifact {
  file: string;
  bytes: number;
}

export interface BundleBudgetResult {
  ok: boolean;
  artifacts: BundleBudgetArtifact[];
  failures: BundleBudgetArtifact[];
  sourcemaps: SourcemapArtifact[];
}

export const BUNDLE_BUDGETS: BundleBudget[];

export function checkBundleBudget(options?: { distPath?: string }): Promise<BundleBudgetResult>;
