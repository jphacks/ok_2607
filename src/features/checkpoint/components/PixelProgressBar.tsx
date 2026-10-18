import React from "react";

interface PixelProgressBarProps {
  completed: number;
  total: number;
  className?: string;
}

export function PixelProgressBar({ completed, total, className = "" }: PixelProgressBarProps) {
  const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return (
    <div className={`w-full font-dotgothic ${className}`}>
      {/* 進捗テキスト */}
      <div className="mb-1.5 flex items-center justify-between text-xs text-text">
        <span>
          進捗 <span className="font-bold">{completed}</span> / {total}
        </span>
        <span className="text-[11px] text-muted">{percentage}%</span>
      </div>

      {/* レトロ進捗バー */}
      <div
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        className="h-2.5 w-full overflow-hidden bg-field"
      >
        <div
          style={{ width: `${percentage}%` }}
          className="h-full bg-success transition-all duration-300 ease-out"
        />
      </div>
    </div>
  );
}
