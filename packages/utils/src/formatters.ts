export function formatCurrency(
  value: number,
  currency = 'PEN',
  locale = 'es-PE',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, decimals = 2, locale = 'es-PE'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(
  date: Date | string,
  format: 'short' | 'long' | 'datetime' = 'short',
  locale = 'es-PE',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  const presets = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    datetime: {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  } satisfies Record<string, Intl.DateTimeFormatOptions>;

  const options = presets[format];

  return new Intl.DateTimeFormat(locale, options).format(d);
}

export function formatDocument(type: 'DNI' | 'CE' | 'PASAPORTE', value: string): string {
  if (type === 'DNI' && value.length === 8) {
    return value;
  }
  if (type === 'CE' && value.length === 9) {
    return value;
  }
  return value.toUpperCase();
}

export function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function formatMovementCode(
  type: 'ENTRADA' | 'SALIDA' | 'AJUSTE',
  sequence: number,
): string {
  const prefix = {
    ENTRADA: 'ENT',
    SALIDA: 'SAL',
    AJUSTE: 'AJU',
  }[type];

  return `${prefix}-${String(sequence).padStart(5, '0')}`;
}

export function formatTransferCode(sequence: number): string {
  return `TRF-${String(sequence).padStart(5, '0')}`;
}

export function formatRequisitionCode(sequence: number): string {
  return `REQ-${String(sequence).padStart(5, '0')}`;
}

export function truncate(text: string, maxLength: number, ellipsis = '...'): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}
