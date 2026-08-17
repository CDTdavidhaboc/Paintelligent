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
// CHECK IF USER EXISTS IN AUTH
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

// ============================================================
// CHECK IF USER EXISTS IN user_data
// ============================================================

export const checkUserExistsInData = async (email: string) => {
  console.log('🔍 Checking if user exists in user_data:', email);
  
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('id, email, auth_user_id, full_name')
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
// LOGIN USER - COMPLETELY FIXED with proper validation
// ============================================================

export const loginUser = async (email: string, password: string) => {
  console.log('🔑 Logging in user:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // ============================================================
    // STEP 1: Validate inputs with clear error messages
    // ============================================================
    if (!normalizedEmail) {
      return { success: false, error: 'Please enter your email address.' };
    }
    
    if (!password || password.length === 0) {
      return { success: false, error: 'Please enter your password.' };
    }
    
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    // ============================================================
    // STEP 2: Check if email exists in Auth
    // ============================================================
    console.log('🔍 Checking if email exists in Auth...');
    const authCheck = await checkAuthUserExists(normalizedEmail);
    
    if (!authCheck.success) {
      console.error('❌ Auth check failed:', authCheck.error);
      return { 
        success: false, 
        error: 'Authentication system error. Please try again.' 
      };
    }

    if (!authCheck.exists) {
      console.log('❌ Email not found in Auth:', normalizedEmail);
      
      // Check if user_data has orphaned record
      const { data: userData } = await supabase
        .from('user_data')
        .select('email')
        .eq('email', normalizedEmail)
        .maybeSingle();
      
      if (userData) {
        console.log('⚠️ Orphaned user_data found for:', normalizedEmail);
        return { 
          success: false, 
          error: 'This account needs to be re-activated. Please contact support.' 
        };
      }
      
      // Clear message - email doesn't exist
      return { 
        success: false, 
        error: 'No account found with this email address. Please check your email or register.' 
      };
    }

    console.log('✅ Email found in Auth');

    // ============================================================
    // STEP 3: Attempt login with Auth ONLY
    // ============================================================
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
      
      // Handle specific error cases with user-friendly messages
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

    // ============================================================
    // STEP 4: Get or create user_data
    // ============================================================
    console.log('✅ Auth login successful:', authData.user.id);

    let { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    // If user_data doesn't exist, create it
    if (!data) {
      console.log('ℹ️ Creating user_data for user...');
      
      const newUserData = {
        email: normalizedEmail,
        auth_user_id: authData.user.id,
        full_name: authData.user.user_metadata?.full_name || normalizedEmail,
        email_verified: authData.user.email_confirmed_at !== null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // NO PASSWORD FIELD
        role: 'User',
        permissions: ['Seasonal Forecast', 'Paint Analyzer'],
        contacts: [],
        batch_size: 0.1,
        phone: null,
        location: null,
        address: null,
        join_date: null,
        employee_id: null,
        profile_picture: null,
        inventory_data: null,
        inventory_data_name: null,
        color_analysis: null,
        uploaded_image: null,
        uploaded_file_name: null,
        uploaded_file_size: null,
        sales_data: null,
        sales_data_name: null,
        forecast_data: null,
        last_fetched: null,
      };

      if (supabaseAdmin) {
        const { data: inserted, error: err } = await supabaseAdmin
          .from('user_data')
          .insert(newUserData)
          .select()
          .single();

        if (!err && inserted) {
          data = inserted;
          console.log('✅ user_data created with Admin client');
        }
      }

      if (!data) {
        const { data: inserted, error: err } = await supabase
          .from('user_data')
          .insert(newUserData)
          .select()
          .single();

        if (!err && inserted) {
          data = inserted;
          console.log('✅ user_data created with regular client');
        }
      }

      if (!data) {
        console.warn('⚠️ Could not create user_data, but login succeeded');
      }
    }

    console.log('✅ User logged in successfully!');
    
    // Remove any password field if it exists
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
// REGISTER USER - COMPLETELY FIXED with proper validation
// ============================================================

export const registerUser = async (email: string, password: string, fullName: string) => {
  console.log('📝 Registering user:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // ============================================================
    // STEP 1: Validate inputs with clear error messages
    // ============================================================
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

    // ============================================================
    // STEP 2: Check if user already exists in Auth
    // ============================================================
    console.log('🔍 Checking if user already exists...');
    const authCheck = await checkAuthUserExists(normalizedEmail);
    
    if (authCheck.exists) {
      console.log('❌ User already exists in Auth');
      return { 
        success: false, 
        error: 'This email is already registered. Please login instead.' 
      };
    }

    // ============================================================
    // STEP 3: Create Auth user
    // ============================================================
    console.log('📝 Creating Auth user...');
    let authData = null;
    let authError = null;

    // Use Admin API in development
    if (isDevelopment && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName.trim(),
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

    // Fallback to regular signup
    if (!authData) {
      try {
        const result = await supabase.auth.signUp({
          email: normalizedEmail,
          password: password,
          options: {
            data: {
              full_name: fullName.trim(),
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
      
      let errorMessage = '';
      
      if (authError?.message?.includes('rate limit')) {
        errorMessage = 'Too many registration attempts. Please wait a few minutes and try again.';
      } else if (authError?.message?.includes('already registered')) {
        errorMessage = 'This email is already registered. Please login instead.';
      } else {
        errorMessage = authError?.message || 'Failed to create account. Please try again.';
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }

    console.log('✅ User authenticated with ID:', authData.user.id);

    // ============================================================
    // STEP 4: Auto-confirm in development
    // ============================================================
    const isEmailConfirmed = authData.user.email_confirmed_at !== null;

    if (isDevelopment && !isEmailConfirmed && supabaseAdmin) {
      console.log('🔄 Auto-confirming email in development...');
      try {
        await supabaseAdmin.auth.admin.updateUserById(
          authData.user.id,
          { email_confirm: true }
        );
        console.log('✅ Email auto-confirmed');
      } catch (err) {
        console.error('❌ Failed to auto-confirm:', err);
      }
    }

    // In production, user needs to confirm email
    if (!isEmailConfirmed && !isDevelopment) {
      return {
        success: true,
        message: 'Registration successful! Please check your email to confirm your account before logging in.',
        data: null,
        requiresConfirmation: true
      };
    }

    // ============================================================
    // STEP 5: Create user_data record (NO PASSWORD)
    // ============================================================
    console.log('📝 Creating user_data record...');
    
    const payload = {
      email: normalizedEmail,
      auth_user_id: authData.user.id,
      full_name: fullName.trim(),
      email_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // NO PASSWORD - Auth is the source of truth
      role: 'User',
      permissions: ['Seasonal Forecast', 'Paint Analyzer'],
      contacts: [],
      batch_size: 0.1,
      phone: null,
      location: null,
      address: null,
      join_date: null,
      employee_id: null,
      profile_picture: null,
      inventory_data: null,
      inventory_data_name: null,
      color_analysis: null,
      uploaded_image: null,
      uploaded_file_name: null,
      uploaded_file_size: null,
      sales_data: null,
      sales_data_name: null,
      forecast_data: null,
      last_fetched: null,
    };

    let newData = null;

    // Try using Admin client first
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

    // Fallback to regular client
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
      console.warn('⚠️ Could not create user_data, but user was created in Auth');
      return { 
        success: true, 
        message: 'Account created but profile setup incomplete. Please login to complete your profile.',
        data: null,
        warning: 'Please login to complete your profile setup.'
      };
    }

    console.log('✅ Registration complete!');
    
    return { 
      success: true, 
      data: newData[0] || null,
      message: isDevelopment 
        ? 'Registration successful! You can now login.' 
        : 'Registration successful! Please check your email to confirm your account.'
    };
    
  } catch (error: any) {
    console.error('❌ Error registering user:', error);
    return { 
      success: false, 
      error: error.message || 'Registration failed. Please try again.' 
    };
  }
};

// ============================================================
// COMPLETE PASSWORD RESET - FIXED with validation
// ============================================================

export const completePasswordReset = async (email: string, newPassword: string) => {
  console.log('🔄 Complete password reset for:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // ============================================================
    // STEP 1: Validate inputs
    // ============================================================
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

    // ============================================================
    // STEP 2: Find the user in Auth
    // ============================================================
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

    // ============================================================
    // STEP 3: Update the Auth password (THIS IS THE ONLY SOURCE OF TRUTH)
    // ============================================================
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

    // ============================================================
    // STEP 4: Force sign out ALL sessions
    // ============================================================
    console.log('🚪 Invalidating ALL sessions...');
    try {
      await supabaseAdmin.auth.admin.signOut(user.id);
      console.log('✅ User sessions invalidated');
    } catch (err) {
      console.warn('⚠️ Could not invalidate sessions:', err);
    }

    // ============================================================
    // STEP 5: Clean up reset tokens
    // ============================================================
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

// ============================================================
// USER DELETION - COMPLETE CLEANUP
// ============================================================

export const deleteUserPermanently = async (email: string) => {
  console.log('🗑️ PERMANENTLY deleting user:', email);
  
  if (!supabaseAdmin) {
    console.error('❌ Admin client not available');
    return { success: false, error: 'Admin client not available' };
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find the user in Auth
    console.log('🔍 Finding Auth user...');
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return { success: false, error: listError.message };
    }

    const user = userList?.users?.find((u: any) => u.email === normalizedEmail);
    
    // Delete from Auth first
    if (user) {
      console.log('🗑️ Deleting Auth user:', user.id);
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      
      if (authError) {
        console.error('❌ Error deleting Auth user:', authError);
        return { success: false, error: authError.message };
      }
      console.log('✅ Auth user deleted');
    }

    // Delete from user_data
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

    // Clean up reset tokens
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
// FORCE SYNC - Ensure Auth and user_data match
// ============================================================

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

    // Check Auth
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = userList?.users?.find((u: any) => u.email === normalizedEmail);
    
    // Check user_data
    const { data: userData } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (authUser && !userData) {
      // Auth exists but user_data doesn't - create it
      console.log('📝 Creating user_data for existing Auth user...');
      
      const newUserData = {
        email: normalizedEmail,
        auth_user_id: authUser.id,
        full_name: authUser.user_metadata?.full_name || normalizedEmail,
        role: 'User',
        permissions: ['Seasonal Forecast', 'Paint Analyzer'],
        contacts: [],
        batch_size: 0.1,
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
      // user_data exists but Auth doesn't - orphaned record
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
      // Both exist - ensure they're linked
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

// ============================================================
// CREATE AUTH USER FOR EXISTING user_data
// ============================================================

export const createAuthUserForExisting = async (email: string, password: string) => {
  console.log('🔧 Creating Auth user for existing user_data:', email);
  
  if (!supabaseAdmin) {
    console.error('❌ Admin client not available');
    return { success: false, error: 'Admin client not available' };
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if user exists in user_data
    const { data: userData, error: userDataError } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (userDataError) {
      console.error('❌ Error checking user_data:', userDataError);
      return { success: false, error: userDataError.message };
    }

    if (!userData) {
      return { success: false, error: 'User not found in user_data' };
    }

    console.log('✅ User found in user_data:', userData);

    // Check if already exists in Auth
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = userList?.users?.find((u: any) => u.email === normalizedEmail);

    if (existingAuthUser) {
      console.log('✅ User already exists in Auth:', existingAuthUser.id);
      
      // Update password
      console.log('🔄 Updating Auth password...');
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingAuthUser.id,
        { password: password }
      );
      
      if (updateError) {
        console.error('❌ Failed to update password:', updateError);
        return { success: false, error: updateError.message };
      }
      
      console.log('✅ Password updated in Auth');
      
      // Update user_data
      await supabase
        .from('user_data')
        .update({ 
          auth_user_id: existingAuthUser.id,
          updated_at: new Date().toISOString()
        })
        .eq('email', normalizedEmail);
      
      return { 
        success: true, 
        user: existingAuthUser,
        message: 'User already exists in Auth. Password updated.'
      };
    }

    // Create user in Auth
    console.log('📝 Creating Auth user...');
    const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: userData.full_name || normalizedEmail,
      },
    });

    if (createError) {
      console.error('❌ Failed to create Auth user:', createError);
      return { success: false, error: createError.message };
    }

    console.log('✅ Auth user created:', data.user.id);

    // Update user_data with auth_user_id
    const { error: updateDataError } = await supabase
      .from('user_data')
      .update({ 
        auth_user_id: data.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('email', normalizedEmail);

    if (updateDataError) {
      console.error('❌ Failed to update user_data:', updateDataError);
    } else {
      console.log('✅ user_data updated with auth_user_id');
    }

    return { 
      success: true, 
      user: data.user,
      message: 'Auth user created successfully'
    };
  } catch (error: any) {
    console.error('❌ Error creating Auth user:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// AUTO-CONFIRM EMAIL IN DEVELOPMENT
// ============================================================

export const confirmUserEmail = async (email: string) => {
  if (!isDevelopment) {
    return { success: false, error: 'Only available in development' };
  }

  if (!supabaseAdmin) {
    console.warn('⚠️ Admin client not available, skipping auto-confirm');
    return { success: false, error: 'Admin client not available' };
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    console.log('📧 Auto-confirming email for:', normalizedEmail);
    
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

    console.log('✅ Email confirmed for:', normalizedEmail);
    return { success: true, message: 'Email confirmed successfully!' };
  } catch (error: any) {
    console.error('❌ Error confirming email:', error);
    return { success: false, error: error.message };
  }
};

export const confirmExistingUser = async (email: string) => {
  console.log('📧 Manually confirming existing user:', email);
  return await confirmUserEmail(email);
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
// USER DATA - CRUD Operations (NO PASSWORD)
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
    // Remove password field if present (should not be stored)
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
// USER PROFILE - COMPLETE WITH ALL FIELDS (NO PASSWORD)
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

// ============================================================
// PROFILE PICTURE - SEPARATE FUNCTIONS
// ============================================================

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
// PASSWORD RESET WITH PIN (6-DIGIT)
// ============================================================

export { generatePIN } from './emailService';

export const saveResetToken = async (email: string, token: string) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Delete old unused tokens
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('email', normalizedEmail)
      .eq('used', false);

    // Set expiration time (10 minutes from now)
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
// DEBUG: Check user status
// ============================================================

export const checkUserStatus = async (email: string) => {
  console.log('🔍 Checking user status for:', email);
  
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check auth.users
    if (supabaseAdmin) {
      const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (!listError && userList?.users) {
        const user = userList.users.find((u: any) => u.email === normalizedEmail);
        
        if (user) {
          console.log('✅ Auth user found:');
          console.log('  - ID:', user.id);
          console.log('  - Email:', user.email);
          console.log('  - Confirmed:', user.email_confirmed_at !== null);
          console.log('  - Created:', user.created_at);
          console.log('  - Last sign in:', user.last_sign_in_at);
        } else {
          console.log('❌ User not found in auth.users');
        }
      }
    }
    
    // Check user_data
    const { data, error } = await supabase
      .from('user_data')
      .select('email, auth_user_id, full_name, created_at')
      .eq('email', normalizedEmail)
      .maybeSingle();
    
    if (error) {
      console.error('❌ Error checking user_data:', error);
    } else if (data) {
      console.log('✅ user_data found:', data);
    } else {
      console.log('❌ user_data not found');
    }
  } catch (error) {
    console.error('❌ Error checking user status:', error);
  }
};