import React from "react";

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
}

export function PixelButton({
  children,
  variant = "primary",
  fullWidth = true,
  className = "",
  disabled = false,
  ...props
}: PixelButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-dotgothic font-bold text-center transition-all select-none focus:outline-none";

  const variants = {
    primary:
      "bg-gold text-gold-ink border-2 border-gold-border shadow-[0_4px_0_var(--color-gold-ink)] active:shadow-[0_1px_0_var(--color-gold-ink)] active:translate-y-1 hover:bg-gold-hover",
    secondary:
      "bg-panel text-gold-text border-2 border-gold-border shadow-[0_4px_0_var(--color-surface)] active:shadow-[0_1px_0_var(--color-surface)] active:translate-y-1 hover:bg-panel-active",
  };

  const disabledStyles =
    "opacity-50 cursor-not-allowed filter grayscale shadow-none translate-y-0 active:translate-y-0";

  return (
    <button
      disabled={disabled}
      className={`h-13 px-6 text-base ${baseStyles} ${fullWidth ? "w-full" : ""} ${
        disabled ? disabledStyles : variants[variant]
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
