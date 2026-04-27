import { customAlphabet } from 'nanoid';

// Alfabeto legible: sin 0/O/I/1 para evitar confusión visual
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generate = customAlphabet(ALPHABET, 6);

/**
 * Genera un código único con prefijo para entidades de catálogo.
 * No se muestra al usuario — es identificador interno.
 *
 * @example
 *   generateCode('ITM')   // → "ITM-A4X6K2"
 *   generateCode('OBR')   // → "OBR-C7R5J9"
 */
export function generateCode(prefix: string): string {
  return `${prefix}-${generate()}`;
}
