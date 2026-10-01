const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes since midnight (0-1439) from `?time=HH:MM`; null when absent or invalid. */
export function parseTimeParam(search: string): number | null {
  const value = new URLSearchParams(search).get('time');
  if (value === null) return null;
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Local minutes since midnight for the given date. */
export function currentMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}
