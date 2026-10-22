import React from 'react';

export default function PoweredByLogo({ className = '', size = 'md' }) {
  if (size === 'sm') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1 bg-white border border-gray-200/90 rounded-xl shadow-xs transition-all duration-200 hover:shadow-sm ${className}`}
        title="Powered by Jishnu Infotech"
      >
        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-700 whitespace-nowrap select-none flex-shrink-0">
          Powered by
        </span>
        <span className="h-5 w-px bg-gray-300 flex-shrink-0" />
        <img
          src="/images/jishnu-logo.png"
          alt="Jishnu Infotech"
          className="h-6 sm:h-7 w-auto object-contain flex-shrink-0"
          loading="eager"
        />
      </div>
    );
  }

  if (size === 'lg') {
    return (
      <div
        className={`inline-flex items-center gap-3.5 px-5 py-2.5 bg-white border border-gray-200 shadow-md rounded-2xl transition-all duration-200 hover:shadow-lg flex-shrink-0 ${className}`}
        title="Powered by Jishnu Infotech"
      >
        <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-800 whitespace-nowrap select-none flex-shrink-0">
          Powered by
        </span>
        <span className="h-9 w-px bg-gray-300 flex-shrink-0" />
        <img
          src="/images/jishnu-logo.png"
          alt="Jishnu Infotech"
          className="h-11 sm:h-14 w-auto object-contain drop-shadow-xs flex-shrink-0"
          loading="eager"
        />
      </div>
    );
  }

  // Default: 'md' (Header and standard top center)
  return (
    <div
      className={`inline-flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-1.5 bg-white border border-gray-200 shadow-xs rounded-xl transition-all duration-200 hover:shadow-md flex-shrink-0 ${className}`}
      title="Powered by Jishnu Infotech"
    >
      <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-800 whitespace-nowrap select-none flex-shrink-0">
        Powered by
      </span>
      <span className="h-6 sm:h-7 w-px bg-gray-300 flex-shrink-0" />
      <img
        src="/images/jishnu-logo.png"
        alt="Jishnu Infotech"
        className="h-7 sm:h-9 w-auto object-contain drop-shadow-xs flex-shrink-0"
        loading="eager"
      />
    </div>
  );
}
