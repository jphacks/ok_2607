import React from "react";

interface HeroPixelArtProps {
  className?: string;
  size?: number; // 基準の幅（アスペクト比 48:48）
}

export function HeroPixelArt({ className = "", size = 48 }: HeroPixelArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shape-rendering-crispEdges ${className}`}
      aria-label="主人公"
    >
      {/* 髪（茶色） */}
      <rect x="12" y="0" width="6" height="6" fill="#704a37" />
      <rect x="18" y="0" width="6" height="6" fill="#704a37" />
      <rect x="24" y="0" width="6" height="6" fill="#704a37" />
      <rect x="30" y="0" width="6" height="6" fill="#704a37" />
      <rect x="6" y="6" width="6" height="6" fill="#704a37" />
      <rect x="12" y="6" width="6" height="6" fill="#f8cca3" />
      <rect x="18" y="6" width="6" height="6" fill="#f8cca3" />
      <rect x="24" y="6" width="6" height="6" fill="#f8cca3" />
      <rect x="30" y="6" width="6" height="6" fill="#f8cca3" />
      <rect x="36" y="6" width="6" height="6" fill="#704a37" />
      <rect x="0" y="12" width="6" height="6" fill="#704a37" />
      <rect x="6" y="12" width="6" height="6" fill="#f8cca3" />
      <rect x="12" y="12" width="6" height="6" fill="#f8cca3" />
      <rect x="18" y="12" width="6" height="6" fill="#f8cca3" />
      <rect x="24" y="12" width="6" height="6" fill="#f8cca3" />
      <rect x="30" y="12" width="6" height="6" fill="#f8cca3" />
      <rect x="36" y="12" width="6" height="6" fill="#f8cca3" />
      <rect x="42" y="12" width="6" height="6" fill="#704a37" />

      {/* 襟・服（水色 / 濃茶） */}
      <rect x="6" y="18" width="6" height="6" fill="#a7c3ed" />
      <rect x="12" y="18" width="6" height="6" fill="#5a4036" />
      <rect x="18" y="18" width="6" height="6" fill="#5a4036" />
      <rect x="24" y="18" width="6" height="6" fill="#5a4036" />
      <rect x="30" y="18" width="6" height="6" fill="#5a4036" />
      <rect x="36" y="18" width="6" height="6" fill="#a7c3ed" />

      {/* 服（水色 / 青） */}
      <rect x="0" y="24" width="6" height="6" fill="#a7c3ed" />
      <rect x="6" y="24" width="6" height="6" fill="#a7c3ed" />
      <rect x="12" y="24" width="6" height="6" fill="#a7c3ed" />
      <rect x="18" y="24" width="6" height="6" fill="#5e83cc" />
      <rect x="24" y="24" width="6" height="6" fill="#5e83cc" />
      <rect x="30" y="24" width="6" height="6" fill="#a7c3ed" />
      <rect x="36" y="24" width="6" height="6" fill="#a7c3ed" />
      <rect x="42" y="24" width="6" height="6" fill="#a7c3ed" />

      {/* ズボン（青） */}
      <rect x="6" y="30" width="6" height="6" fill="#a7c3ed" />
      <rect x="12" y="30" width="6" height="6" fill="#5e83cc" />
      <rect x="18" y="30" width="6" height="6" fill="#5e83cc" />
      <rect x="24" y="30" width="6" height="6" fill="#5e83cc" />
      <rect x="30" y="30" width="6" height="6" fill="#5e83cc" />
      <rect x="36" y="30" width="6" height="6" fill="#a7c3ed" />
      <rect x="12" y="36" width="6" height="6" fill="#5e83cc" />
      <rect x="18" y="36" width="6" height="6" fill="#5e83cc" />
      <rect x="24" y="36" width="6" height="6" fill="#5e83cc" />
      <rect x="30" y="36" width="6" height="6" fill="#5e83cc" />

      {/* 靴・足 */}
      <rect x="12" y="42" width="6" height="6" fill="#5e83cc" />
      <rect x="30" y="42" width="6" height="6" fill="#5e83cc" />
    </svg>
  );
}
