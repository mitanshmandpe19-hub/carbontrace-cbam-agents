'use client';

import * as React from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Line, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { AGENT_METADATA } from '@/lib/formatters';
import type { AgentRole, PipelineState } from '@/types';

export interface EvidenceCubeSceneProps {
  variant: 'hero' | 'workspace';
  activeAgent?: AgentRole | null;
  runState?: PipelineState;
  hasVerifierBlocker?: boolean;
  paused?: boolean;
  isOnScreen?: boolean;
  isDark?: boolean;
}

const DARK_AGENT_COLORS: Record<AgentRole, string> = {
  collector: '#5BA4FC',
  outreach: '#2DD4BF',
  calculator: '#FF9838',
  verifier: '#FF5294',
  exporter: '#C084FC',
};

const AGENT_POSITIONS: Record<AgentRole, [number, number, number]> = {
  collector: [-2.15, 1.0, 0.2],
  outreach: [2.15, 1.0, -0.2],
  calculator: [-2.0, -1.0, -0.2],
  verifier: [2.0, -1.0, 0.2],
  exporter: [0, 1.85, 0],
};

const FOUR_AGENTS: AgentRole[] = ['collector', 'outreach', 'calculator', 'verifier'];

function CentralLedgerCube({
  variant,
  hasVerifierBlocker,
  paused,
  isDark,
}: {
  variant: 'hero' | 'workspace';
  hasVerifierBlocker: boolean;
  paused: boolean;
  isDark: boolean;
}) {
  const cubeRef = React.useRef<THREE.Mesh>(null);
  const ringRef = React.useRef<THREE.Mesh>(null);

  useFrame(({ clock }, delta) => {
    if (paused) return;
    if (cubeRef.current) {
      cubeRef.current.rotation.y += delta * (variant === 'hero' ? 0.42 : 0.24);
      cubeRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.8) * 0.14;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z -= delta * 0.35;
    }
  });

  const cubeColor = hasVerifierBlocker
    ? isDark
      ? '#FF5294'
      : '#D81B60'
    : isDark
      ? '#C084FC'
      : '#6A1B9A';

  return (
    <group>
      <Float speed={paused ? 0 : 1.6} rotationIntensity={0.12} floatIntensity={0.25}>
        <RoundedBox ref={cubeRef} args={[1.22, 1.22, 1.22]} radius={0.18} smoothness={4}>
          <meshStandardMaterial
            color={isDark ? '#1F1B2C' : '#FFFFFF'}
            emissive={cubeColor}
            emissiveIntensity={
              isDark
                ? hasVerifierBlocker
                  ? 0.92
                  : 0.72
                : hasVerifierBlocker
                  ? 0.34
                  : 0.22
            }
            roughness={isDark ? 0.18 : 0.22}
            metalness={isDark ? 0.28 : 0.14}
          />
        </RoundedBox>
      </Float>

      <mesh ref={ringRef} rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[1.08, 0.03, 16, 64]} />
        <meshStandardMaterial
          color={cubeColor}
          emissive={cubeColor}
          emissiveIntensity={isDark ? 1.05 : 0.48}
        />
      </mesh>
    </group>
  );
}

function FlyingCards({ paused, isDark }: { paused: boolean; isDark: boolean }) {
  const card1 = React.useRef<THREE.Mesh>(null);
  const card2 = React.useRef<THREE.Mesh>(null);
  const reportCard = React.useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (paused) return;
    const t = clock.getElapsedTime();

    const p1 = (t * 0.32) % 1;
    if (card1.current) {
      card1.current.position.set(
        THREE.MathUtils.lerp(-3.4, -0.5, p1),
        THREE.MathUtils.lerp(1.25, 0.1, p1) + Math.sin(p1 * Math.PI) * 0.35,
        THREE.MathUtils.lerp(0.5, 0, p1)
      );
      card1.current.rotation.z = (1 - p1) * 0.4;
      const s = p1 > 0.85 ? (1 - p1) / 0.15 : 1;
      card1.current.scale.setScalar(Math.max(0.05, s));
    }

    const p2 = (t * 0.32 + 0.5) % 1;
    if (card2.current) {
      card2.current.position.set(
        THREE.MathUtils.lerp(-3.2, -0.5, p2),
        THREE.MathUtils.lerp(-1.05, -0.1, p2) - Math.sin(p2 * Math.PI) * 0.28,
        THREE.MathUtils.lerp(-0.4, 0, p2)
      );
      card2.current.rotation.z = -(1 - p2) * 0.35;
      const s = p2 > 0.85 ? (1 - p2) / 0.15 : 1;
      card2.current.scale.setScalar(Math.max(0.05, s));
    }

    const pr = (t * 0.28 + 0.2) % 1;
    if (reportCard.current) {
      reportCard.current.position.set(
        THREE.MathUtils.lerp(0.65, 3.25, pr),
        THREE.MathUtils.lerp(0, 0.24, pr) + Math.sin(pr * Math.PI) * 0.2,
        THREE.MathUtils.lerp(0, 0.45, pr)
      );
      reportCard.current.rotation.y = pr * 0.45;
      const s = pr < 0.15 ? pr / 0.15 : pr > 0.85 ? (1 - pr) / 0.15 : 1;
      reportCard.current.scale.setScalar(Math.max(0.05, s));
    }
  });

  return (
    <group>
      <mesh ref={card1}>
        <boxGeometry args={[0.56, 0.38, 0.04]} />
        <meshStandardMaterial
          color={isDark ? '#3B82F6' : '#DCEAFD'}
          emissive={isDark ? '#5BA4FC' : '#1E63B5'}
          emissiveIntensity={isDark ? 0.78 : 0.35}
        />
      </mesh>
      <mesh ref={card2}>
        <boxGeometry args={[0.56, 0.38, 0.04]} />
        <meshStandardMaterial
          color={isDark ? '#F97316' : '#FFE9CF'}
          emissive={isDark ? '#FF9838' : '#EF6C00'}
          emissiveIntensity={isDark ? 0.78 : 0.35}
        />
      </mesh>
      <mesh ref={reportCard}>
        <boxGeometry args={[0.68, 0.48, 0.05]} />
        <meshStandardMaterial
          color={isDark ? '#A855F7' : '#EBD6F7'}
          emissive={isDark ? '#D81B60' : '#6A1B9A'}
          emissiveIntensity={isDark ? 0.95 : 0.5}
        />
      </mesh>
    </group>
  );
}

function AgentSpoke({
  role,
  variant,
  isActive,
  hasVerifierBlocker,
  paused,
  index,
  isDark,
}: {
  role: AgentRole;
  variant: 'hero' | 'workspace';
  isActive: boolean;
  hasVerifierBlocker: boolean;
  paused: boolean;
  index: number;
  isDark: boolean;
}) {
  const nodeRef = React.useRef<THREE.Group>(null);
  const pulseRef = React.useRef<THREE.Mesh>(null);
  const flagRef = React.useRef<THREE.Mesh>(null);
  const meta = AGENT_METADATA[role];
  const colorHex = isDark ? DARK_AGENT_COLORS[role] : meta.accentHex;
  const basePos = AGENT_POSITIONS[role];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!paused && nodeRef.current) {
      if (variant === 'hero') {
        const angle = t * 0.45 + index * (Math.PI / 2);
        nodeRef.current.position.set(
          Math.cos(angle) * 2.15,
          Math.sin(angle * 1.2) * 0.62,
          Math.sin(angle) * 1.3
        );
      } else {
        nodeRef.current.position.set(
          basePos[0],
          basePos[1] + Math.sin(t * 1.8 + index) * 0.08,
          basePos[2]
        );
      }
    }

    if (pulseRef.current && variant === 'workspace') {
      if (isActive && !paused) {
        const progress = (t * 0.85) % 1;
        pulseRef.current.visible = true;
        pulseRef.current.position.set(
          THREE.MathUtils.lerp(basePos[0], 0, progress),
          THREE.MathUtils.lerp(basePos[1], 0, progress),
          THREE.MathUtils.lerp(basePos[2], 0, progress)
        );
      } else {
        pulseRef.current.visible = false;
      }
    }

    if (flagRef.current && role === 'verifier' && hasVerifierBlocker && !paused) {
      flagRef.current.position.y = 0.56 + Math.sin(t * 4) * 0.08;
      flagRef.current.rotation.y += 0.03;
    }
  });

  const scale = variant === 'workspace' && isActive ? 1.26 : 1;

  return (
    <group>
      {variant === 'workspace' ? (
        <Line
          points={[basePos, [0, 0, 0]]}
          color={colorHex}
          lineWidth={isActive ? 3.5 : 1.5}
          dashed={!isActive}
          dashSize={0.14}
          gapSize={0.08}
        />
      ) : null}

      <mesh ref={pulseRef} visible={false}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial
          color={colorHex}
          emissive={colorHex}
          emissiveIntensity={isDark ? 1.7 : 1.2}
        />
      </mesh>

      <group ref={nodeRef} position={basePos} scale={scale}>
        <mesh>
          <sphereGeometry args={[0.31, 24, 24]} />
          <meshStandardMaterial
            color={colorHex}
            emissive={colorHex}
            emissiveIntensity={
              isDark ? (isActive ? 1.15 : 0.62) : isActive ? 0.65 : 0.25
            }
            roughness={isDark ? 0.2 : 0.26}
          />
        </mesh>

        {isActive && variant === 'workspace' ? (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.45, 0.025, 12, 40]} />
            <meshStandardMaterial
              color={colorHex}
              emissive={colorHex}
              emissiveIntensity={isDark ? 1.35 : 0.85}
            />
          </mesh>
        ) : null}

        {role === 'verifier' && hasVerifierBlocker ? (
          <mesh ref={flagRef} position={[0, 0.56, 0]}>
            <octahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial
              color={isDark ? '#FF5294' : '#D81B60'}
              emissive={isDark ? '#FF5294' : '#D81B60'}
              emissiveIntensity={isDark ? 1.4 : 0.95}
            />
          </mesh>
        ) : null}
      </group>
    </group>
  );
}

function SceneRig({
  variant,
  activeAgent,
  hasVerifierBlocker,
  paused,
  isDark,
}: Omit<EvidenceCubeSceneProps, 'isOnScreen' | 'runState'>) {
  const rigRef = React.useRef<THREE.Group>(null);
  const dark = Boolean(isDark);

  useFrame(({ pointer }) => {
    if (!rigRef.current || paused) return;
    const targetY = pointer.x * (variant === 'hero' ? 0.25 : 0.14);
    const targetX = -pointer.y * (variant === 'hero' ? 0.14 : 0.08);
    rigRef.current.rotation.y = THREE.MathUtils.lerp(rigRef.current.rotation.y, targetY, 0.05);
    rigRef.current.rotation.x = THREE.MathUtils.lerp(rigRef.current.rotation.x, targetX, 0.05);
  });

  return (
    <group ref={rigRef}>
      <ambientLight intensity={dark ? 0.65 : 1.08} color={dark ? '#FFE4F0' : '#FFF8F4'} />
      <directionalLight position={[4, 5, 6]} intensity={dark ? 1.15 : 1.3} color="#FFFFFF" />
      <pointLight
        position={[-4, -2, 3]}
        intensity={dark ? 1.45 : 0.85}
        color={dark ? '#FF5294' : '#FCE4EC'}
      />
      <pointLight
        position={[4, 2, -2]}
        intensity={dark ? 1.25 : 0.75}
        color={dark ? '#FFE082' : '#FFF1DC'}
      />

      <CentralLedgerCube
        variant={variant}
        hasVerifierBlocker={Boolean(hasVerifierBlocker)}
        paused={Boolean(paused)}
        isDark={dark}
      />

      {variant === 'hero' ? <FlyingCards paused={Boolean(paused)} isDark={dark} /> : null}

      {FOUR_AGENTS.map((role, index) => (
        <AgentSpoke
          key={role}
          role={role}
          variant={variant}
          isActive={activeAgent === role}
          hasVerifierBlocker={Boolean(hasVerifierBlocker)}
          paused={Boolean(paused)}
          index={index}
          isDark={dark}
        />
      ))}
    </group>
  );
}

export default function EvidenceCubeScene({
  variant,
  activeAgent = null,
  hasVerifierBlocker = false,
  paused = false,
  isOnScreen = true,
  isDark = false,
}: EvidenceCubeSceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={isOnScreen ? 'always' : 'demand'}
      camera={{ position: [0, 0.2, 6.2], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
    >
      <SceneRig
        variant={variant}
        activeAgent={activeAgent}
        hasVerifierBlocker={hasVerifierBlocker}
        paused={paused}
        isDark={isDark}
      />
    </Canvas>
  );
}
