import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const THRESHOLD_PX = 72;
const MAX_PULL_PX = 112;

type PullToRefreshProps = {
  onRefresh: () => Promise<void> | void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  disabled?: boolean;
};

/**
 * Scroll container with native-style pull-to-refresh (finger drag down at top).
 */
export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  className = '',
  style,
  children,
  disabled = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const pullRef = useRef(0);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const setPullDistance = useCallback((value: number) => {
    pullRef.current = value;
    setPull(value);
  }, []);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    setPullDistance(44);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  }, [onRefresh, setPullDistance]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (disabled || refreshing) return;
      if (el.scrollTop > 1) {
        pullingRef.current = false;
        return;
      }
      startYRef.current = e.touches[0]?.clientY ?? 0;
      pullingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || disabled || refreshing) return;
      if (el.scrollTop > 1) {
        pullingRef.current = false;
        setPullDistance(0);
        return;
      }
      const y = e.touches[0]?.clientY ?? 0;
      const dy = y - startYRef.current;
      if (dy <= 0) {
        setPullDistance(0);
        return;
      }
      const distance = Math.min(MAX_PULL_PX, dy * 0.42);
      setPullDistance(distance);
      if (distance > 10) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      const distance = pullRef.current;
      if (distance >= THRESHOLD_PX) {
        void runRefresh();
      } else {
        setPullDistance(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [disabled, refreshing, runRefresh, setPullDistance]);

  const indicatorVisible = refreshing || pull > 0;
  const armed = pull >= THRESHOLD_PX;

  return (
    <div
      ref={scrollRef}
      className={className}
      style={{ ...style, overscrollBehaviorY: 'contain' }}
      id="app-pull-to-refresh"
    >
      <div
        className="flex items-center justify-center overflow-hidden pointer-events-none"
        style={{
          height: refreshing ? 48 : pull,
          transition: refreshing || pull === 0 ? 'height 160ms ease' : undefined,
        }}
        aria-hidden={!indicatorVisible}
      >
        <RefreshCw
          className={`w-5 h-5 text-[#F08C32] ${refreshing || armed ? 'animate-spin' : ''}`}
          style={{
            opacity: refreshing ? 1 : Math.min(1, pull / THRESHOLD_PX),
            transform: `rotate(${Math.round(pull * 2.2)}deg)`,
          }}
        />
      </div>
      {children}
    </div>
  );
};
