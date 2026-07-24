import { useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
}

export function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [startY, setStartY] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  
  const contentRef = useRef<HTMLDivElement>(null);
  const MAX_PULL_DISTANCE = 120;
  const THRESHOLD = 60;

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow pull-to-refresh if we are at the top of the container
    const isAtTop = !contentRef.current || contentRef.current.scrollTop <= 0;
    if (!isAtTop || refreshing) return;

    setStartY(e.touches[0].clientY);
    setPulling(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    
    const y = e.touches[0].clientY;
    const distance = y - startY;

    // Only handle downward pulling
    if (distance > 0) {
      // Prevent default scrolling behavior when pulling down at the top
      if (document.body.style.overscrollBehaviorY !== 'none') {
        document.body.style.overscrollBehaviorY = 'none';
      }
      
      // Add resistance to the pull
      const resistance = 0.5;
      const pullAmount = Math.min(distance * resistance, MAX_PULL_DISTANCE);
      setPullDistance(pullAmount);
    }
  };

  const handleTouchEnd = async () => {
    document.body.style.overscrollBehaviorY = 'auto';
    
    if (!pulling || refreshing) return;
    
    setPulling(false);
    
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD); // keep it at threshold during refresh
      
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Spring back if threshold not met
      setPullDistance(0);
    }
  };

  return (
    <div 
      className="w-full h-full relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 transition-transform duration-200"
        style={{
          transform: `translateY(${Math.min(pullDistance - 40, 20)}px)`,
          opacity: pullDistance > 10 || refreshing ? 1 : 0
        }}
      >
        <div className="bg-white rounded-full p-2 shadow-md">
          <RefreshCw 
            className={`w-5 h-5 text-slate-500 ${
              refreshing ? 'animate-spin' : ''
            }`}
            style={{
              transform: !refreshing ? `rotate(${pullDistance * 2}deg)` : undefined
            }}
          />
        </div>
      </div>
      
      <div
        ref={contentRef}
        className="w-full h-full overflow-y-auto"
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pulling ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      >
        {children}
      </div>
    </div>
  );
}
