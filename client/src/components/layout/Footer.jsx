import React from 'react';

export default function Footer({ className = '' }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`bg-gray-800 text-gray-300 py-3 px-6 border-t border-gray-700 w-full mt-auto ${className}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-center text-xs text-center">
        <p className="text-gray-400">
          &copy; {currentYear} Layout Association Management System. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
