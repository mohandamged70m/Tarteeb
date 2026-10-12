export const CURRENCIES = [
  { code: "EGP", label: "EGP — Egyptian pound" },
  { code: "USD", label: "USD — US dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British pound" },
  { code: "SAR", label: "SAR — Saudi riyal" },
  { code: "AED", label: "AED — UAE dirham" },
  { code: "QAR", label: "QAR — Qatari riyal" },
  { code: "KWD", label: "KWD — Kuwaiti dinar" },
] as const;

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
