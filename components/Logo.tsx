export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="21" y="36" width="38" height="28" rx="14" fill="none" stroke="#A78BFA" strokeWidth="7" />
      <rect x="41" y="36" width="38" height="28" rx="14" fill="none" stroke="#7C5CFF" strokeWidth="7" />
      <circle cx="30" cy="50" r="2.4" fill="#A78BFA" />
      <circle cx="70" cy="45" r="2.4" fill="#7C5CFF" />
      <circle cx="70" cy="55" r="2.4" fill="#7C5CFF" />
    </svg>
  );
}
