/** toFixed that never prints negative zero ("-0.00" for a score of -0.002). */
export function fmt(v: number, decimals = 2): string {
  const s = v.toFixed(decimals);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
}

/** A penalty shown with a minus sign, or plain 0.00 when it rounds to nothing. */
export function fmtPenalty(v: number, decimals = 2): string {
  const s = v.toFixed(decimals);
  return Number(s) === 0 ? s.replace("-", "") : `−${s.replace("-", "")}`;
}
