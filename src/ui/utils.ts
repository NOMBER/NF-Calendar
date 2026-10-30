export const classList = (obj: Record<string, boolean>): string[] => {
  return Object.entries(obj)
    .filter(([_k, v]) => !!v)
    .map(([k, _k]) => k);
};

export function clamp(num: number, lowerBound: number, upperBound: number): number {
  return Math.min(Math.max(lowerBound, num), upperBound);
}

export function partition(
  arr: string[],
  predicate: (elem: string) => boolean,
): [string[], string[]] {
  const pass = [];
  const fail = [];

  arr.forEach((elem) => {
    if (predicate(elem)) {
      pass.push(elem);
    } else {
      fail.push(elem);
    }
  });

  return [pass, fail];
}
