import { Platform, type ViewStyle } from 'react-native';

type SoftShadowOpts = {
  /** CSS color or RN color token */
  color?: string;
  x?: number;
  y?: number;
  blur?: number;
  opacity?: number;
  elevation?: number;
};

/**
 * Кроссплатформенная тень:
 * - web → boxShadow (без deprecated shadow*)
 * - native → shadow* + elevation
 */
export function softShadow(opts: SoftShadowOpts = {}): ViewStyle {
  const {
    color = '#000000',
    x = 0,
    y = 4,
    blur = 12,
    opacity = 0.15,
    elevation = 4,
  } = opts;

  if (Platform.OS === 'web') {
    const rgba =
      color.startsWith('#') && (color.length === 7 || color.length === 4)
        ? hexToRgba(color, opacity)
        : color.includes('rgba') || color.includes('rgb')
          ? color
          : `rgba(0,0,0,${opacity})`;
    return {
      // RN Web accepts boxShadow; cast keeps TS happy across platforms
      boxShadow: `${x}px ${y}px ${blur}px ${rgba}`,
    } as ViewStyle;
  }

  return {
    shadowColor: color,
    shadowOffset: { width: x, height: y },
    shadowOpacity: opacity,
    shadowRadius: blur / 2,
    elevation,
  };
}

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
