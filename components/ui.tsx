import Link from "next/link";
import type { OrderStatus } from "@/lib/types";
import { ORDER_STATUS_META } from "@/lib/types";

export function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-ink-700 bg-ink-800 px-2 py-0.5 text-xs font-medium text-ink-300">
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-ink-700 bg-ink-900 px-5 py-8">
      <p className="text-sm font-semibold text-ink-100">{title}</p>
      {hint && <p className="max-w-md text-sm text-ink-500">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-ink-700 bg-ink-900 px-5 py-6">
      <p className="text-sm font-semibold text-ink-100">Something went wrong</p>
      <p className="text-sm text-ink-500">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-md border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-ink-100 hover:bg-ink-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-ink-300">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 hover:border-ink-500 focus:border-ink-100";

export const btnPrimary =
  "rounded-md bg-ink-100 px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhost =
  "rounded-md border border-ink-700 bg-ink-850 px-4 py-2 text-sm text-ink-300 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50";

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-100">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function OrderLink({ id, title }: { id: string; title: string }) {
  return (
    <Link href={`/orders/${id}`} className="font-medium text-ink-100 underline decoration-ink-500 underline-offset-2 hover:decoration-ink-100">
      {title}
    </Link>
  );
}
