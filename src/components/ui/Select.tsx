import type { SelectHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Option[];
}

export const Select = ({ label, error, options, className, ...props }: SelectProps) => {
  return (
    <div className="w-full text-left">
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      )}
      <select
        className={twMerge(
          'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-200',
          className
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </div>
  );
};
