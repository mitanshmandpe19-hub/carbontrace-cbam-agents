import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-center text-base font-bold transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 min-h-[44px] px-4 py-2.5',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--ct-exporter-btn)] text-white hover:bg-[var(--ct-exporter-btn-hover)] shadow-sm',
        secondary:
          'bg-[var(--ct-exporter-soft)] text-[var(--ct-exporter-text)] border border-[var(--ct-exporter-border)] hover:opacity-90',
        outline:
          'bg-[var(--ct-surface)] text-[var(--ct-ink)] border border-[var(--ct-border-strong)] hover:bg-[var(--ct-surface-raised)]',
        ghost:
          'text-[var(--ct-ink)] hover:bg-[var(--ct-surface-raised)]',
        magenta:
          'bg-[var(--ct-verifier-btn)] text-white hover:bg-[var(--ct-verifier-btn-hover)] shadow-sm',
        teal:
          'bg-[var(--ct-outreach-btn)] text-white hover:bg-[var(--ct-outreach-btn-hover)] shadow-sm',
        blue:
          'bg-[var(--ct-collector-btn)] text-white hover:bg-[var(--ct-collector-btn-hover)] shadow-sm',
        orange:
          'bg-[var(--ct-calculator-btn)] text-white hover:bg-[var(--ct-calculator-btn-hover)] shadow-sm',
        gradient:
          'ct-gradient-btn shadow-sm border border-[#D81B60]/20',
      },
      size: {
        default: 'min-h-[44px] px-4 py-2.5 text-base font-bold',
        sm: 'min-h-[44px] px-3.5 py-2 text-base font-bold rounded-xl',
        lg: 'min-h-[52px] px-6 py-3 text-base font-bold rounded-2xl',
        icon: 'min-h-[44px] min-w-[44px] p-2.5 text-base font-bold rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
