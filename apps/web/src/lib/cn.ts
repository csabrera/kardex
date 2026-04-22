import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names with clsx and dedupes Tailwind classes with twMerge.
 *
 * @example
 * cn('px-4', isActive && 'bg-accent', 'px-6') // → 'bg-accent px-6'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
