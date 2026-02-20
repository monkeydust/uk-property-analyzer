'use client';

import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export function UndoToast({ message, onUndo, onDismiss, duration = 5000 }: UndoToastProps) {
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const startTime = Date.now();
    const endTime = startTime + duration;

    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = endTime - now;
      
      if (remaining <= 0) {
        setProgress(0);
        setIsVisible(false);
        onDismiss();
        clearInterval(timer);
      } else {
        setProgress((remaining / duration) * 100);
      }
    }, 50);

    return () => clearInterval(timer);
  }, [duration, onDismiss]);

  const handleUndo = () => {
    setIsVisible(false);
    onUndo();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-lg shadow-lg min-w-[300px]">
        <span className="text-sm flex-1">{message}</span>
        <button
          onClick={handleUndo}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white/10 hover:bg-white/20 rounded transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Undo
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-slate-700 rounded-b-lg overflow-hidden">
        <div 
          className="h-full bg-teal-500 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}