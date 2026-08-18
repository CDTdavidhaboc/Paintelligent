import { supabase } from './supabase';
import emailjs from '@emailjs/browser';

// ============================================================
// GENERATE 6-DIGIT PIN/CODE
// ============================================================

export const generatePIN = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ============================================================
// PASSWORD RESET EMAIL - HTML VERSION
// ============================================================

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

// ============================================================
// PASSWORD RESET EMAIL - PLAIN TEXT VERSION
// ============================================================

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

// ============================================================
// REGISTRATION VERIFICATION EMAIL - HTML VERSION
// ============================================================

const getVerificationEmailHTML = (code: string, email: string) => {
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
        .code-container {
          background: #f0f7f4;
          padding: 25px;
          border-radius: 10px;
          text-align: center;
          margin: 20px 0 25px;
          border: 2px dashed #4a9d6f;
        }
        .verification-code {
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
        .code-label {
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
        .btn {
          display: inline-block;
          background: #4a9d6f;
          color: white;
          padding: 12px 30px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          margin: 10px 0;
        }
        .btn:hover {
          background: #2d7a4e;
        }
        @media only screen and (max-width: 480px) {
          .container { padding: 10px; }
          .content { padding: 20px 15px; }
          .verification-code { font-size: 32px; letter-spacing: 8px; min-width: 150px; }
          .header h1 { font-size: 22px; }
        }
      </style>
    </head>
    <body>
      <div style="background: #f4f4f4; padding: 20px;">
        <div class="container">
          <div class="header">
            <h1>✅ Verify Your Email</h1>
            <p>Paintelligent - Garcia Paint Center</p>
          </div>
          
          <div class="content">
            <div class="greeting">
              Hello <strong>${email.split('@')[0]}</strong>,
            </div>
            
            <p class="message">
              Welcome to Paintelligent! Please verify your email address to complete your registration.
              Use the 6-digit verification code below. This code is valid for <strong>10 minutes</strong>.
            </p>
            
            <div class="code-container">
              <span class="code-label">Your 6-Digit Verification Code</span>
              <div class="verification-code">${code}</div>
            </div>
            
            <div class="expiry-info">
              ⏱️ This code will expire in <span>10 minutes</span>
            </div>
            
            <div class="security-note">
              <strong>🔒 Security Note:</strong> 
              Never share this code with anyone. Paintelligent will never ask for your verification code via phone or email.
            </div>
            
            <hr class="divider">
            
            <div style="text-align: center;">
              <p style="color: #666; font-size: 14px; margin: 0;">
                Didn't create an account?
              </p>
              <p style="color: #999; font-size: 13px; margin: 5px 0 0;">
                You can safely ignore this email. No account will be created without verification.
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

// ============================================================
// REGISTRATION VERIFICATION EMAIL - PLAIN TEXT VERSION
// ============================================================

const getVerificationEmailText = (code: string, email: string) => {
  return `
    VERIFY YOUR EMAIL - Paintelligent
    
    Hello ${email.split('@')[0]},
    
    Welcome to Paintelligent! Please verify your email address to complete your registration.
    
    Your 6-digit verification code is: ${code}
    
    This code is valid for 10 minutes.
    
    Enter this code on the verification page to activate your account.
    
    Security Note: Never share this code with anyone. Paintelligent will never ask for your verification code via phone or email.
    
    If you didn't create an account, you can safely ignore this email.
    
    ---
    © ${new Date().getFullYear()} Paintelligent
    A Capstone Project for Garcia Paint Center
    This is an automated message, please do not reply.
  `;
};

// ============================================================
// SEND PASSWORD RESET EMAIL
// ============================================================

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

    emailjs.init(publicKey);

    const templateParams = {
      to_email: email,
      to_name: email.split('@')[0],
      pin: pin,
      expiry_minutes: '10',
      year: new Date().getFullYear(),
      company_name: 'Paintelligent',
      project_name: 'Garcia Paint Center',
      login_url: `${window.location.origin}/login`,
      app_url: window.location.origin,
    };

    console.log('📧 Sending to:', templateParams.to_email);

    const response = await emailjs.send(
      serviceId,
      templateId,
      templateParams
    );

    console.log('✅ Password reset email sent successfully via EmailJS:', response.status);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Error sending password reset email:', error);
    
    console.log('⚠️ Email failed. PIN would have been:', pin);
    console.log('📧 To:', email);
    
    return { 
      success: false, 
      error: error.message || 'Failed to send email'
    };
  }
};

// ============================================================
// SEND REGISTRATION VERIFICATION EMAIL
// ============================================================

export const sendVerificationEmail = async (email: string, code: string) => {
  console.log('📧 Sending verification code to:', email);
  console.log(`🔑 Verification Code: ${code}`);
  
  try {
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const verificationTemplateId = import.meta.env.VITE_EMAILJS_VERIFICATION_TEMPLATE_ID;

    console.log('📧 EmailJS Config:');
    console.log('  - Public Key:', publicKey ? '✅ Set' : '❌ Missing');
    console.log('  - Service ID:', serviceId ? '✅ Set' : '❌ Missing');
    console.log('  - Template ID:', verificationTemplateId ? '✅ Set' : '❌ Missing');

    if (!publicKey || !serviceId || !verificationTemplateId) {
      console.warn('⚠️ EmailJS credentials not configured properly.');
      return { 
        success: false, 
        error: 'Email service not configured properly. Please check your .env file.'
      };
    }

    // Initialize EmailJS
    emailjs.init(publicKey);

    const templateParams = {
      to_email: email,
      to_name: email.split('@')[0],
      verification_code: code,
      expiry_minutes: '10',
      year: new Date().getFullYear(),
      company_name: 'Paintelligent',
      project_name: 'Garcia Paint Center',
      login_url: `${window.location.origin}/login`,
      app_url: window.location.origin,
    };

    console.log('📧 Sending verification to:', templateParams.to_email);
    console.log('📧 Code being sent:', code);

    const response = await emailjs.send(
      serviceId,
      verificationTemplateId,
      templateParams
    );

    console.log('✅ Verification email sent successfully via EmailJS:', response.status);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Error sending verification email:', error);
    console.error('❌ Error details:', error.text || error.message || error);
    
    return { 
      success: false, 
      error: error.text || error.message || 'Failed to send verification email'
    };
  }
};

// ============================================================
// RESEND FUNCTIONS
// ============================================================

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

export const resendVerificationCodeFn = async (email: string, lastSentAt?: Date) => {
  if (lastSentAt) {
    const now = new Date();
    const diff = (now.getTime() - lastSentAt.getTime()) / 1000;
    if (diff < 60) {
      const remaining = Math.ceil(60 - diff);
      return { 
        success: false, 
        error: `Please wait ${remaining} seconds before requesting another code.` 
      };
    }
  }
  
  const code = generatePIN();
  const result = await sendVerificationEmail(email, code);
  return { ...result, code };
};

// ============================================================
// VALIDATE EMAIL
// ============================================================

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

// ============================================================
// CHECK IF USER EXISTS
// ============================================================

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