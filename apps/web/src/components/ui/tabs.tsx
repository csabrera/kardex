'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

interface TabsContextValue {
  value: string;
  onChange: (v: string) => void;
}
const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used inside <Tabs>');
  return ctx;
}

interface TabsProps {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onChange: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  badge?: number;
  icon?: React.ElementType;
  className?: string;
}

export function TabsTrigger({
  value,
  children,
  badge,
  icon: Icon,
  className,
}: TabsTriggerProps) {
  const ctx = useTabsContext();
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.onChange(value)}
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all',
        active
          ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
        className,
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
      {badge != null && badge > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 min-w-[18px]',
            active
              ? 'bg-accent text-accent-foreground'
              : 'bg-destructive text-destructive-foreground',
          )}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const ctx = useTabsContext();
  if (ctx.value !== value) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}
