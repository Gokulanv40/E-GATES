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
        <span className="h-4 w-px bg-gray-300 flex-shrink-0" />
        <img
          src="/images/jishnu-logo.png"
          alt="Jishnu Infotech"
          className="h-5 sm:h-6 w-auto object-contain flex-shrink-0"
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
        <span className="h-8 w-px bg-gray-300 flex-shrink-0" />
        <img
          src="/images/jishnu-logo.png"
          alt="Jishnu Infotech"
          className="h-10 sm:h-13 w-auto object-contain drop-shadow-xs flex-shrink-0"
          loading="eager"
        />
      </div>
    );
  }

  // Default: 'md' (Header and standard top center)
  return (
    <div
      className={`inline-flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-white border border-gray-200/90 rounded-xl shadow-xs transition-all duration-200 hover:shadow-md flex-shrink-0 ${className}`}
      title="Powered by Jishnu Infotech"
    >
      <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-800 whitespace-nowrap select-none flex-shrink-0">
        Powered by
      </span>
      <span className="h-5 sm:h-6 w-px bg-gray-300 flex-shrink-0" />
      <img
        src="/images/jishnu-logo.png"
        alt="Jishnu Infotech"
        className="h-6 sm:h-8 w-auto object-contain drop-shadow-xs flex-shrink-0"
        loading="eager"
      />
    </div>
  );
}
