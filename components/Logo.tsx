/**
 * Brand logo. White assets (dark UI); black variants in /public are kept for
 * future light surfaces. Plain <img> with explicit dimensions (no layout shift).
 */
const ASSETS = {
  full: { src: "/tarteeb-logo-white.svg", w: 463, h: 128 },
  icon: { src: "/tarteeb-icon-white.svg", w: 96, h: 96 },
} as const;

export default function Logo({
  variant = "full",
  height = 28,
  className,
}: {
  variant?: keyof typeof ASSETS;
  height?: number;
  className?: string;
}) {
  const a = ASSETS[variant];
  const width = Math.round((height * a.w) / a.h);
  return (
    <img
      src={a.src}
      alt="Tarteeb"
      width={width}
      height={height}
      className={className}
    />
  );
}
