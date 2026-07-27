/**
 * Shared “open now” parsing for working-hours strings like "9:00 AM - 5:00 PM".
 */
export function isBusinessOpenNow(workingHours: string): boolean | null {
  try {
    const cleaned = String(workingHours || '').replace(/\(.*?\)/g, '').trim();
    const parts = cleaned.split('-').map((s) => s.trim());
    if (parts.length < 2) return null;
    const parseTime = (str: string) => {
      const m = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!m) return null;
      let h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const period = m[3].toUpperCase();
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + min;
    };
    const open = parseTime(parts[0]);
    const close = parseTime(parts[1]);
    if (open === null || close === null) return null;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    if (close < open) return cur >= open || cur <= close;
    return cur >= open && cur <= close;
  } catch {
    return null;
  }
}
