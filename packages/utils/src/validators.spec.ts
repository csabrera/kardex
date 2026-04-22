import { describe, expect, it } from 'vitest';

import {
  isStrongPassword,
  isValidEmail,
  validateDocument,
} from './validators';

describe('validateDocument', () => {
  it('should accept valid DNI (8 digits)', () => {
    const result = validateDocument('DNI', '12345678');
    expect(result.valid).toBe(true);
  });

  it('should reject DNI with 7 digits', () => {
    const result = validateDocument('DNI', '1234567');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('8 dígitos');
  });

  it('should reject DNI with letters', () => {
    const result = validateDocument('DNI', '1234567A');
    expect(result.valid).toBe(false);
  });

  it('should accept valid CE (9 digits)', () => {
    const result = validateDocument('CE', '123456789');
    expect(result.valid).toBe(true);
  });

  it('should reject CE with 8 digits', () => {
    const result = validateDocument('CE', '12345678');
    expect(result.valid).toBe(false);
  });

  it('should accept valid PASAPORTE (alphanumeric)', () => {
    const result = validateDocument('PASAPORTE', 'AB123456');
    expect(result.valid).toBe(true);
  });

  it('should reject PASAPORTE with less than 6 chars', () => {
    const result = validateDocument('PASAPORTE', 'AB12');
    expect(result.valid).toBe(false);
  });

  it('should reject PASAPORTE with lowercase', () => {
    const result = validateDocument('PASAPORTE', 'ab123456');
    expect(result.valid).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('should accept valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('should reject invalid email', () => {
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
  });
});

describe('isStrongPassword', () => {
  it('should accept strong password', () => {
    const result = isStrongPassword('MyPassword123');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject password without uppercase', () => {
    const result = isStrongPassword('mypassword123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Al menos una letra mayúscula');
  });

  it('should reject short password', () => {
    const result = isStrongPassword('Abc1');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Mínimo 8 caracteres');
  });
});
