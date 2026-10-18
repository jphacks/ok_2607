import React from "react";

interface PixelCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  as?: "div" | "button" | "li";
}

export function PixelCard({
  children,
  className = "",
  onClick,
  as: Component = "div",
}: PixelCardProps) {
  return (
    <Component
      onClick={onClick}
      className={`relative border-2 border-gold-border bg-panel p-3 shadow-md ${
        onClick ? "cursor-pointer transition-transform active:translate-y-0.5" : ""
      } ${className}`}
    >
      {/* 四隅のレトロピクセルアクセント */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1 top-1 h-1.5 w-1.5 bg-gold-border"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 bg-gold-border"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1 left-1 h-1.5 w-1.5 bg-gold-border"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1 right-1 h-1.5 w-1.5 bg-gold-border"
      />

      {children}
    </Component>
  );
}
