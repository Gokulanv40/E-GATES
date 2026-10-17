import React from 'react';
import { HiArrowTrendingUp, HiArrowTrendingDown } from 'react-icons/hi2';

export default function StatsCard({
  title,
  value,
  icon: Icon,
  change,
  changeType = 'increase', // 'increase' | 'decrease'
  variant = 'blue', // 'blue' | 'green' | 'red' | 'yellow' | 'purple'
  subtitle = '',
  onClick,
}) {
  const colorSchemes = {
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-100',
      badge: 'bg-blue-100 text-blue-800',
    },
    green: {
      bg: 'bg-green-50',
      text: 'text-green-600',
      border: 'border-green-100',
      badge: 'bg-green-100 text-green-800',
    },
    red: {
      bg: 'bg-red-50',
      text: 'text-red-600',
      border: 'border-red-100',
      badge: 'bg-red-100 text-red-800',
    },
    yellow: {
      bg: 'bg-yellow-50',
      text: 'text-yellow-600',
      border: 'border-yellow-100',
      badge: 'bg-yellow-100 text-yellow-800',
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      border: 'border-purple-100',
      badge: 'bg-purple-100 text-purple-800',
    },
  };

  const scheme = colorSchemes[variant] || colorSchemes.blue;

  return (
    <div
      onClick={onClick}
      className={`bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-primary-300 hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500 truncate">{title}</span>
        {Icon && (
          <div className={`w-12 h-12 rounded-xl ${scheme.bg} ${scheme.text} flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{value}</h3>

        {change !== undefined && change !== null && (
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
              changeType === 'increase'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {changeType === 'increase' ? (
              <HiArrowTrendingUp className="w-3.5 h-3.5" />
            ) : (
              <HiArrowTrendingDown className="w-3.5 h-3.5" />
            )}
            <span>{change}</span>
          </div>
        )}
      </div>

      {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}
