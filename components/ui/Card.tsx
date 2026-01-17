type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl bg-white text-zinc-900 shadow-xl ring-1 ring-zinc-200 ${className}`}
    >
      {children}
    </div>
  );
}
