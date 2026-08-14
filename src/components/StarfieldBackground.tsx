import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const { width: W, height: H } = Dimensions.get('window');

const STARS = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  left: (i * 97 + 13) % W,
  top: (i * 53 + 29) % H,
  size: 1.5 + (i % 4) * 0.7,
  delay: (i % 12) * 180,
  duration: 1400 + (i % 7) * 320,
}));

function TwinkleStar({
  left,
  top,
  size,
  delay,
  duration,
}: {
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
}) {
  const opacity = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.12,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.star,
        {
          left,
          top,
          width: size,
          height: size,
          borderRadius: size,
          opacity,
        },
      ]}
    />
  );
}

/** Фон «звёздное небо» для Midnight Reader Mode */
export default function StarfieldBackground() {
  const theme = useTheme();
  if (theme.mode !== 'midnight') return null;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.nebulaA} />
      <View style={styles.nebulaB} />
      {STARS.map((s) => (
        <TwinkleStar key={s.id} {...s} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
  },
  nebulaA: {
    position: 'absolute',
    width: W * 0.7,
    height: W * 0.7,
    borderRadius: W,
    backgroundColor: 'rgba(80,40,180,0.18)',
    top: -W * 0.2,
    right: -W * 0.15,
  },
  nebulaB: {
    position: 'absolute',
    width: W * 0.55,
    height: W * 0.55,
    borderRadius: W,
    backgroundColor: 'rgba(20,80,160,0.16)',
    bottom: H * 0.1,
    left: -W * 0.2,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#e8f0ff',
    shadowColor: '#c4ff4d',
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});
