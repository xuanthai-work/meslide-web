import type { ReactNode } from "react";

export function GSlideFadeHeader({
  left,
  center,
}: {
  left: ReactNode;
  center?: ReactNode;
}) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[72px] bg-gradient-to-b from-white via-white to-white/0 sm:h-[80px] 2xl:h-[96px]">
      <div className="relative mx-auto flex h-full max-w-[1280px] items-center justify-between px-5 sm:px-8 2xl:max-w-[1536px] 2xl:px-[90px]">
        <div className="pointer-events-auto">{left}</div>
        {center}
      </div>
    </header>
  );
}
