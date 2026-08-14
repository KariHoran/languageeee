import { useEffect, useState } from 'react';

/**
 * Откладывает обновление значения (поиск 300–500 мс),
 * чтобы не фильтровать на каждый символ.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
