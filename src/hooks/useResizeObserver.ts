import { useCallback, useEffect, useRef, useState } from 'react';

interface Size {
  width: number;
  height: number;
}

export function useResizeObserver<T extends HTMLElement>() {
  const observerRef = useRef<ResizeObserver | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const ref = useCallback((node: T | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (node) {
      const updateSize = ({ width, height }: DOMRectReadOnly) => {
        setSize({ width, height });
      };

      observerRef.current = new ResizeObserver((entries) => {
        if (entries.length === 0) {
          return;
        }

        updateSize(entries[0].contentRect);
      });

      observerRef.current.observe(node);
      updateSize(node.getBoundingClientRect());
    }
  }, []);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return { ref, width: size.width, height: size.height };
}

