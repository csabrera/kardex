'use client';

import { AlertTriangle } from 'lucide-react';
import * as React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'default' | 'destructive';
}

type Resolver = (value: boolean) => void;

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolver: Resolver | null;
}

const DEFAULT_STATE: ConfirmState = {
  open: false,
  title: '',
  resolver: null,
};

const ConfirmContext = React.createContext<(opts: ConfirmOptions) => Promise<boolean>>(
  () => {
    throw new Error('useConfirm must be used inside <ConfirmProvider>');
  },
);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmState>(DEFAULT_STATE);

  const confirm = React.useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...DEFAULT_STATE, ...opts, open: true, resolver: resolve });
      }),
    [],
  );

  const handleAction = (confirmed: boolean) => {
    state.resolver?.(confirmed);
    setState((s) => ({ ...s, open: false, resolver: null }));
  };

  const destructive = state.tone === 'destructive';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) handleAction(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              {destructive && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/20">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
              )}
              <div className="flex-1 space-y-1.5">
                <AlertDialogTitle>{state.title}</AlertDialogTitle>
                {state.description && (
                  <AlertDialogDescription>{state.description}</AlertDialogDescription>
                )}
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleAction(false)}>
              {state.cancelText ?? 'Cancelar'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction(true)}
              className={cn(destructive && buttonVariants({ variant: 'destructive' }))}
            >
              {state.confirmText ?? 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return React.useContext(ConfirmContext);
}
