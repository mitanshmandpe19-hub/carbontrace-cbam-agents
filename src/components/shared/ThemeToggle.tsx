'use client';

import * as React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  function handleToggle() {
    setTheme(isDark ? 'light' : 'dark');
  }

  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            onClick={handleToggle}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-pressed={isDark}
            title="Light / Dark"
            className={cn(
              'inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-[var(--ct-border-strong)] bg-[var(--ct-surface)] text-[var(--ct-ink)] shadow-2xs hover:bg-[var(--ct-surface-raised)] cursor-pointer',
              className
            )}
          >
            {isDark ? (
              <Sun className="h-5 w-5 text-[#FFE082]" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5 text-[var(--ct-ink)]" aria-hidden="true" />
            )}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-50 rounded-xl border border-[var(--ct-tooltip-border)] bg-[var(--ct-tooltip-bg)] px-3.5 py-2 text-[14px] font-semibold text-[var(--ct-tooltip-ink)] shadow-lg"
          >
            Light / Dark
            <Tooltip.Arrow className="fill-[var(--ct-tooltip-bg)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

