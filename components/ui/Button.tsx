import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

export default function Button({ variant = "primary", className = "", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-zinc-900 text-white hover:bg-zinc-800"
      : variant === "secondary"
      ? "bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50"
      : "bg-red-600 text-white hover:bg-red-500";
      variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-500" : "";
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}
