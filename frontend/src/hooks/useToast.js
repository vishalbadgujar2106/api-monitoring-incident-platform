import { useCallback, useRef, useState } from 'react';

const AUTO_DISMISS_MS = 4000;

export function useToast() {
  const [toast, setToast] = useState(null);
  const timeoutRef = useRef(null);

  const showToast = useCallback((message, tone = 'success') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast({ message, tone, id: Date.now() });
    timeoutRef.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
  }, []);

  const dismissToast = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast(null);
  }, []);

  return { toast, showToast, dismissToast };
}
