import type { ButtonHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = ({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) => {
  const base = 'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
  };
  const sizes = {
    sm: 'px-3 py-2 text-sm min-h-10',
    md: 'px-4 py-3 text-base min-h-12',
    lg: 'px-6 py-4 text-lg min-h-14',
  };

  return (
    <button
      type={props.type ?? 'button'}
      className={twMerge(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
};
