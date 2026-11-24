import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[14px] font-semibold leading-snug tracking-tight',
  {
    variants: {
      variant: {
        neutral:
          'border-[var(--ct-border)] bg-[var(--ct-surface-raised)] text-[var(--ct-ink)]',
        collector:
          'border-[var(--ct-collector-border)] bg-[var(--ct-collector-soft)] text-[var(--ct-collector-text)]',
        outreach:
          'border-[var(--ct-outreach-border)] bg-[var(--ct-outreach-soft)] text-[var(--ct-outreach-text)]',
        calculator:
          'border-[var(--ct-calculator-border)] bg-[var(--ct-calculator-soft)] text-[var(--ct-calculator-text)]',
        verifier:
          'border-[var(--ct-verifier-border)] bg-[var(--ct-verifier-soft)] text-[var(--ct-verifier-text)]',
        exporter:
          'border-[var(--ct-exporter-border)] bg-[var(--ct-exporter-soft)] text-[var(--ct-exporter-text)]',
        success:
          'border-[var(--ct-outreach-border)] bg-[var(--ct-outreach-soft)] text-[var(--ct-outreach-text)]',
        warning:
          'border-[var(--ct-calculator-border)] bg-[var(--ct-calculator-soft)] text-[var(--ct-calculator-text)]',
        danger:
          'border-[var(--ct-verifier-border)] bg-[var(--ct-verifier-soft)] text-[var(--ct-verifier-text)]',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
