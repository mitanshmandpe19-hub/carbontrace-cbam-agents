import * as React from 'react';
import { cn } from '@/lib/utils';

export function Progress({
  value,
  label,
  barColorClass = 'bg-[var(--ct-exporter)]',
  className,
}: {
  value: number;
  label?: string;
  barColorClass?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
      className={cn('h-2.5 w-full overflow-hidden rounded-full bg-[var(--ct-skeleton)]', className)}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-300', barColorClass)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
