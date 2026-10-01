import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_MARGIN = "1200px 0px";

export function useNearViewport(onNear: (index: number) => void) {
  const onNearRef = useRef(onNear);
  useEffect(() => {
    onNearRef.current = onNear;
  }, [onNear]);

  const [tracker] = useState(() => {
    const indexes = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = indexes.get(entry.target);
          if (entry.isIntersecting && index !== undefined) {
            onNearRef.current(index);
          }
        }
      },
      { rootMargin: NEAR_MARGIN },
    );
    return { indexes, observer };
  });

  return useCallback(
    (index: number, element: Element) => {
      tracker.indexes.set(element, index);
      tracker.observer.observe(element);
      return () => {
        tracker.indexes.delete(element);
        tracker.observer.unobserve(element);
      };
    },
    [tracker],
  );
}
