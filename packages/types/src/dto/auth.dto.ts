import type { DocumentType } from '../enums/document-type';

import type { UserPublic } from '../entities/user';

export interface LoginDto {
  documentType: DocumentType;
  documentNumber: string;
  password: string;
}

export interface LoginResponseDto {
  accessToken: string;
  user: UserPublic;
}

export interface RefreshResponseDto {
  accessToken: string;
}

export interface SetupDto {
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  password: string;
  confirmPassword: string;
}

export interface SetupStatusDto {
  setupCompleted: boolean;
}

export interface ForgotPasswordDto {
  documentType: DocumentType;
  documentNumber: string;
}

export interface ForgotPasswordResponseDto {
  // In development, token is returned directly
  // In production, this would be sent via email/handed over manually
  token?: string;
  message: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}
