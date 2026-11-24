'use client';

import * as React from 'react';

export interface SourceTarget {
  recordId?: string;
  documentId?: string;
  page?: number;
  title?: string;
}

interface SourceViewerContextValue {
  target: SourceTarget | null;
  openSource: (target: SourceTarget) => void;
  closeSource: () => void;
}

const SourceViewerContext = React.createContext<SourceViewerContextValue | null>(
  null
);

export function SourceViewerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [target, setTarget] = React.useState<SourceTarget | null>(null);

  const openSource = React.useCallback((next: SourceTarget) => {
    setTarget(next);
  }, []);

  const closeSource = React.useCallback(() => {
    setTarget(null);
  }, []);

  return (
    <SourceViewerContext.Provider value={{ target, openSource, closeSource }}>
      {children}
    </SourceViewerContext.Provider>
  );
}

export function useSourceViewer(): SourceViewerContextValue {
  const ctx = React.useContext(SourceViewerContext);
  if (!ctx) {
    throw new Error('useSourceViewer must be used within SourceViewerProvider');
  }
  return ctx;
}

