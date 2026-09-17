import { useEffect } from 'react';

export function useClickOutside(refs, onOutside, isActive) {
  useEffect(() => {
    if (!isActive) return undefined;

    function handlePointerDown(event) {
      const list = Array.isArray(refs) ? refs : [refs];
      const isInside = list.some((ref) => ref.current && ref.current.contains(event.target));
      if (!isInside) onOutside();
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') onOutside();
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [refs, onOutside, isActive]);
}
