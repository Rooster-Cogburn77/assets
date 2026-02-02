import React from 'react';
import { cn } from '@/utils';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost';
  tooltip?: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'md', variant = 'default', tooltip, className, children, ...props }, ref) => {
    const sizes = {
      sm: 'p-1.5',
      md: 'p-2',
      lg: 'p-3',
    };

    const variants = {
      default: 'text-dark-400 hover:text-dark-100 hover:bg-dark-700',
      ghost: 'text-dark-500 hover:text-dark-300 hover:bg-dark-800/50',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-dark-500 focus:ring-offset-2 focus:ring-offset-dark-900',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          sizes[size],
          variants[variant],
          className
        )}
        title={tooltip}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
