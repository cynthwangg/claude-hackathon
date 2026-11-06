export function today(): Date {
  const d = process.env.DEMO_TODAY;
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(`${d}T12:00:00Z`);
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

export const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86400000);

export const parseDay = (s: string) => new Date(`${s.slice(0, 10)}T12:00:00Z`);
