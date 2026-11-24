'use client';

import * as React from 'react';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/components/auth/AuthContext';
import { FeedbackProvider } from '@/components/shared/FeedbackProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="carbontrace-theme"
    >
      <AuthProvider>
        <FeedbackProvider>{children}</FeedbackProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
