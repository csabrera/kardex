export type DocumentType = 'DNI' | 'CE' | 'PASAPORTE';

export const DOCUMENT_REGEX: Record<DocumentType, RegExp> = {
  DNI: /^\d{8}$/,
  CE: /^\d{9}$/,
  PASAPORTE: /^[A-Z0-9]{6,12}$/,
};

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  DNI: 'DNI',
  CE: 'Carné de Extranjería',
  PASAPORTE: 'Pasaporte',
};

export const DOCUMENT_ERROR_MESSAGES: Record<DocumentType, string> = {
  DNI: 'El DNI debe tener exactamente 8 dígitos numéricos',
  CE: 'El Carné de Extranjería debe tener exactamente 9 dígitos numéricos',
  PASAPORTE:
    'El Pasaporte debe tener entre 6 y 12 caracteres alfanuméricos en mayúsculas',
};

export function validateDocument(
  type: DocumentType,
  value: string,
): { valid: boolean; error?: string } {
  const regex = DOCUMENT_REGEX[type];
  if (!regex) {
    return { valid: false, error: 'Tipo de documento no válido' };
  }

  const isValid = regex.test(value);
  if (!isValid) {
    return { valid: false, error: DOCUMENT_ERROR_MESSAGES[type] };
  }

  return { valid: true };
}

export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const regex = /^[\d\s+\-()]{7,20}$/;
  return regex.test(phone);
}

export function isStrongPassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Mínimo 8 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Al menos una letra mayúscula');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Al menos una letra minúscula');
  }
  if (!/\d/.test(password)) {
    errors.push('Al menos un número');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
