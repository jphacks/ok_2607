import React from "react";

interface TreasureChestPixelArtProps {
  className?: string;
  size?: number; // 基準の幅（アスペクト比 48:36）
}

export function TreasureChestPixelArt({ className = "", size = 48 }: TreasureChestPixelArtProps) {
  const height = Math.round((size * 36) / 48);

  return (
    <div className={`flex items-center justify-center gap-4 ${className}`}>
      {/* 左のキラキラ */}
      <span className="font-dotgothic text-2xl text-[#f2c36b] drop-shadow-[0_0_8px_rgba(242,195,107,0.6)] animate-pulse">
        ✦
      </span>

      {/* 宝箱 */}
      <svg
        width={size}
        height={height}
        viewBox="0 0 48 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shape-rendering-crispEdges drop-shadow-[0_4px_12px_rgba(242,195,107,0.3)]"
        aria-label="宝箱"
      >
        <rect x="0" y="0" width="6" height="6" fill="#eec46e" />
        <rect x="6" y="0" width="6" height="6" fill="#eec46e" />
        <rect x="12" y="0" width="6" height="6" fill="#eec46e" />
        <rect x="18" y="0" width="6" height="6" fill="#eec46e" />
        <rect x="24" y="0" width="6" height="6" fill="#eec46e" />
        <rect x="30" y="0" width="6" height="6" fill="#eec46e" />
        <rect x="36" y="0" width="6" height="6" fill="#eec46e" />
        <rect x="42" y="0" width="6" height="6" fill="#eec46e" />

        <rect x="0" y="6" width="6" height="6" fill="#eec46e" />
        <rect x="6" y="6" width="6" height="6" fill="#784a30" />
        <rect x="12" y="6" width="6" height="6" fill="#784a30" />
        <rect x="18" y="6" width="6" height="6" fill="#784a30" />
        <rect x="24" y="6" width="6" height="6" fill="#784a30" />
        <rect x="30" y="6" width="6" height="6" fill="#784a30" />
        <rect x="36" y="6" width="6" height="6" fill="#784a30" />
        <rect x="42" y="6" width="6" height="6" fill="#eec46e" />

        <rect x="0" y="12" width="6" height="6" fill="#eec46e" />
        <rect x="6" y="12" width="6" height="6" fill="#eec46e" />
        <rect x="12" y="12" width="6" height="6" fill="#eec46e" />
        <rect x="18" y="12" width="6" height="6" fill="#eec46e" />
        <rect x="24" y="12" width="6" height="6" fill="#eec46e" />
        <rect x="30" y="12" width="6" height="6" fill="#eec46e" />
        <rect x="36" y="12" width="6" height="6" fill="#eec46e" />
        <rect x="42" y="12" width="6" height="6" fill="#eec46e" />

        <rect x="0" y="18" width="6" height="6" fill="#eec46e" />
        <rect x="6" y="18" width="6" height="6" fill="#784a30" />
        <rect x="12" y="18" width="6" height="6" fill="#784a30" />
        <rect x="18" y="18" width="6" height="6" fill="#eec46e" />
        <rect x="24" y="18" width="6" height="6" fill="#eec46e" />
        <rect x="30" y="18" width="6" height="6" fill="#784a30" />
        <rect x="36" y="18" width="6" height="6" fill="#784a30" />
        <rect x="42" y="18" width="6" height="6" fill="#eec46e" />

        <rect x="0" y="24" width="6" height="6" fill="#eec46e" />
        <rect x="6" y="24" width="6" height="6" fill="#784a30" />
        <rect x="12" y="24" width="6" height="6" fill="#784a30" />
        <rect x="18" y="24" width="6" height="6" fill="#eec46e" />
        <rect x="24" y="24" width="6" height="6" fill="#eec46e" />
        <rect x="30" y="24" width="6" height="6" fill="#784a30" />
        <rect x="36" y="24" width="6" height="6" fill="#784a30" />
        <rect x="42" y="24" width="6" height="6" fill="#eec46e" />

        <rect x="0" y="30" width="6" height="6" fill="#eec46e" />
        <rect x="6" y="30" width="6" height="6" fill="#eec46e" />
        <rect x="12" y="30" width="6" height="6" fill="#eec46e" />
        <rect x="18" y="30" width="6" height="6" fill="#eec46e" />
        <rect x="24" y="30" width="6" height="6" fill="#eec46e" />
        <rect x="30" y="30" width="6" height="6" fill="#eec46e" />
        <rect x="36" y="30" width="6" height="6" fill="#eec46e" />
        <rect x="42" y="30" width="6" height="6" fill="#eec46e" />
      </svg>

      {/* 右のキラキラ */}
      <span className="font-dotgothic text-2xl text-[#f2c36b] drop-shadow-[0_0_8px_rgba(242,195,107,0.6)] animate-pulse">
        ✦
      </span>
    </div>
  );
}
