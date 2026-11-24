'use client';

import * as React from 'react';

export function useDemoQuery<T>(fetcher: () => Promise<T>) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load data.');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  React.useEffect(() => {
    let active = true;
    fetcher()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load data.');
        setLoading(false);
      });

    const onReset = () => {
      void refetch();
    };
    window.addEventListener('carbontrace:demo-reset', onReset);
    return () => {
      active = false;
      window.removeEventListener('carbontrace:demo-reset', onReset);
    };
  }, [fetcher, refetch]);

  return { data, setData, loading, error, refetch };
}

