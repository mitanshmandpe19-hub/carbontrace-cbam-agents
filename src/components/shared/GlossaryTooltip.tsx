'use client';

import * as React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { HelpCircle } from 'lucide-react';
import { GLOSSARY_TERMS } from '@/lib/formatters';
import { cn } from '@/lib/utils';

export function GlossaryProvider({ children }: { children: React.ReactNode }) {
  return <Tooltip.Provider delayDuration={180}>{children}</Tooltip.Provider>;
}

export function GlossaryTooltip({
  term,
  label,
  className,
}: {
  term: keyof typeof GLOSSARY_TERMS;
  label?: string;
  className?: string;
}) {
  const explanation = GLOSSARY_TERMS[term];
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 rounded-md border-b border-dashed border-[var(--ct-exporter)]/60 px-0.5 text-left font-medium text-[var(--ct-ink)] hover:text-[var(--ct-exporter-text)] min-h-[24px] cursor-pointer',
            className
          )}
          aria-label={`What does ${label ?? term} mean? ${explanation}`}
        >
          <span>{label ?? term}</span>
          <HelpCircle className="h-3.5 w-3.5 shrink-0 text-[var(--ct-exporter)]" aria-hidden="true" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="z-50 max-w-sm rounded-xl border border-[var(--ct-tooltip-border)] bg-[var(--ct-tooltip-bg)] px-4 py-3 text-[14px] leading-relaxed text-[var(--ct-tooltip-ink)] shadow-xl"
        >
          <p className="font-bold capitalize text-[var(--ct-tooltip-accent)]">{label ?? term}</p>
          <p className="mt-1 text-[var(--ct-tooltip-ink)]">{explanation}</p>
          <Tooltip.Arrow className="fill-[var(--ct-tooltip-bg)]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
