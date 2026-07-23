// src/app/lib/emailService.ts
import { supabase } from './supabase';
import emailjs from '@emailjs/browser';

// ============================================================
// EMAIL SERVICE - Send Password Reset PINs
// ============================================================

// Generate a 6-digit PIN
export const generatePIN = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Email template for password reset - HTML version
const getPasswordResetEmailHTML = (pin: string, email: string) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f4f4f4;
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #4a9d6f, #2d7a4e);
          padding: 30px 20px;
          border-radius: 12px 12px 0 0;
          text-align: center;
        }
        .header h1 {
          color: white;
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          color: rgba(255,255,255,0.9);
          margin: 5px 0 0;
          font-size: 14px;
        }
        .content {
          padding: 30px 25px;
          background: #ffffff;
        }
        .greeting {
          font-size: 16px;
          color: #333;
          margin-bottom: 20px;
        }
        .greeting strong {
          color: #2d7a4e;
        }
        .message {
          color: #555;
          line-height: 1.6;
          margin-bottom: 25px;
        }
        .pin-container {
          background: #f0f7f4;
          padding: 25px;
          border-radius: 10px;
          text-align: center;
          margin: 20px 0 25px;
          border: 2px dashed #4a9d6f;
        }
        .pin-code {
          font-size: 42px;
          letter-spacing: 12px;
          font-weight: 700;
          color: #2d7a4e;
          font-family: 'Courier New', monospace;
          padding: 10px;
          background: white;
          border-radius: 8px;
          display: inline-block;
          min-width: 200px;
        }
        .pin-label {
          font-size: 14px;
          color: #666;
          margin-bottom: 10px;
          display: block;
        }
        .expiry-info {
          font-size: 13px;
          color: #888;
          text-align: center;
          margin: 15px 0;
        }
        .expiry-info span {
          color: #d32f2f;
          font-weight: 600;
        }
        .divider {
          border: none;
          border-top: 1px solid #eee;
          margin: 25px 0;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #999;
          font-size: 12px;
          border-top: 1px solid #eee;
        }
        .footer a {
          color: #4a9d6f;
          text-decoration: none;
        }
        .footer a:hover {
          text-decoration: underline;
        }
        .security-note {
          background: #fff3e0;
          padding: 12px 15px;
          border-radius: 8px;
          border-left: 4px solid #ff9800;
          margin: 15px 0;
          font-size: 13px;
          color: #666;
        }
        .security-note strong {
          color: #e65100;
        }
        @media only screen and (max-width: 480px) {
          .container { padding: 10px; }
          .content { padding: 20px 15px; }
          .pin-code { font-size: 32px; letter-spacing: 8px; min-width: 150px; }
          .header h1 { font-size: 22px; }
        }
      </style>
    </head>
    <body>
      <div style="background: #f4f4f4; padding: 20px;">
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
            <p>Paintelligent - Garcia Paint Center</p>
          </div>
          
          <div class="content">
            <div class="greeting">
              Hello <strong>${email.split('@')[0]}</strong>,
            </div>
            
            <p class="message">
              We received a request to reset the password for your Paintelligent account.
              Use the 6-digit PIN below to reset your password. This PIN is valid for <strong>10 minutes</strong>.
            </p>
            
            <div class="pin-container">
              <span class="pin-label">Your 6-Digit PIN</span>
              <div class="pin-code">${pin}</div>
            </div>
            
            <div class="expiry-info">
              ⏱️ This PIN will expire in <span>10 minutes</span>
            </div>
            
            <div class="security-note">
              <strong>🔒 Security Note:</strong> 
              Never share this PIN with anyone. Paintelligent will never ask for your PIN via phone or email.
            </div>
            
            <hr class="divider">
            
            <div style="text-align: center;">
              <p style="color: #666; font-size: 14px; margin: 0;">
                Didn't request this reset?
              </p>
              <p style="color: #999; font-size: 13px; margin: 5px 0 0;">
                You can safely ignore this email. Your password will remain unchanged.
              </p>
            </div>
          </div>
          
          <div class="footer">
            <p style="margin: 0 0 5px;">
              &copy; ${new Date().getFullYear()} <a href="${window.location.origin}">Paintelligent</a>
            </p>
            <p style="margin: 0; color: #bbb; font-size: 11px;">
              A Capstone Project for Garcia Paint Center
            </p>
            <p style="margin: 10px 0 0; color: #ddd; font-size: 10px;">
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Plain text version
const getPasswordResetEmailText = (pin: string, email: string) => {
  return `
    PASSWORD RESET - Paintelligent
    
    Hello ${email.split('@')[0]},
    
    We received a request to reset the password for your Paintelligent account.
    
    Your 6-digit PIN is: ${pin}
    
    This PIN is valid for 10 minutes.
    
    Enter this PIN on the password reset page to set a new password.
    
    Security Note: Never share this PIN with anyone. Paintelligent will never ask for your PIN via phone or email.
    
    If you didn't request this reset, you can safely ignore this email.
    
    ---
    © ${new Date().getFullYear()} Paintelligent
    A Capstone Project for Garcia Paint Center
    This is an automated message, please do not reply.
  `;
};

// Send password reset email using EmailJS
export const sendPasswordResetEmail = async (email: string, pin: string) => {
  console.log('📧 Sending password reset PIN to:', email);
  console.log(`🔑 PIN: ${pin}`);
  
  try {
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;

    if (!publicKey || !serviceId || !templateId) {
      console.warn('⚠️ EmailJS credentials not configured. Falling back to console log.');
      return { 
        success: true, 
        message: 'PIN logged to console (EmailJS not configured)' 
      };
    }

    // Initialize EmailJS
    emailjs.init(publicKey);

    // ⚠️ IMPORTANT: The email MUST be passed as to_email parameter
    const templateParams = {
      to_email: email,  // ✅ THIS IS THE KEY - dynamic email
      to_name: email.split('@')[0],
      pin: pin,
      expiry_minutes: '10',
      year: new Date().getFullYear(),
      company_name: 'Paintelligent',
      project_name: 'Garcia Paint Center',
    };

    console.log('📧 Sending to:', templateParams.to_email); // Verify this logs the correct email

    const response = await emailjs.send(
      serviceId,
      templateId,
      templateParams
    );

    console.log('✅ Email sent successfully via EmailJS:', response.status);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Error sending email:', error);
    
    // FALLBACK: If email fails, still log the PIN
    console.log('⚠️ Email failed. PIN would have been:', pin);
    console.log('📧 To:', email);
    
    return { 
      success: true, 
      warning: true,
      message: 'PIN generated but email delivery failed. Please check console for PIN.' 
    };
  }
};

// Resend PIN (with cooldown check)
export const resendPIN = async (email: string, lastSentAt?: Date) => {
  if (lastSentAt) {
    const now = new Date();
    const diff = (now.getTime() - lastSentAt.getTime()) / 1000;
    if (diff < 60) {
      const remaining = Math.ceil(60 - diff);
      return { 
        success: false, 
        error: `Please wait ${remaining} seconds before requesting another PIN.` 
      };
    }
  }
  
  const pin = generatePIN();
  const result = await sendPasswordResetEmail(email, pin);
  return { ...result, pin };
};

// Validate email address
export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  const trimmedEmail = email.trim();
  
  if (!trimmedEmail) {
    return { valid: false, error: 'Email is required' };
  }

  if (trimmedEmail.includes(' ')) {
    return { valid: false, error: 'Email cannot contain spaces' };
  }

  if (!trimmedEmail.includes('@')) {
    return { valid: false, error: 'Email must contain @ symbol' };
  }

  const parts = trimmedEmail.split('@');
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid email format' };
  }

  const localPart = parts[0];
  const domainPart = parts[1];

  if (localPart.length === 0) {
    return { valid: false, error: 'Email must have a username before @' };
  }

  if (localPart.length > 64) {
    return { valid: false, error: 'Email username is too long (max 64 characters)' };
  }

  if (domainPart.length === 0) {
    return { valid: false, error: 'Email must have a domain after @' };
  }

  if (domainPart.length > 255) {
    return { valid: false, error: 'Email domain is too long (max 255 characters)' };
  }

  if (localPart.includes('..') || domainPart.includes('..')) {
    return { valid: false, error: 'Email cannot contain consecutive dots' };
  }

  if (!domainPart.includes('.')) {
    return { valid: false, error: 'Email domain must contain a dot (e.g., .com, .org)' };
  }

  if (domainPart.startsWith('.') || domainPart.endsWith('.')) {
    return { valid: false, error: 'Email domain cannot start or end with a dot' };
  }

  const lastDotIndex = domainPart.lastIndexOf('.');
  const tld = domainPart.substring(lastDotIndex + 1);
  if (tld.length < 2) {
    return { valid: false, error: 'Invalid domain extension (e.g., .com, .org, .net)' };
  }

  return { valid: true };
};

// Check if user exists in database
export const checkUserExists = async (email: string) => {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('❌ Error checking user:', error);
      return { exists: false, error: error.message };
    }

    return { exists: !!data };
  } catch (error: any) {
    console.error('❌ Error checking user:', error);
    return { exists: false, error: error.message };
  }
};