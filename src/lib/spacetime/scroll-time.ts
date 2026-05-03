export type TimeScrollState = {
  year: number;
  minYear: number;
  maxYear: number;
  spinDirection: 1 | -1;
};

export function clampYear(year: number, minYear: number, maxYear: number): number {
  return Math.min(maxYear, Math.max(minYear, year));
}

export function yearFromWheelDelta(
  currentYear: number,
  deltaY: number,
  minYear: number,
  maxYear: number,
  yearsPerWheelStep = 5,
): number {
  const direction = deltaY > 0 ? 1 : -1;
  return clampYear(currentYear + direction * yearsPerWheelStep, minYear, maxYear);
}

export function spinDirectionFromYears(previousYear: number, nextYear: number): 1 | -1 {
  return nextYear >= previousYear ? 1 : -1;
}
