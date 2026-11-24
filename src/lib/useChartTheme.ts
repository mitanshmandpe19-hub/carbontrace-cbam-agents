'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';

export interface ChartThemeColors {
  isDark: boolean;
  gridStroke: string;
  tickPrimary: string;
  tickSecondary: string;
  tooltipContentStyle: React.CSSProperties;
  tooltipItemStyle: React.CSSProperties;
  tooltipLabelStyle: React.CSSProperties;
  legendStyle: React.CSSProperties;
  cursorFill: string;
  defaultLineStroke: string;
  defaultLabelFill: string;
  seriesColors: {
    fuel: string;
    power: string;
    inputs: string;
    total: string;
  };
}

export function useChartTheme(): ChartThemeColors {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return React.useMemo<ChartThemeColors>(() => {
    if (isDark) {
      return {
        isDark: true,
        gridStroke: 'rgba(255, 255, 255, 0.14)',
        tickPrimary: '#FFFFFF',
        tickSecondary: '#B5B5B5',
        tooltipContentStyle: {
          backgroundColor: '#1C1C1C',
          borderColor: '#404040',
          color: '#FFFFFF',
          borderRadius: '12px',
          fontSize: '14px',
        },
        tooltipItemStyle: { color: '#FFFFFF', fontSize: '14px' },
        tooltipLabelStyle: { color: '#FFE082', fontWeight: 700, fontSize: '14px' },
        legendStyle: { fontSize: 14, color: '#FFFFFF' },
        cursorFill: 'rgba(255, 255, 255, 0.06)',
        defaultLineStroke: '#FF5294',
        defaultLabelFill: '#FF94BE',
        seriesColors: {
          fuel: '#FF9838',
          power: '#5BA4FC',
          inputs: '#2DD4BF',
          total: '#C084FC',
        },
      };
    }

    return {
      isDark: false,
      gridStroke: 'rgba(42, 23, 64, 0.10)',
      tickPrimary: '#2A1740',
      tickSecondary: '#5B4B6E',
      tooltipContentStyle: {
        backgroundColor: '#FFFFFF',
        borderColor: 'rgba(42, 23, 64, 0.15)',
        color: '#2A1740',
        borderRadius: '12px',
        fontSize: '14px',
      },
      tooltipItemStyle: { color: '#2A1740', fontSize: '14px' },
      tooltipLabelStyle: { color: '#2A1740', fontWeight: 700, fontSize: '14px' },
      legendStyle: { fontSize: 14, color: '#2A1740' },
      cursorFill: 'rgba(106, 27, 154, 0.06)',
      defaultLineStroke: '#D81B60',
      defaultLabelFill: '#AD1457',
      seriesColors: {
        fuel: '#EF6C00',
        power: '#1E63B5',
        inputs: '#00897B',
        total: '#6A1B9A',
      },
    };
  }, [isDark]);
}

