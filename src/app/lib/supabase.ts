import { createClient } from '@supabase/supabase-js';
import { sendPasswordResetEmail, generatePIN, sendVerificationEmail } from './emailService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const supabaseAdmin = supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================
// CHECK USER FUNCTIONS
// ============================================================

export const checkAuthUserExists = async (email: string) => {
  console.log('🔍 Checking if user exists in Auth:', email);
  
  try {
    if (!supabaseAdmin) {
      console.log('❌ Admin client not available');
      return { success: false, error: 'Admin client not available', exists: false };
    }

    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return { success: false, error: listError.message, exists: false };
    }

    const user = userList?.users?.find((u: any) => u.email === email.toLowerCase().trim());
    
    if (user) {
      console.log('✅ User found in Auth:', user.id);
      return { success: true, user, exists: true };
    } else {
      console.log('❌ User NOT found in Auth');
      return { success: true, exists: false };
    }
  } catch (error) {
    console.error('❌ Error checking auth user:', error);
    return { success: false, error: String(error), exists: false };
  }
};

export const checkUserExistsInData = async (email: string) => {
  console.log('🔍 Checking if user exists in user_data:', email);
  
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('id, email, auth_user_id, full_name, is_verified')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error('❌ Error checking user_data:', error);
      return { success: false, error: error.message, exists: false };
    }

    if (data) {
      console.log('✅ User found in user_data:', data.id);
      return { success: true, user: data, exists: true };
    } else {
      console.log('❌ User NOT found in user_data');
      return { success: true, exists: false };
    }
  } catch (error: any) {
    console.error('❌ Error checking user_data:', error);
    return { success: false, error: error.message, exists: false };
  }
};

// ============================================================
// REGISTER USER - STEP 1: SEND CODE ONLY
// ============================================================

export const registerUser = async (email: string, password: string, fullName: string) => {
  console.log('📝 Pre-registering user:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!normalizedEmail) {
      return { success: false, error: 'Please enter your email address.' };
    }
    if (!email.includes('@') || !email.includes('.')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password || password.length === 0) {
      return { success: false, error: 'Please enter a password.' };
    }
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }
    if (!fullName || fullName.trim().length === 0) {
      return { success: false, error: 'Please enter your full name.' };
    }

    console.log('🔍 Checking if user already exists...');
    
    const authCheck = await checkAuthUserExists(normalizedEmail);
    if (authCheck.exists) {
      return { 
        success: false, 
        error: 'This email is already registered. Please login instead.' 
      };
    }

    const dataCheck = await checkUserExistsInData(normalizedEmail);
    if (dataCheck.exists) {
      return { 
        success: false, 
        error: 'This email is already registered. Please login instead.' 
      };
    }

    const { data: pendingData } = await supabase
      .from('pending_registrations')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (pendingData) {
      console.log('🗑️ Deleting existing pending registration for:', normalizedEmail);
      await supabase
        .from('pending_registrations')
        .delete()
        .eq('email', normalizedEmail);
    }

    const verificationCode = generatePIN();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    console.log('🔑 Generated verification code:', verificationCode);

    const { error: insertError } = await supabase
      .from('pending_registrations')
      .insert({
        email: normalizedEmail,
        full_name: fullName.trim(),
        password_hash: password,
        verification_code: verificationCode,
        verification_code_expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('❌ Error storing pending registration:', insertError);
      return { 
        success: false, 
        error: 'Failed to start registration. Please try again.' 
      };
    }

    console.log('✅ Pending registration stored successfully');

    try {
      const emailResult = await sendVerificationEmail(normalizedEmail, verificationCode);
      
      if (emailResult.success) {
        console.log('✅ Verification email sent successfully!');
      } else {
        console.error('❌ Failed to send verification email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('❌ Email sending error:', emailError);
    }

    console.log('✅ Pre-registration complete! Verification email sent.');
    
    return { 
      success: true, 
      message: 'Verification code sent! Please check your email.',
      requiresVerification: true
    };
    
  } catch (error: any) {
    console.error('❌ Error in registerUser:', error);
    return { 
      success: false, 
      error: error.message || 'Registration failed. Please try again.' 
    };
  }
};

// ============================================================
// VERIFY REGISTRATION CODE - STEP 2: CREATE ACCOUNT
// ============================================================

export const verifyRegistrationCode = async (email: string, code: string) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    console.log('🔍 Verifying registration code for:', normalizedEmail);
    
    if (!normalizedEmail) {
      return { success: false, error: 'Email is required.' };
    }
    
    if (!code || code.length !== 6) {
      return { success: false, error: 'Please enter a valid 6-digit verification code.' };
    }

    const { data: pendingData, error: pendingError } = await supabase
      .from('pending_registrations')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (pendingError || !pendingData) {
      console.error('❌ Pending registration not found:', pendingError);
      return { success: false, error: 'No pending registration found. Please register again.' };
    }

    if (pendingData.verification_code !== code) {
      console.log('❌ Invalid code. Expected:', pendingData.verification_code, 'Got:', code);
      return { success: false, error: 'Invalid verification code.' };
    }

    const expiresAt = new Date(pendingData.verification_code_expires_at);
    if (new Date() > expiresAt) {
      return { success: false, error: 'Verification code has expired. Please request a new one.' };
    }

    console.log('📝 Creating Auth user for verified email:', normalizedEmail);

    let authData = null;
    let authError = null;

    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: pendingData.password_hash,
          email_confirm: true,
          user_metadata: {
            full_name: pendingData.full_name,
          },
        });
        
        if (error) {
          console.error('❌ Admin API error:', error);
          authError = error;
        } else {
          authData = { user: data.user };
          console.log('✅ User created with Admin API:', data.user.id);
        }
      } catch (adminErr) {
        console.error('❌ Admin API exception:', adminErr);
        authError = adminErr as any;
      }
    }

    if (!authData) {
      try {
        const result = await supabase.auth.signUp({
          email: normalizedEmail,
          password: pendingData.password_hash,
          options: {
            data: {
              full_name: pendingData.full_name,
            },
          },
        });

        if (result.error) {
          console.error('❌ Signup error:', result.error);
          authError = result.error;
        } else {
          authData = result.data;
          console.log('✅ Regular signup successful!');
        }
      } catch (err) {
        console.error('❌ Signup exception:', err);
        authError = err as any;
      }
    }

    if (!authData?.user) {
      console.error('❌ No auth data returned');
      
      let errorMessage = 'Failed to create account. Please try again.';
      if (authError?.message?.includes('already registered')) {
        errorMessage = 'This email is already registered. Please login instead.';
      } else if (authError?.message?.includes('rate limit')) {
        errorMessage = 'Too many registration attempts. Please wait a few minutes and try again.';
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }

    console.log('✅ User authenticated with ID:', authData.user.id);

    console.log('📝 Creating user_data record...');
    
    const payload = {
      email: normalizedEmail,
      auth_user_id: authData.user.id,
      full_name: pendingData.full_name,
      email_verified: true,
      is_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      role: 'User',
      permissions: ['Seasonal Forecast', 'Paint Analyzer'],
      contacts: [],
      batch_size: 0.1,
    };

    let newData = null;

    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('user_data')
          .insert(payload)
          .select();

        if (!error && data) {
          newData = data;
          console.log('✅ user_data created using Admin client');
        }
      } catch (err) {
        console.error('❌ Admin client exception:', err);
      }
    }

    if (!newData) {
      try {
        const { data, error } = await supabase
          .from('user_data')
          .insert(payload)
          .select();

        if (!error && data) {
          newData = data;
          console.log('✅ user_data created using regular client');
        }
      } catch (err) {
        console.error('❌ Regular client exception:', err);
      }
    }

    if (!newData) {
      console.warn('⚠️ Could not create user_data, but Auth user was created');
    }

    await supabase
      .from('pending_registrations')
      .delete()
      .eq('email', normalizedEmail);

    console.log('✅ Account verified and created successfully for:', normalizedEmail);
    
    return { 
      success: true, 
      data: newData?.[0] || null,
      message: 'Account created successfully! Please login.'
    };
    
  } catch (error: any) {
    console.error('❌ Verification error:', error);
    return { success: false, error: error.message || 'Verification failed. Please try again.' };
  }
};

// ============================================================
// RESEND VERIFICATION CODE
// ============================================================

export const resendVerificationCode = async (email: string) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    console.log('📤 Resending verification code for:', normalizedEmail);
    
    if (!normalizedEmail) {
      return { success: false, error: 'Email is required.' };
    }

    const { data: pendingData, error: pendingError } = await supabase
      .from('pending_registrations')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (pendingError || !pendingData) {
      console.error('❌ Pending registration not found:', pendingError);
      return { success: false, error: 'No pending registration found. Please register again.' };
    }

    const newCode = generatePIN();
    console.log('🔑 Generated new verification code:', newCode);
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const { error: updateError } = await supabase
      .from('pending_registrations')
      .update({
        verification_code: newCode,
        verification_code_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('email', normalizedEmail);

    if (updateError) {
      console.error('❌ Error updating verification code:', updateError);
      return { success: false, error: 'Failed to resend code. Please try again.' };
    }

    console.log(`📧 New verification code for ${normalizedEmail}: ${newCode}`);
    
    try {
      const emailResult = await sendVerificationEmail(normalizedEmail, newCode);
      
      if (!emailResult.success) {
        console.error('❌ Failed to resend verification email:', emailResult.error);
        return { 
          success: true, 
          message: 'Code generated but email delivery failed. Please check console for the code.',
          warning: true
        };
      }
    } catch (emailError) {
      console.error('❌ Email sending error:', emailError);
      return { 
        success: true, 
        message: 'Code generated but email delivery failed. Please check console for the code.',
        warning: true
      };
    }

    console.log('✅ Verification code resent successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Resend verification error:', error);
    return { success: false, error: error.message || 'Failed to resend code. Please try again.' };
  }
};

// ============================================================
// LOGIN USER
// ============================================================

export const loginUser = async (email: string, password: string) => {
  console.log('🔑 Logging in user:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!normalizedEmail) {
      return { success: false, error: 'Please enter your email address.' };
    }
    
    if (!password || password.length === 0) {
      return { success: false, error: 'Please enter your password.' };
    }
    
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    console.log('🔍 Checking if email exists in Auth...');
    const authCheck = await checkAuthUserExists(normalizedEmail);
    
    if (!authCheck.success) {
      return { 
        success: false, 
        error: 'Authentication system error. Please try again.' 
      };
    }

    if (!authCheck.exists) {
      return { 
        success: false, 
        error: 'No account found with this email address. Please check your email or register.' 
      };
    }

    console.log('📡 Attempting login with Auth...');
    let authData = null;
    let authError = null;
    let retries = 3;
    
    while (retries > 0) {
      try {
        const result = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: password,
        });
        
        if (result.error) {
          console.log('❌ Login attempt failed:', result.error.message);
          
          if (result.error.message.includes('rate limit')) {
            console.log(`⚠️ Rate limit hit, waiting 2 seconds... (${retries} retries left)`);
            await wait(2000);
            retries--;
            continue;
          }
          
          authError = result.error;
          break;
        }
        
        authData = result.data;
        console.log('✅ Login successful!');
        break;
      } catch (err) {
        console.error('❌ Auth login error:', err);
        if (retries > 1) {
          await wait(2000);
          retries--;
          continue;
        }
        authError = err as any;
        break;
      }
    }

    if (authError || !authData) {
      console.error('❌ Auth login error:', authError);
      
      let errorMessage = '';
      
      if (authError?.message?.includes('Invalid login credentials')) {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (authError?.message?.includes('Email not confirmed')) {
        errorMessage = 'Please verify your email address before logging in. Check your inbox for the confirmation link.';
      } else if (authError?.message?.includes('rate limit')) {
        errorMessage = 'Too many login attempts. Please wait a few minutes and try again.';
      } else if (authError?.message?.includes('user not found')) {
        errorMessage = 'No account found with this email address. Please check your email or register.';
      } else {
        errorMessage = authError?.message || 'Login failed. Please try again.';
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }

    console.log('✅ Auth login successful:', authData.user.id);

    let { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!data) {
      console.log('ℹ️ Creating user_data for user...');
      
      const newUserData = {
        email: normalizedEmail,
        auth_user_id: authData.user.id,
        full_name: authData.user.user_metadata?.full_name || normalizedEmail,
        email_verified: authData.user.email_confirmed_at !== null,
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        role: 'User',
        permissions: ['Seasonal Forecast', 'Paint Analyzer'],
        contacts: [],
        batch_size: 0.1,
      };

      const { data: inserted, error: err } = await supabase
        .from('user_data')
        .insert(newUserData)
        .select()
        .single();

      if (!err && inserted) {
        data = inserted;
        console.log('✅ user_data created');
      }
    }

    console.log('✅ User logged in successfully!');
    
    const { password: _, ...userWithoutPassword } = data || {};
    
    return { 
      success: true, 
      user: userWithoutPassword,
      token: authData.session?.access_token || ''
    };
  } catch (error: any) {
    console.error('❌ Error logging in:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred. Please try again.' 
    };
  }
};

// ============================================================
// PASSWORD RESET FUNCTIONS
// ============================================================

export const saveResetToken = async (email: string, token: string) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('email', normalizedEmail)
      .eq('used', false);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const { data, error } = await supabase
      .from('password_reset_tokens')
      .insert({
        email: normalizedEmail,
        token: token,
        expires_at: expiresAt.toISOString(),
        used: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('❌ Error saving reset token:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data?.[0] || null };
  } catch (error: any) {
    console.error('❌ Error saving reset token:', error);
    return { success: false, error: error.message };
  }
};

export const verifyResetToken = async (email: string, token: string) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date();

    const { data, error } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('token', token)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Invalid or expired PIN' };
    }

    if (data.used) {
      return { success: false, error: 'PIN has already been used' };
    }

    const expiresAt = new Date(data.expires_at);
    if (now > expiresAt) {
      return { success: false, error: 'PIN has expired. Please request a new one.' };
    }

    await supabase
      .from('password_reset_tokens')
      .update({ 
        used: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.id);

    return { success: true, data };
  } catch (error: any) {
    console.error('❌ Error verifying token:', error);
    return { success: false, error: error.message };
  }
};

export const completePasswordReset = async (email: string, newPassword: string) => {
  console.log('🔄 Complete password reset for:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!normalizedEmail) {
      return { success: false, error: 'Email is required.' };
    }
    
    if (!newPassword || newPassword.length === 0) {
      return { success: false, error: 'Please enter a new password.' };
    }
    
    if (newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    if (!supabaseAdmin) {
      console.error('❌ Admin client not available');
      return { success: false, error: 'Password reset service unavailable. Please try again later.' };
    }

    console.log('🔍 Finding user in Auth...');
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return { success: false, error: 'Failed to find user. Please try again.' };
    }

    const user = userList?.users?.find((u: any) => u.email === normalizedEmail);
    
    if (!user) {
      console.log('❌ User not found in Auth');
      return { success: false, error: 'No account found with this email address.' };
    }

    console.log('👤 Found Auth user:', user.id);

    console.log('🔐 Updating Auth password...');
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );
    
    if (authError) {
      console.error('❌ Error updating auth password:', authError);
      return { 
        success: false, 
        error: 'Failed to update password. Please try again.' 
      };
    }
    
    console.log('✅ Auth password updated successfully');

    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('email', normalizedEmail);

    console.log('✅ Password reset completed successfully!');
    
    return { 
      success: true, 
      message: 'Password reset successfully! Please login with your new password.',
      verified: true
    };
    
  } catch (error: any) {
    console.error('❌ Error in completePasswordReset:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred. Please try again.' 
    };
  }
};

export const sendPasswordResetEmailWithPIN = async (email: string, pin: string) => {
  console.log('📧 Sending password reset PIN to:', email);
  console.log(`🔑 PIN: ${pin}`);
  
  const result = await sendPasswordResetEmail(email, pin);
  
  if (result.success) {
    console.log('✅ Password reset email sent successfully');
  } else {
    console.error('❌ Failed to send password reset email:', result.error);
  }
  
  return result;
};

// ============================================================
// USER DATA FUNCTIONS
// ============================================================

export const getUserData = async (email: string) => {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('❌ Error getting user data:', error);
    return null;
  }
};

export const saveUserData = async (email: string, data: any) => {
  try {
    const { password, ...cleanData } = data;
    
    const payload = {
      ...cleanData,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_data')
      .update(payload)
      .eq('email', email.toLowerCase().trim());

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    return true;
  } catch (error: any) {
    console.error('❌ Error saving user data:', error);
    return false;
  }
};

export const confirmUserEmail = async (email: string) => {
  console.log('📧 Auto-confirming email for:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!supabaseAdmin) {
      console.warn('⚠️ Admin client not available');
      return { success: false, error: 'Admin client not available' };
    }

    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return { success: false, error: listError.message };
    }

    const user = userList?.users?.find((u: any) => u.email === normalizedEmail);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (updateError) {
      console.error('❌ Error confirming email:', updateError);
      return { success: false, error: updateError.message };
    }

    await supabase
      .from('user_data')
      .update({
        is_verified: true,
        verification_code: null,
        verification_code_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('email', normalizedEmail);

    console.log('✅ Email confirmed for:', normalizedEmail);
    return { success: true, message: 'Email confirmed successfully!' };
  } catch (error: any) {
    console.error('❌ Error confirming email:', error);
    return { success: false, error: error.message };
  }
};

export const forceSyncUser = async (email: string) => {
  console.log('🔧 Force syncing user:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!normalizedEmail) {
      return { success: false, error: 'Email is required.' };
    }
    
    if (!supabaseAdmin) {
      return { success: false, error: 'Admin client not available' };
    }

    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = userList?.users?.find((u: any) => u.email === normalizedEmail);
    
    const { data: userData } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (authUser && !userData) {
      console.log('📝 Creating user_data for existing Auth user...');
      
      const newUserData = {
        email: normalizedEmail,
        auth_user_id: authUser.id,
        full_name: authUser.user_metadata?.full_name || normalizedEmail,
        role: 'User',
        permissions: ['Seasonal Forecast', 'Paint Analyzer'],
        contacts: [],
        batch_size: 0.1,
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabaseAdmin
        .from('user_data')
        .insert(newUserData);

      if (insertError) {
        console.error('❌ Failed to create user_data:', insertError);
        return { success: false, error: insertError.message };
      }
      
      console.log('✅ user_data created successfully');
      return { success: true, message: 'User synced - user_data created' };
    }

    if (!authUser && userData) {
      console.log('🗑️ Orphaned user_data found - deleting...');
      
      const { error: deleteError } = await supabaseAdmin
        .from('user_data')
        .delete()
        .eq('email', normalizedEmail);

      if (deleteError) {
        console.error('❌ Failed to delete orphaned user_data:', deleteError);
        return { success: false, error: deleteError.message };
      }
      
      console.log('✅ Orphaned user_data deleted');
      return { success: true, message: 'Orphaned user_data deleted' };
    }

    if (authUser && userData) {
      if (userData.auth_user_id !== authUser.id) {
        console.log('🔄 Updating auth_user_id...');
        
        const { error: updateError } = await supabaseAdmin
          .from('user_data')
          .update({ auth_user_id: authUser.id })
          .eq('email', normalizedEmail);

        if (updateError) {
          console.error('❌ Failed to update auth_user_id:', updateError);
          return { success: false, error: updateError.message };
        }
        
        console.log('✅ auth_user_id updated');
        return { success: true, message: 'User sync completed' };
      }
      
      console.log('✅ User is already in sync');
      return { success: true, message: 'User is already in sync' };
    }

    console.log('❌ User not found in either system');
    return { success: false, error: 'User not found in either system' };
  } catch (error: any) {
    console.error('❌ Error syncing user:', error);
    return { success: false, error: error.message };
  }
};

export const deleteUserPermanently = async (email: string) => {
  console.log('🗑️ PERMANENTLY deleting user:', email);
  
  if (!supabaseAdmin) {
    console.error('❌ Admin client not available');
    return { success: false, error: 'Admin client not available' };
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log('🔍 Finding Auth user...');
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return { success: false, error: listError.message };
    }

    const user = userList?.users?.find((u: any) => u.email === normalizedEmail);
    
    if (user) {
      console.log('🗑️ Deleting Auth user:', user.id);
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      
      if (authError) {
        console.error('❌ Error deleting Auth user:', authError);
        return { success: false, error: authError.message };
      }
      console.log('✅ Auth user deleted');
    }

    console.log('📝 Deleting from user_data...');
    const { error: dataError } = await supabaseAdmin
      .from('user_data')
      .delete()
      .eq('email', normalizedEmail);
    
    if (dataError && dataError.code !== 'PGRST116') {
      console.error('❌ Error deleting user_data:', dataError);
    } else {
      console.log('✅ user_data deleted');
    }

    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('email', normalizedEmail);

    console.log('✅ User PERMANENTLY deleted from all systems');
    return { 
      success: true, 
      message: 'User permanently deleted from Auth, user_data, and all related records' 
    };
  } catch (error: any) {
    console.error('❌ Error permanently deleting user:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// PAINT ANALYZER FUNCTIONS
// ============================================================

export const savePaintAnalyzerData = async (email: string, data: {
  inventory_data?: any[];
  inventory_data_name?: string;
  color_analysis?: any;
  uploaded_image?: string;
  uploaded_file_name?: string;
  uploaded_file_size?: string;
  batch_size?: number;
  last_fetched?: string | null;
}) => {
  console.log('🎨 Saving Paint Analyzer data for user:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const payload = {
      inventory_data: data.inventory_data || null,
      inventory_data_name: data.inventory_data_name || null,
      color_analysis: data.color_analysis || null,
      uploaded_image: data.uploaded_image || null,
      uploaded_file_name: data.uploaded_file_name || null,
      uploaded_file_size: data.uploaded_file_size || null,
      batch_size: data.batch_size || 0.1,
      last_fetched: data.last_fetched || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_data')
      .update(payload)
      .eq('email', normalizedEmail);

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    console.log('✅ Paint Analyzer data saved successfully!');
    return true;
  } catch (error: any) {
    console.error('❌ Error saving Paint Analyzer data:', error);
    return false;
  }
};

export const getPaintAnalyzerData = async (email: string) => {
  console.log('🎨 Fetching Paint Analyzer data for user:', email);

  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('inventory_data, inventory_data_name, color_analysis, uploaded_image, uploaded_file_name, uploaded_file_size, batch_size, last_fetched')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('❌ Error getting Paint Analyzer data:', error);
    return null;
  }
};

export const clearPaintAnalyzerData = async (email: string) => {
  console.log('🗑️ Clearing Paint Analyzer data for user:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const { error } = await supabase
      .from('user_data')
      .update({
        inventory_data: null,
        inventory_data_name: null,
        color_analysis: null,
        uploaded_image: null,
        uploaded_file_name: null,
        uploaded_file_size: null,
        batch_size: 0.1,
        last_fetched: null,
        updated_at: new Date().toISOString(),
      })
      .eq('email', normalizedEmail);

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    console.log('✅ Paint Analyzer data cleared successfully!');
    return true;
  } catch (error: any) {
    console.error('❌ Error clearing Paint Analyzer data:', error);
    return false;
  }
};

// ============================================================
// SALES FORECAST FUNCTIONS
// ============================================================

export const saveSalesForecastData = async (email: string, data: {
  sales_data?: any[];
  sales_data_name?: string;
  forecast_data?: any;
  last_fetched?: string | null;
}) => {
  console.log('📊 Saving Sales Forecast data for user:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const payload = {
      sales_data: data.sales_data || null,
      sales_data_name: data.sales_data_name || null,
      forecast_data: data.forecast_data || null,
      last_fetched: data.last_fetched || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_data')
      .update(payload)
      .eq('email', normalizedEmail);

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    console.log('✅ Sales Forecast data saved successfully!');
    return true;
  } catch (error: any) {
    console.error('❌ Error saving Sales Forecast data:', error);
    return false;
  }
};

export const getSalesForecastData = async (email: string) => {
  console.log('📊 Fetching Sales Forecast data for user:', email);

  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('sales_data, sales_data_name, forecast_data, last_fetched')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('❌ Error getting Sales Forecast data:', error);
    return null;
  }
};

export const clearSalesForecastData = async (email: string) => {
  console.log('🗑️ Clearing Sales Forecast data for user:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const { error } = await supabase
      .from('user_data')
      .update({
        sales_data: null,
        sales_data_name: null,
        forecast_data: null,
        last_fetched: null,
        updated_at: new Date().toISOString(),
      })
      .eq('email', normalizedEmail);

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    console.log('✅ Sales Forecast data cleared successfully!');
    return true;
  } catch (error: any) {
    console.error('❌ Error clearing Sales Forecast data:', error);
    return false;
  }
};

// ============================================================
// USER PROFILE FUNCTIONS
// ============================================================

export const saveUserProfile = async (email: string, profileData: any) => {
  console.log('📤 Saving user profile for:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const payload = {
      full_name: profileData.name || null,
      phone: profileData.phone || null,
      role: profileData.role || null,
      location: profileData.location || null,
      address: profileData.address || null,
      join_date: profileData.joinDate || null,
      employee_id: profileData.employeeId || null,
      permissions: profileData.permissions || [],
      contacts: profileData.contacts || [],
      profile_picture: profileData.profile_picture || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_data')
      .update(payload)
      .eq('email', normalizedEmail);

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    console.log('✅ User profile saved successfully!');
    return true;
  } catch (error: any) {
    console.error('❌ Error saving user profile:', error);
    return false;
  }
};

export const getUserProfile = async (email: string) => {
  console.log('📥 Fetching user profile for:', email);

  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('full_name, phone, role, location, address, join_date, employee_id, permissions, contacts, profile_picture')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    if (!data) {
      console.log('ℹ️ No profile data found for:', email);
      return null;
    }

    return {
      name: data.full_name || 'New User',
      phone: data.phone || '',
      role: data.role || 'User',
      location: data.location || '',
      address: data.address || '',
      joinDate: data.join_date || new Date().toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      }),
      employeeId: data.employee_id || `EMP-${Date.now().toString().slice(-6)}`,
      permissions: data.permissions || ['Seasonal Forecast', 'Paint Analyzer'],
      contacts: data.contacts || [],
      profile_picture: data.profile_picture || null,
    };
  } catch (error: any) {
    console.error('❌ Error getting user profile:', error);
    return null;
  }
};

export const saveProfilePicture = async (email: string, pictureData: string | null) => {
  console.log('📸 Saving profile picture for:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const payload = {
      profile_picture: pictureData || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_data')
      .update(payload)
      .eq('email', normalizedEmail);

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    console.log('✅ Profile picture saved successfully!');
    return true;
  } catch (error: any) {
    console.error('❌ Error saving profile picture:', error);
    return false;
  }
};

export const getProfilePicture = async (email: string) => {
  console.log('📥 Fetching profile picture for:', email);

  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('profile_picture')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    return data?.profile_picture || null;
  } catch (error: any) {
    console.error('❌ Error getting profile picture:', error);
    return null;
  }
};

// ============================================================
// PAINT ANALYSIS HISTORY FUNCTIONS
// ============================================================

export const savePaintAnalysisHistory = async (email: string, analysisData: {
  image_url?: string;
  image_name?: string;
  color_hex: string;
  dominant_color: string;
  rgb: { r: number; g: number; b: number };
  paint_components: any[];
  application_guide: any;
  total_price: number;
  batch_size: number;
  analysis_date: string;
  custom_name?: string;
}) => {
  console.log('📝 Saving paint analysis history for user:', email);
  console.log('📊 Data to save:', JSON.stringify(analysisData, null, 2));
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const payload = {
      email: normalizedEmail,
      image_url: analysisData.image_url || null,
      image_name: analysisData.image_name || null,
      color_hex: analysisData.color_hex,
      dominant_color: analysisData.dominant_color,
      rgb: analysisData.rgb,
      paint_components: analysisData.paint_components,
      application_guide: analysisData.application_guide,
      total_price: analysisData.total_price,
      batch_size: analysisData.batch_size,
      analysis_date: analysisData.analysis_date || new Date().toISOString(),
      custom_name: analysisData.custom_name || `${analysisData.dominant_color} - ${analysisData.color_hex}`,
      created_at: new Date().toISOString(),
    };

    console.log('📤 Final payload:', JSON.stringify(payload, null, 2));

    const { data, error } = await supabase
      .from('paint_analysis_history')
      .insert(payload)
      .select();

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    console.log('✅ Paint analysis history saved successfully!', data);
    return { success: true, data: data?.[0] || null };
  } catch (error: any) {
    console.error('❌ Error saving paint analysis history:', error);
    return { success: false, error: error.message };
  }
};

export const getPaintAnalysisHistory = async (email: string) => {
  console.log('📥 Fetching paint analysis history for user:', email);

  try {
    const { data, error } = await supabase
      .from('paint_analysis_history')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .order('analysis_date', { ascending: false });

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} history items for user`);
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('❌ Error getting paint analysis history:', error);
    return { success: false, error: error.message, data: [] };
  }
};

export const getPaintAnalysisById = async (email: string, historyId: string) => {
  console.log('📥 Fetching paint analysis by ID:', historyId);

  try {
    const { data, error } = await supabase
      .from('paint_analysis_history')
      .select('*')
      .eq('id', historyId)
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    return { success: true, data: data || null };
  } catch (error: any) {
    console.error('❌ Error getting paint analysis:', error);
    return { success: false, error: error.message, data: null };
  }
};

export const deletePaintAnalysisHistory = async (email: string, historyId: string) => {
  console.log('🗑️ Deleting paint analysis history:', historyId);

  try {
    const { error } = await supabase
      .from('paint_analysis_history')
      .delete()
      .eq('id', historyId)
      .eq('email', email.toLowerCase().trim());

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    console.log('✅ Paint analysis history deleted successfully!');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error deleting paint analysis history:', error);
    return { success: false, error: error.message };
  }
};

export const clearAllPaintAnalysisHistory = async (email: string) => {
  console.log('🗑️ Clearing all paint analysis history for user:', email);

  try {
    const { error } = await supabase
      .from('paint_analysis_history')
      .delete()
      .eq('email', email.toLowerCase().trim());

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    console.log('✅ All paint analysis history cleared successfully!');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error clearing paint analysis history:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// UPDATE PAINT ANALYSIS HISTORY
// ============================================================

export const updatePaintAnalysisHistory = async (email: string, historyId: string, data: {
  custom_name?: string;
  image_url?: string;
  image_name?: string;
}) => {
  console.log('📝 Updating paint analysis history:', historyId);
  console.log('📊 Update data:', data);

  try {
    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.custom_name !== undefined) payload.custom_name = data.custom_name;
    if (data.image_url !== undefined) payload.image_url = data.image_url;
    if (data.image_name !== undefined) payload.image_name = data.image_name;

    const { error } = await supabase
      .from('paint_analysis_history')
      .update(payload)
      .eq('id', historyId)
      .eq('email', email.toLowerCase().trim());

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    console.log('✅ Paint analysis history updated successfully!');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error updating paint analysis history:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// CHECK IF COLOR ALREADY ANALYZED
// ============================================================

export const findExistingAnalysisByColor = async (email: string, colorHex: string) => {
  console.log('🔍 Finding existing analysis for color:', colorHex);

  try {
    const { data, error } = await supabase
      .from('paint_analysis_history')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('color_hex', colorHex.toLowerCase())
      .order('analysis_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    if (data) {
      console.log('✅ Found existing analysis for color:', colorHex);
    } else {
      console.log('ℹ️ No existing analysis found for color:', colorHex);
    }

    return { success: true, data: data || null };
  } catch (error: any) {
    console.error('❌ Error finding existing analysis:', error);
    return { success: false, error: error.message, data: null };
  }
};