import React from 'react';

interface EyebrowProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

// Єдиний стиль "eyebrow" для заголовків секцій: дрібний upper-case маркер над serif-заголовком.
export const Eyebrow = ({ children, icon, className = '' }: EyebrowProps) => (
  <div className={`mb-4 inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.25em] text-tiffany-deep ${className}`}>
    <span aria-hidden="true" className="h-px w-8 bg-gold/70" />
    {icon}
    <span>{children}</span>
  </div>
);
