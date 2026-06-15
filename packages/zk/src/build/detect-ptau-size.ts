export function ptauSizeForConstraints(constraintCount: number): number {
  const needed = Math.ceil(Math.log2(Math.max(constraintCount, 1))) + 1;
  return Math.min(Math.max(needed, 8), 28);
}
