// src/app/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { sendPasswordResetEmail } from './emailService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Regular client for normal operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client with service role key - BYPASSES RATE LIMITS
// ⚠️ WARNING: Only use in development! Never expose this to the client!
export const supabaseAdmin = supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const isDevelopment = import.meta.env.MODE === 'development';

// ============================================================
// USER AUTHENTICATION
// ============================================================

// Register new user - Uses Admin API to bypass rate limits
export const registerUser = async (email: string, password: string, fullName: string) => {
  console.log('📝 Registering user:', email);
  console.log(`🔧 Mode: ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'}`);
  
  try {
    // Check if user already exists in user_data
    const { data: existingUser, error: checkError } = await supabase
      .from('user_data')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking user:', checkError);
      return { success: false, error: checkError.message };
    }

    if (existingUser) {
      return { 
        success: false, 
        error: 'User already exists. Please login instead.' 
      };
    }

    let authData = null;
    let authError = null;

    // ============================================================
    // DEVELOPMENT MODE: Use Admin API (NO RATE LIMIT, NO EMAIL)
    // ============================================================
    if (isDevelopment && supabaseAdmin) {
      console.log('🔐 DEVELOPMENT: Using Admin API (no rate limit, no email)...');
      
      try {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
          },
        });

        if (error) {
          console.error('❌ Admin API error:', error);
          console.log('⚠️ Admin API failed, falling back to regular signup...');
        } else {
          authData = { user: data.user };
          console.log('✅ Admin API user created (no email sent):', data.user.id);
        }
      } catch (adminErr) {
        console.error('❌ Admin API exception:', adminErr);
        console.log('⚠️ Falling back to regular signup...');
      }
    }

    // ============================================================
    // FALLBACK / PRODUCTION: Use Regular Signup
    // ============================================================
    if (!authData) {
      console.log('🔐 Using regular signup...');
      
      try {
        const result = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (result.error) {
          if (result.error.message.includes('rate limit')) {
            console.log(`⚠️ Rate limit hit!`);
            authError = { 
              message: 'Rate limit exceeded. Please wait a few minutes and try again.' 
            };
          } else {
            authError = result.error;
          }
        } else {
          authData = result.data;
        }
      } catch (err) {
        console.error('❌ Auth registration error:', err);
        authError = err as any;
      }
    }

    // Handle authentication errors
    if (authError) {
      console.error('❌ Auth registration error:', authError);
      
      let errorMessage = authError.message || 'Failed to create account. Please try again.';
      
      if (errorMessage.includes('rate limit')) {
        errorMessage = 'Too many registration attempts. Please wait a few minutes and try again.';
      } else if (errorMessage.includes('already registered')) {
        errorMessage = 'This email is already registered. Please login instead.';
      } else if (errorMessage.includes('password')) {
        errorMessage = 'Password must be at least 6 characters long.';
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }

    if (!authData?.user) {
      return { 
        success: false, 
        error: 'Failed to create user account.' 
      };
    }

    console.log('✅ User created:', authData.user.id);

    // Create user_data record
    console.log('📝 Creating user_data record...');
    
    const payload = {
      email: email,
      password: password,
      full_name: fullName,
      auth_user_id: authData.user.id,
      phone: null,
      role: 'User',
      location: null,
      address: null,
      join_date: null,
      employee_id: null,
      permissions: ['Seasonal Forecast', 'Paint Analyzer'],
      contacts: [],
      profile_picture: null,
      inventory_data: null,
      inventory_data_name: null,
      color_analysis: null,
      uploaded_image: null,
      uploaded_file_name: null,
      uploaded_file_size: null,
      batch_size: 0.1,
      sales_data: null,
      sales_data_name: null,
      forecast_data: null,
      last_fetched: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data: newData, error: insertError } = await supabase
        .from('user_data')
        .insert(payload)
        .select();

      if (insertError) {
        console.error('❌ Error creating user_data:', insertError);
        return { 
          success: true, 
          message: 'Account created but profile setup incomplete. Please contact support.',
          data: null
        };
      }

      console.log('✅ User_data created successfully');
      
      return { 
        success: true, 
        data: newData?.[0] || null,
        message: 'Registration successful! You can now login.'
      };
    } catch (insertErr) {
      console.error('❌ Insert error:', insertErr);
      return { 
        success: true, 
        message: 'Account created but profile setup incomplete. Please contact support.',
        data: null
      };
    }
    
  } catch (error: any) {
    console.error('❌ Error registering user:', error);
    return { success: false, error: error.message || 'Registration failed. Please try again.' };
  }
};

// Login user with Supabase Auth
export const loginUser = async (email: string, password: string) => {
  console.log('🔑 Logging in user:', email);
  
  try {
    let authData = null;
    let authError = null;
    let retries = 3;
    
    while (retries > 0) {
      try {
        const result = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });
        
        if (result.error) {
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

    if (authError) {
      console.error('❌ Auth login error:', authError);
      
      let errorMessage = authError.message || 'Invalid email or password.';
      
      if (errorMessage.includes('rate limit')) {
        errorMessage = 'Too many login attempts. Please wait a few minutes and try again.';
      } else if (errorMessage.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please try again.';
      } else if (errorMessage.includes('Email not confirmed')) {
        errorMessage = 'Please verify your email address before logging in.';
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }

    if (!authData?.user) {
      return { 
        success: false, 
        error: 'Authentication failed.' 
      };
    }

    console.log('✅ Auth login successful:', authData.user.id);

    // Get user data from user_data table
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase Error:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      console.log('⚠️ User found in Auth but not in user_data. Creating record...');
      const payload = {
        email: email,
        password: password,
        full_name: authData.user.user_metadata?.full_name || email,
        auth_user_id: authData.user.id,
        inventory_data: null,
        inventory_data_name: null,
        color_analysis: null,
        uploaded_image: null,
        uploaded_file_name: null,
        uploaded_file_size: null,
        batch_size: 0.1,
        sales_data: null,
        sales_data_name: null,
        forecast_data: null,
        last_fetched: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newData, error: insertError } = await supabase
        .from('user_data')
        .insert(payload)
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error creating user_data record:', insertError);
        return { success: false, error: 'User data not found and could not be created.' };
      }

      const { password: _, ...userWithoutPassword } = newData;
      return { 
        success: true, 
        user: userWithoutPassword,
        token: authData.session?.access_token || ''
      };
    }

    console.log('✅ User logged in successfully!');
    
    const { password: _, ...userWithoutPassword } = data;
    
    return { 
      success: true, 
      user: userWithoutPassword,
      token: authData.session?.access_token || ''
    };
  } catch (error: any) {
    console.error('❌ Error logging in:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// PASSWORD RESET WITH PIN (6-DIGIT) - USING EMAIL SERVICE
// ============================================================

// Generate a 6-digit PIN (re-exported from emailService)
export { generatePIN } from './emailService';

// Save reset token to database
export const saveResetToken = async (email: string, token: string) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Delete any existing unused tokens for this email
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('email', normalizedEmail)
      .eq('used', false);

    // Create new token
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
      })
      .select('id, email, token, expires_at, used, created_at');

    if (error) {
      console.error('❌ Error saving reset token:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Reset token saved for:', normalizedEmail);
    return { success: true, data: data?.[0] || null };
  } catch (error: any) {
    console.error('❌ Error saving reset token:', error);
    return { success: false, error: error.message };
  }
};

// Verify reset token (PIN)
export const verifyResetToken = async (email: string, token: string) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const { data, error } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('token', token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error('❌ Error verifying token:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Invalid or expired PIN' };
    }

    // Mark token as used
    const { error: updateError } = await supabase
      .from('password_reset_tokens')
      .update({ 
        used: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.id);

    if (updateError) {
      console.error('❌ Error marking token as used:', updateError);
      return { success: false, error: 'Failed to verify PIN' };
    }

    console.log('✅ PIN verified successfully for:', normalizedEmail);
    return { success: true, data };
  } catch (error: any) {
    console.error('❌ Error verifying token:', error);
    return { success: false, error: error.message };
  }
};

// Update password in BOTH Supabase Auth AND user_data
export const updateUserPassword = async (email: string, newPassword: string) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // STEP 1: Update password in Supabase Auth
    console.log('🔐 Updating password in Supabase Auth...');
    const { error: authError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (authError) {
      console.error('❌ Error updating auth password:', authError);
      return { success: false, error: authError.message };
    }

    console.log('✅ Auth password updated successfully');

    // STEP 2: Also update password in user_data table
    console.log('📝 Updating password in user_data...');
    const { error: dbError } = await supabase
      .from('user_data')
      .update({ 
        password: newPassword,
        updated_at: new Date().toISOString()
      })
      .eq('email', normalizedEmail);

    if (dbError) {
      console.error('❌ Error updating user_data password:', dbError);
      console.warn('⚠️ Auth password updated but user_data update failed');
      return { 
        success: true, 
        message: 'Password updated successfully!',
        warning: 'Database sync issue, but login will work with new password.'
      };
    }

    // STEP 3: Clean up used tokens
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('email', normalizedEmail)
      .eq('used', true);

    console.log('✅ Password updated successfully in both Auth and user_data');
    return { success: true, message: 'Password updated successfully!' };
  } catch (error: any) {
    console.error('❌ Error updating password:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// SEND PASSWORD RESET EMAIL - Using emailService
// ============================================================

// Send password reset email with PIN
export const sendPasswordResetEmailWithPIN = async (email: string, pin: string) => {
  console.log('📧 Sending password reset PIN to:', email);
  console.log(`🔑 PIN: ${pin}`);
  
  // Use the email service to send the email
  const result = await sendPasswordResetEmail(email, pin);
  
  if (result.success) {
    console.log('✅ Password reset email sent successfully');
  } else {
    console.error('❌ Failed to send password reset email:', result.error);
  }
  
  return result;
};

// ============================================================
// GET CURRENT USER
// ============================================================

export const getCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('❌ Error getting current user:', error);
    return null;
  }
};

export const getCurrentSession = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch (error) {
    console.error('❌ Error getting current session:', error);
    return null;
  }
};

// ============================================================
// USER DATA - CRUD Operations
// ============================================================

export const getUserData = async (email: string) => {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', email)
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
    const payload = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_data')
      .update(payload)
      .eq('email', email);

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

// ============================================================
// PAINT ANALYZER - Data Storage 
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
      .eq('email', email);

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
      .eq('email', email)
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
      .eq('email', email);

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
// SALES FORECASTING - Data Storage
// ============================================================

export const saveSalesForecastData = async (email: string, data: {
  sales_data?: any[];
  sales_data_name?: string;
  forecast_data?: any;
  last_fetched?: string | null;
}) => {
  console.log('📊 Saving Sales Forecast data for user:', email);
  
  try {
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
      .eq('email', email);

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
      .eq('email', email)
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
    const { error } = await supabase
      .from('user_data')
      .update({
        sales_data: null,
        sales_data_name: null,
        forecast_data: null,
        last_fetched: null,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email);

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
// USER PROFILE
// ============================================================

export const saveUserProfile = async (email: string, profileData: any) => {
  console.log('📤 Saving user profile for:', email);
  
  try {
    const payload = {
      email: email,
      full_name: profileData.name || null,
      phone: profileData.phone || null,
      role: profileData.role || null,
      location: profileData.location || null,
      address: profileData.address || null,
      join_date: profileData.joinDate || null,
      employee_id: profileData.employeeId || null,
      permissions: profileData.permissions || [],
      contacts: profileData.contacts || [],
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_data')
      .update(payload)
      .eq('email', email);

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
      .select('full_name, phone, role, location, address, join_date, employee_id, permissions, contacts')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    if (!data) return null;

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
    };
  } catch (error: any) {
    console.error('❌ Error getting user profile:', error);
    return null;
  }
};

// ============================================================
// PROFILE PICTURE
// ============================================================

export const saveProfilePicture = async (email: string, pictureData: string | null) => {
  console.log('📸 Saving profile picture for:', email);
  
  try {
    const payload = {
      email: email,
      profile_picture: pictureData || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_data')
      .update(payload)
      .eq('email', email);

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
      .eq('email', email)
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