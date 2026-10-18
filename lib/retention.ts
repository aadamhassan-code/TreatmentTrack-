/** Retention periods an owner can choose (months of inactivity before automatic erasure). */
export const RETENTION_CHOICES = [12, 24, 36, 60, 84] as const;

export function retentionLabel(months: number): string {
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} year${years === 1 ? "" : "s"}`;
  }
  return `${months} months`;
}
