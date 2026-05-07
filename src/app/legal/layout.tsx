import type { ReactNode } from 'react';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#101530] text-white">
      {children}
    </div>
  );
}
