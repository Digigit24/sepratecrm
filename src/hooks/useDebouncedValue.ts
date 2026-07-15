// src/hooks/useDebouncedValue.ts
// Returns a value that only updates after `delayMs` of no changes.
// Used to stop search inputs from firing one API request per keystroke —
// the input itself stays fully responsive; only the network call is delayed.
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export default useDebouncedValue;
