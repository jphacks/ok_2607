import React from "react";

interface PixelCheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function PixelCheckbox({
  checked,
  onChange,
  className = "",
  disabled = false,
  ariaLabel,
}: PixelCheckboxProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      className={`relative flex h-6 w-6 flex-shrink-0 items-center justify-center transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-accent ${
        checked
          ? "border border-line bg-panel shadow-inner"
          : "border-2 border-gold-border bg-field hover:border-gold-accent"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-95"} ${className}`}
    >
      {checked && (
        <svg
          className="h-4 w-4 text-neon-cyan drop-shadow"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* レトロピクセルチェックマーク */}
          <rect x="2" y="8" width="2" height="2" fill="currentColor" />
          <rect x="4" y="10" width="2" height="2" fill="currentColor" />
          <rect x="6" y="12" width="2" height="2" fill="currentColor" />
          <rect x="8" y="10" width="2" height="2" fill="currentColor" />
          <rect x="10" y="8" width="2" height="2" fill="currentColor" />
          <rect x="12" y="6" width="2" height="2" fill="currentColor" />
          <rect x="14" y="4" width="2" height="2" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}
