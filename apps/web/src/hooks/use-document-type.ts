'use client';

import { useState } from 'react';

export type DocumentType = 'DNI' | 'CE' | 'PASAPORTE';

interface DocumentTypeConfig {
  label: string;
  placeholder: string;
  maxLength: number;
  pattern: RegExp;
  hint: string;
}

export const DOCUMENT_CONFIGS: Record<DocumentType, DocumentTypeConfig> = {
  DNI: {
    label: 'DNI',
    placeholder: '12345678',
    maxLength: 8,
    pattern: /^\d{8}$/,
    hint: '8 dígitos numéricos',
  },
  CE: {
    label: 'Carnet de Extranjería',
    placeholder: '123456789',
    maxLength: 9,
    pattern: /^\d{9}$/,
    hint: '9 dígitos numéricos',
  },
  PASAPORTE: {
    label: 'Pasaporte',
    placeholder: 'AB123456',
    maxLength: 12,
    pattern: /^[A-Z0-9]{6,12}$/,
    hint: '6–12 caracteres alfanuméricos',
  },
};

export function useDocumentType(initial: DocumentType = 'DNI') {
  const [documentType, setDocumentType] = useState<DocumentType>(initial);
  const config = DOCUMENT_CONFIGS[documentType];

  return { documentType, setDocumentType, config };
}
