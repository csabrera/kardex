import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of the input value.
 *
 * Useful for search inputs, autocomplete, etc. — avoids firing
 * a TanStack Query for every keystroke.
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 300);
 *
 * useQuery({ queryKey: ['items', debouncedSearch], queryFn: () => ... });
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
