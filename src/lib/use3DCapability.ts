'use client';

import * as React from 'react';

export interface CapabilityState {
  supported: boolean;
  prefersReducedMotion: boolean;
  weakDevice: boolean;
  shouldRender3D: boolean;
  paused: boolean;
  manual2D: boolean;
  setPaused: React.Dispatch<React.SetStateAction<boolean>>;
  setManual2D: React.Dispatch<React.SetStateAction<boolean>>;
}

function detectWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

function detectWeakDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  return cores <= 2 || mem <= 2;
}

const subscribeNoop = () => () => {};

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function use3DCapability(): CapabilityState {
  const isClient = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const prefersReducedMotion = React.useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );

  const [paused, setPaused] = React.useState(false);
  const [manual2D, setManual2D] = React.useState(false);

  const supported = React.useMemo(() => (isClient ? detectWebGL() : false), [isClient]);
  const weakDevice = React.useMemo(
    () => (isClient ? detectWeakDevice() : false),
    [isClient]
  );

  const shouldRender3D =
    isClient && supported && !prefersReducedMotion && !weakDevice && !manual2D;

  return {
    supported,
    prefersReducedMotion,
    weakDevice,
    shouldRender3D,
    paused,
    manual2D,
    setPaused,
    setManual2D,
  };
}
