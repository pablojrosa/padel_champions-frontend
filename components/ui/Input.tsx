import React from "react";

export default function Input(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return (
    <input
      {...props}
      className={`
        w-full rounded-xl border border-zinc-300
        bg-white px-3 py-2 text-sm text-zinc-900
        placeholder:text-zinc-400
        outline-none
        focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20
        disabled:bg-zinc-100
        ${props.className ?? ""}
      `}
    />
  );
}
