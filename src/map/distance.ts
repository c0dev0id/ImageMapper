/** A distance in metres as shown on the map: whole metres below a kilometre, else kilometres to three significant digits. */
export function formatDistance(metres: number): string {
  if (metres < 999.5) return `${Math.round(metres)} m`
  const km = metres / 1000
  const digits = km < 9.995 ? 2 : km < 99.95 ? 1 : 0
  return `${km.toFixed(digits)} km`
}
