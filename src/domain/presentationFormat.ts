export type PolishPluralForms = readonly [singular: string, paucal: string, plural: string];

export function formatPolishCount(count: number, forms: PolishPluralForms): string {
  const absolute = Math.abs(count);
  const lastTwoDigits = absolute % 100;
  const lastDigit = absolute % 10;
  const form = absolute === 1
    ? forms[0]
    : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
      ? forms[1]
      : forms[2];
  return `${count} ${form}`;
}

export function formatPolishDate(value: string | Date, style: "short" | "long" = "short"): string {
  const date = value instanceof Date ? value : parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const options: Intl.DateTimeFormatOptions = style === "long"
    ? { day: "numeric", month: "long", year: "numeric" }
    : { day: "numeric", month: "short" };
  return new Intl.DateTimeFormat("pl-PL", options).format(date);
}

export function formatPolishMonth(value: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return value;
  return new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" })
    .format(new Date(Number(match[1]), Number(match[2]) - 1, 1, 12));
}

function parseLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : new Date(Number.NaN);
}
