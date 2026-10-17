import React from 'react';
import { HiOutlineFolderOpen } from 'react-icons/hi2';

export default function EmptyState({
  icon: Icon = HiOutlineFolderOpen,
  title = 'No records found',
  description = 'There are no items to display at this moment.',
  actionLabel = '',
  onAction = null,
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-xl border border-dashed border-gray-300 shadow-sm my-4">
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-50 text-primary-600 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
