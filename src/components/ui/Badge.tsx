import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface BadgeProps {
  children: ReactNode;
  color?: 'green' | 'yellow' | 'gray' | 'red';
}

export const Badge = ({ children, color = 'gray' }: BadgeProps) => {
  const colors = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    gray: 'bg-gray-100 text-gray-800',
    red: 'bg-red-100 text-red-800',
  };
  return (
    <span className={twMerge('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colors[color])}>
      {children}
    </span>
  );
};
