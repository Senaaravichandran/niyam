/**
 * The NIYAM mark is number-line notation for "greater than": an open circle at the limit and a
 * ray past it. The limit itself is not included, which is exactly what "exceeding" means.
 */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" fill="#0b1f3a" />
      <circle cx="10" cy="16" r="4.2" fill="none" stroke="#ffffff" strokeWidth="2.4" />
      <path d="M14.4 16 H25" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="square" />
      <path d="M21.5 11.8 L25.8 16 L21.5 20.2" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="square" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark size={26} />
      <span className="ui text-[19px] font-bold tracking-[-0.03em]">NIYAM</span>
    </span>
  );
}
