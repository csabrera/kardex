'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';

const OPTIONS: {
  value: 'light' | 'dark' | 'system';
  label: string;
  icon: React.ElementType;
}[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" className="h-10 w-10 p-0" aria-label="Tema" />
    );
  }

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0"
          aria-label="Cambiar tema"
        >
          <Icon className="h-[18px] w-[18px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-40 p-1">
        {OPTIONS.map(({ value, label, icon: IconOpt }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
              theme === value ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
            )}
          >
            <IconOpt className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
