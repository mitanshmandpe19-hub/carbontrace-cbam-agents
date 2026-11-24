import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        'flex min-h-[44px] w-full rounded-xl border border-[var(--ct-border-strong)] bg-[var(--ct-surface)] px-4 py-2.5 text-base text-[var(--ct-ink)] placeholder:text-[var(--ct-ink-secondary)] focus:border-[var(--ct-exporter)] focus:outline-none',
        className
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';
