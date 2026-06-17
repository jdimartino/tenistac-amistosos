export const Spinner = ({ className = '' }: { className?: string }) => (
  <div className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
);
