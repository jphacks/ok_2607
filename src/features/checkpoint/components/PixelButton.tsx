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
      "bg-[#f2c36b] text-[#101727] border-2 border-[#fff1c6] shadow-[0_4px_0_#b88a38] active:shadow-[0_1px_0_#b88a38] active:translate-y-1 hover:brightness-105",
    secondary:
      "bg-[#22273d] text-[#f2c36b] border-2 border-[#d9b96f] shadow-[0_4px_0_#151824] active:shadow-[0_1px_0_#151824] active:translate-y-1 hover:brightness-110",
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
