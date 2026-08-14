import React, { useEffect, useMemo, useState } from 'react';
import { Div } from './dom';

type StarSpec = {
  id: number;
  left: string;
  top: string;
  size: number;
  opacity: number;
  delay: string;
  duration: string;
  twinkle: boolean;
};

/** Детерминированные «случайные» звёзды — без Math.random на каждый рендер. */
function buildStars(count: number): StarSpec[] {
  const stars: StarSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = (i * 67 + 19) % 1000;
    const y = (i * 97 + 41) % 1000;
    const size = i % 3 === 0 ? 2 : 1;
    const opacity = 0.18 + ((i * 13) % 7) * 0.09;
    // На слабых устройствах мерцает меньшая доля звёзд
    const twinkle = count <= 28 ? i % 5 === 0 : i % 3 !== 0;
    stars.push({
      id: i,
      left: `${x / 10}%`,
      top: `${y / 10}%`,
      size,
      opacity: Math.min(0.85, opacity),
      delay: `${((i * 37) % 80) / 10}s`,
      duration: `${2.8 + ((i * 11) % 9) * 0.4}s`,
      twinkle,
    });
  }
  return stars;
}

function pickStarCount(): number {
  if (typeof window === 'undefined') return 40;
  const w = window.innerWidth;
  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return 12;
  // Телефон / узкий планшет — меньше частиц для GPU
  if (w < 640) return 18;
  if (w < 1024) return 28;
  return 48;
}

/**
 * Dark Neon starfield — fixed подложка под UI (z-0, pointer-events-none).
 * Адаптивное число звёзд: меньше на мобильных/планшетах.
 */
export function StarryBackground({
  count,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  const [starCount, setStarCount] = useState(() => count ?? pickStarCount());

  useEffect(() => {
    if (count != null) {
      setStarCount(count);
      return;
    }
    const update = () => setStarCount(pickStarCount());
    update();
    window.addEventListener('resize', update, { passive: true });
    const mq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    mq?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      mq?.removeEventListener?.('change', update);
    };
  }, [count]);

  const stars = useMemo(() => buildStars(starCount), [starCount]);

  return (
    <Div
      className={`starry-bg fixed inset-0 pointer-events-none z-0 overflow-hidden ${className}`}
      aria-hidden
    >
      {stars.map((s) => (
        <Div
          key={s.id}
          className={`starry-bg__star absolute rounded-full bg-[#E8EEFC] ${
            s.twinkle ? 'starry-bg__star--twinkle' : ''
          }`}
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            ['--star-opacity' as string]: String(s.opacity),
            ['--star-delay' as string]: s.delay,
            ['--star-duration' as string]: s.duration,
            opacity: s.twinkle ? undefined : s.opacity,
          }}
        />
      ))}
    </Div>
  );
}

export default StarryBackground;
