import React from "react";

interface PixelHeaderProps {
  level?: number;
  className?: string;
}

export function PixelHeader({ level = 4, className = "" }: PixelHeaderProps) {
  const formattedLevel = String(level).padStart(2, "0");

  return (
    <header className={`w-full ${className}`}>
      <div className="flex items-center justify-between py-2 text-sm">
        <span className="font-dotgothic font-bold tracking-wider text-[#f2c36b]">✦ TriOne</span>
        <span className="flex items-center gap-1.5 font-dotgothic text-xs text-[#a8b3cf]">
          <span className="inline-block h-2 w-2 rounded-full bg-[#758ab3]" />
          LV. {formattedLevel}
        </span>
      </div>
      <div className="h-[1px] w-full bg-[#35465d]" />
    </header>
  );
}

export function DecorativeTileBar({ className = "" }: DecorativeTileBarProps) {
  // 画面幅いっぱいにレトロなドットタイルを並べる
  return (
    <div
      aria-hidden="true"
      className={`flex w-full items-center justify-between overflow-hidden py-1.5 opacity-80 ${className}`}
    >
      {Array.from({ length: 16 }).map((_, i) => (
        <span key={i} className="h-2 w-2 flex-shrink-0 bg-[#4c416d]" />
      ))}
    </div>
  );
}

interface DecorativeTileBarProps {
  className?: string;
}
