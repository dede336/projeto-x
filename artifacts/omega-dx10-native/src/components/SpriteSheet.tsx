import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Platform } from 'react-native';

// ── Shared global ticker at 4fps to avoid N timers for N sprites ──────────────
type TickListener = () => void;
const listeners = new Set<TickListener>();
let globalTimer: ReturnType<typeof setInterval> | null = null;

function subscribe(fn: TickListener) {
  listeners.add(fn);
  if (!globalTimer) {
    globalTimer = setInterval(() => {
      listeners.forEach((cb) => cb());
    }, 250);
  }
}

function unsubscribe(fn: TickListener) {
  listeners.delete(fn);
  if (listeners.size === 0 && globalTimer) {
    clearInterval(globalTimer);
    globalTimer = null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

interface SpriteSheetProps {
  source: any;
  totalWidth: number;
  frameHeight: number;
  frameCount: number;
  fps?: number;
  displaySize?: number;
  frameSequence?: number[];
}

export function SpriteSheet({ source, totalWidth, frameHeight, frameCount, fps = 4, displaySize = 64, frameSequence }: SpriteSheetProps) {
  const sequence = frameSequence ?? Array.from({ length: frameCount }, (_, i) => i);
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);

  useEffect(() => {
    const tick: TickListener = () => {
      stepRef.current = (stepRef.current + 1) % sequence.length;
      setStep(stepRef.current);
    };
    subscribe(tick);
    return () => unsubscribe(tick);
  }, [sequence.length]);

  const frame = sequence[step];
  const frameW = totalWidth / frameCount;
  const scale = displaySize / frameW;
  const scaledH = frameHeight * scale;
  const scaledTotalW = totalWidth * scale;
  const offsetX = Math.round(-frame * displaySize);

  const pixelatedStyle = Platform.OS === 'web'
    ? ({ imageRendering: 'pixelated' } as any)
    : {};

  return (
    <View style={{ width: displaySize, height: scaledH, overflow: 'hidden' }}>
      <Image
        source={source}
        style={{
          width: scaledTotalW,
          height: scaledH,
          transform: [{ translateX: offsetX }],
          ...pixelatedStyle,
        }}
        resizeMode="stretch"
      />
    </View>
  );
}
