type BrandLogoProps = {
  theme?: "dark" | "light";
  className?: string;
  compact?: boolean;
};

export default function BrandLogo({
  theme = "dark",
  className,
  compact = false,
}: BrandLogoProps) {
  const isDark = theme === "dark";
  const iconBg = isDark ? "#022c22" : "#d1fae5";
  const iconStroke = isDark ? "#a7f3d0" : "#047857";
  const iconAccent = isDark ? "#34d399" : "#059669";

  return (
    <span className={["inline-flex items-center gap-2.5", className].filter(Boolean).join(" ")}>
      <svg
        aria-hidden="true"
        className="h-9 w-9 shrink-0"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="1" y="1" width="38" height="38" rx="11" fill={iconBg} />
        <rect x="1" y="1" width="38" height="38" rx="11" stroke={iconStroke} strokeOpacity="0.35" />
        <rect x="8.5" y="10" width="23" height="20" rx="4.5" stroke={iconStroke} strokeWidth="2" />
        <path d="M20 10V30" stroke={iconStroke} strokeWidth="2" />
        <path d="M8.5 20H31.5" stroke={iconStroke} strokeWidth="2" />
        <circle cx="29.5" cy="8.5" r="3.5" fill={iconAccent} />
        <path
          d="M24.5 9.25C25.9 8.1 27.1 7.5 28.7 7.2"
          stroke={iconAccent}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.9"
        />
      </svg>
      {compact ? null : (
        <span
          className={[
            "text-base font-semibold tracking-[0.02em]",
            isDark ? "text-zinc-100" : "text-zinc-900",
          ].join(" ")}
        >
          provo<span className={isDark ? "text-emerald-300" : "text-emerald-600"}>padel</span>.com
        </span>
      )}
    </span>
  );
}
