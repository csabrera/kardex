'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-[0.9375rem]', className)}
        {...props}
      />
    </div>
  ),
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      // Fondo sólido (antes bg-muted/60) — contraste claro con las filas
      'sticky top-0 z-10 bg-muted backdrop-blur-md [&_tr]:border-b',
      className,
    )}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className,
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      // Todo centrado + negrita + contraste completo (antes: left, semibold, muted/70)
      'h-11 px-4 text-center align-middle text-[11px] font-bold uppercase tracking-[0.08em] text-foreground [&:has([role=checkbox])]:pr-0',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    // Todo centrado (antes: sin alineación → default left de <td>)
    className={cn(
      'px-4 py-3 text-center align-middle [&:has([role=checkbox])]:pr-0',
      className,
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableEmpty = ({
  colSpan,
  children,
}: {
  colSpan: number;
  children?: React.ReactNode;
}) => (
  <TableRow>
    <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
      {children ?? 'Sin resultados'}
    </TableCell>
  </TableRow>
);

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty };
