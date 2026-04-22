export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Kardex';
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const DATE_FORMATS = {
  SHORT: 'dd/MM/yyyy',
  LONG: 'dd \'de\' MMMM \'de\' yyyy',
  DATETIME: 'dd/MM/yyyy HH:mm',
} as const;
