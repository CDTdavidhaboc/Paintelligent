// src/types/email.types.ts

export interface PasswordResetPin {
  id?: number;
  email: string;
  pin_hash: string;
  expires_at: Date;
  used: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
}

export interface VerifyPinResult {
  valid: boolean;
  message: string;
  reset_token?: string;
}