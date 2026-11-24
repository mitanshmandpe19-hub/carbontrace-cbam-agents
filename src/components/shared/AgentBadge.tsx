import * as React from 'react';
import { Bot, Calculator, FileSearch, MessageCircle, ShieldAlert, UserCheck } from 'lucide-react';
import { AGENT_METADATA } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { AgentRole } from '@/types';

const ICONS: Record<AgentRole, React.ComponentType<{ className?: string }>> = {
  collector: FileSearch,
  outreach: MessageCircle,
  calculator: Calculator,
  verifier: ShieldAlert,
  exporter: UserCheck,
};

export function AgentBadge({
  agent,
  className,
}: {
  agent: AgentRole | 'system';
  className?: string;
}) {
  if (agent === 'system') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-[var(--ct-border)] bg-[var(--ct-surface-raised)] px-3 py-1 text-[14px] font-semibold leading-snug text-[var(--ct-ink)]',
          className
        )}
      >
        <Bot className="h-4 w-4" aria-hidden="true" />
        System
      </span>
    );
  }

  const meta = AGENT_METADATA[agent];
  const Icon = ICONS[agent];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[14px] font-semibold leading-snug',
        meta.bgClass,
        meta.textClass,
        meta.borderClass,
        className
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{meta.name}</span>
    </span>
  );
}
