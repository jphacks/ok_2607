import React from "react";

interface MagePixelArtProps {
  className?: string;
  size?: number; // 基準の幅（アスペクト比 48:42）
}

export function MagePixelArt({ className = "", size = 48 }: MagePixelArtProps) {
  const height = Math.round((size * 42) / 48);

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 48 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shape-rendering-crispEdges ${className}`}
      aria-label="魔道士"
    >
      {/* 帽子・上着 */}
      <rect x="12" y="0" width="6" height="6" fill="#bb7cd5" />
      <rect x="18" y="0" width="6" height="6" fill="#bb7cd5" />
      <rect x="24" y="0" width="6" height="6" fill="#bb7cd5" />
      <rect x="30" y="0" width="6" height="6" fill="#bb7cd5" />

      {/* 帽子つば・顔 */}
      <rect x="6" y="6" width="6" height="6" fill="#bb7cd5" />
      <rect x="12" y="6" width="6" height="6" fill="#f8cca3" />
      <rect x="18" y="6" width="6" height="6" fill="#f8cca3" />
      <rect x="24" y="6" width="6" height="6" fill="#f8cca3" />
      <rect x="30" y="6" width="6" height="6" fill="#f8cca3" />
      <rect x="36" y="6" width="6" height="6" fill="#bb7cd5" />

      {/* 影・ヒゲ */}
      <rect x="12" y="12" width="6" height="6" fill="#5a4036" />
      <rect x="18" y="12" width="6" height="6" fill="#5a4036" />
      <rect x="24" y="12" width="6" height="6" fill="#5a4036" />
      <rect x="30" y="12" width="6" height="6" fill="#5a4036" />

      {/* ローブ・胴体 */}
      <rect x="6" y="18" width="6" height="6" fill="#bb7cd5" />
      <rect x="12" y="18" width="6" height="6" fill="#bb7cd5" />
      <rect x="18" y="18" width="6" height="6" fill="#5e83cc" />
      <rect x="24" y="18" width="6" height="6" fill="#5e83cc" />
      <rect x="30" y="18" width="6" height="6" fill="#bb7cd5" />
      <rect x="36" y="18" width="6" height="6" fill="#bb7cd5" />

      {/* 袖・ローブ下部 */}
      <rect x="0" y="24" width="6" height="6" fill="#bb7cd5" />
      <rect x="6" y="24" width="6" height="6" fill="#bb7cd5" />
      <rect x="12" y="24" width="6" height="6" fill="#bb7cd5" />
      <rect x="18" y="24" width="6" height="6" fill="#5e83cc" />
      <rect x="24" y="24" width="6" height="6" fill="#5e83cc" />
      <rect x="30" y="24" width="6" height="6" fill="#bb7cd5" />
      <rect x="36" y="24" width="6" height="6" fill="#bb7cd5" />
      <rect x="42" y="24" width="6" height="6" fill="#bb7cd5" />

      {/* ズボン */}
      <rect x="12" y="30" width="6" height="6" fill="#5e83cc" />
      <rect x="18" y="30" width="6" height="6" fill="#5e83cc" />
      <rect x="24" y="30" width="6" height="6" fill="#5e83cc" />
      <rect x="30" y="30" width="6" height="6" fill="#5e83cc" />

      {/* 足 */}
      <rect x="12" y="36" width="6" height="6" fill="#5e83cc" />
      <rect x="30" y="36" width="6" height="6" fill="#5e83cc" />
    </svg>
  );
}
