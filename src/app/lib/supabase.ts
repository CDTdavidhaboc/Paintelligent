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
// FIX: Create Auth user for existing user_data
// ============================================================

export const createAuthUserForExisting = async (email: string, password: string) => {
  console.log('🔧 Creating Auth user for existing user_data:', email);
  
  if (!supabaseAdmin) {
    console.error('❌ Admin client not available');
    return { success: false, error: 'Admin client not available' };
  }

  try {
    // Check if user exists in user_data
    const { data: userData, error: userDataError } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', email)
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
    const existingAuthUser = userList?.users?.find((u: any) => u.email === email);

    if (existingAuthUser) {
      console.log('✅ User already exists in Auth:', existingAuthUser.id);
      
      // Update password if needed
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
      
      return { 
        success: true, 
        user: existingAuthUser,
        message: 'User already exists in Auth. Password updated.'
      };
    }

    // Create user in Auth
    console.log('📝 Creating Auth user...');
    const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: userData.full_name || email,
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
      .eq('email', email);

    if (updateDataError) {
      console.error('❌ Failed to update user_data:', updateDataError);
    } else {
      console.log('✅ user_data updated with auth_user_id');
    }

    // Test login
    console.log('🔑 Testing login...');
    try {
      const testLogin = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      
      if (testLogin.error) {
        console.log('⚠️ Test login failed:', testLogin.error.message);
      } else {
        console.log('✅ Test login successful!');
      }
    } catch (err) {
      console.log('⚠️ Test login error:', err);
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
// FIX: Force create user with both Auth and user_data
// ============================================================

export const forceCreateUser = async (email: string, password: string, fullName: string) => {
  console.log('💪 Force creating user:', email);
  
  if (!supabaseAdmin) {
    console.error('❌ Admin client not available');
    return { success: false, error: 'Admin client not available' };
  }

  try {
    // First, delete any existing user_data
    console.log('🗑️ Cleaning up existing user_data...');
    await supabase
      .from('user_data')
      .delete()
      .eq('email', email);

    // Check if user exists in Auth and delete if exists
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = userList?.users?.find((u: any) => u.email === email);
    
    if (existingAuthUser) {
      console.log('🗑️ Deleting existing Auth user:', existingAuthUser.id);
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
        existingAuthUser.id
      );
      
      if (deleteError) {
        console.error('❌ Failed to delete Auth user:', deleteError);
        // Continue anyway
      } else {
        console.log('✅ Auth user deleted');
      }
    }

    // Wait for deletion to propagate
    await wait(1000);

    // Create new Auth user
    console.log('📝 Creating new Auth user...');
    const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      console.error('❌ Failed to create Auth user:', createError);
      return { success: false, error: createError.message };
    }

    console.log('✅ Auth user created:', data.user.id);

    // Create user_data
    console.log('📝 Creating user_data...');
    const payload = {
      email: email,
      password: null,
      full_name: fullName,
      auth_user_id: data.user.id,
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

    const { error: insertError } = await supabaseAdmin
      .from('user_data')
      .insert(payload);

    if (insertError) {
      console.error('❌ Failed to create user_data:', insertError);
      return { 
        success: true, 
        user: data.user,
        warning: 'User created but user_data insertion failed'
      };
    }

    console.log('✅ user_data created');

    // Test login
    console.log('🔑 Testing login...');
    try {
      const testLogin = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      
      if (testLogin.error) {
        console.log('⚠️ Test login failed:', testLogin.error.message);
      } else {
        console.log('✅ Test login successful!');
      }
    } catch (err) {
      console.log('⚠️ Test login error:', err);
    }

    return { 
      success: true, 
      user: data.user,
      message: 'User created successfully'
    };
  } catch (error: any) {
    console.error('❌ Error force creating user:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// FIX: Sync existing user_data with Auth
// ============================================================

export const syncUserWithAuth = async (email: string, password: string) => {
  console.log('🔄 Syncing user_data with Auth for:', email);
  
  if (!supabaseAdmin) {
    console.error('❌ Admin client not available');
    return { success: false, error: 'Admin client not available' };
  }

  try {
    // Check if user exists in user_data
    const { data: userData, error: userDataError } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (userDataError) {
      console.error('❌ Error checking user_data:', userDataError);
      return { success: false, error: userDataError.message };
    }

    if (!userData) {
      return { success: false, error: 'User not found in user_data' };
    }

    console.log('✅ User found in user_data:', userData);

    // Check if user exists in Auth
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = userList?.users?.find((u: any) => u.email === email);

    let authUser = null;

    if (existingAuthUser) {
      console.log('✅ User already exists in Auth:', existingAuthUser.id);
      authUser = existingAuthUser;
      
      // Update password if needed
      if (password) {
        console.log('🔄 Updating Auth password...');
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingAuthUser.id,
          { password: password }
        );
        
        if (updateError) {
          console.error('❌ Failed to update password:', updateError);
        } else {
          console.log('✅ Password updated in Auth');
        }
      }
    } else {
      console.log('📝 User not found in Auth. Creating now...');
      
      // Create user in Auth
      const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password || 'Temp123!',
        email_confirm: true,
        user_metadata: {
          full_name: userData.full_name || email,
        },
      });

      if (createError) {
        console.error('❌ Failed to create Auth user:', createError);
        return { success: false, error: createError.message };
      }

      authUser = data.user;
      console.log('✅ Auth user created:', authUser.id);

      // Update user_data with auth_user_id
      const { error: updateDataError } = await supabase
        .from('user_data')
        .update({ 
          auth_user_id: authUser.id,
          updated_at: new Date().toISOString()
        })
        .eq('email', email);

      if (updateDataError) {
        console.error('❌ Failed to update user_data with auth_user_id:', updateDataError);
      } else {
        console.log('✅ user_data updated with auth_user_id');
      }
    }

    // Test login
    if (password) {
      console.log('🔑 Testing login...');
      try {
        const testLogin = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });
        
        if (testLogin.error) {
          console.log('⚠️ Test login failed:', testLogin.error.message);
        } else {
          console.log('✅ Test login successful!');
        }
      } catch (err) {
        console.log('⚠️ Test login error:', err);
      }
    }

    return { 
      success: true, 
      user: authUser,
      message: 'User synced with Auth successfully'
    };
  } catch (error: any) {
    console.error('❌ Error syncing user:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// DEBUG: Check if user exists in Auth
// ============================================================

export const checkAuthUserExists = async (email: string) => {
  console.log('🔍 Checking if user exists in Auth:', email);
  
  try {
    if (!supabaseAdmin) {
      console.log('❌ Admin client not available');
      return { success: false, error: 'Admin client not available' };
    }

    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return { success: false, error: listError.message };
    }

    const user = userList?.users?.find((u: any) => u.email === email);
    
    if (user) {
      console.log('✅ User found in Auth:');
      console.log('  - ID:', user.id);
      console.log('  - Email:', user.email);
      console.log('  - Confirmed:', user.email_confirmed_at !== null);
      console.log('  - Created:', user.created_at);
      console.log('  - Last sign in:', user.last_sign_in_at);
      return { success: true, user, exists: true };
    } else {
      console.log('❌ User NOT found in Auth');
      return { success: true, exists: false };
    }
  } catch (error) {
    console.error('❌ Error checking auth user:', error);
    return { success: false, error: String(error) };
  }
};

// ============================================================
// DEBUG: Create user directly using Admin API
// ============================================================

export const createUserDirectly = async (email: string, password: string, fullName: string) => {
  console.log('🔧 Creating user directly with Admin API...');
  console.log('  - Email:', email);
  console.log('  - Password length:', password?.length || 0);
  console.log('  - Full name:', fullName);
  
  if (!supabaseAdmin) {
    console.error('❌ Admin client not available');
    return { success: false, error: 'Admin client not available' };
  }

  try {
    // First check if user already exists
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = userList?.users?.find((u: any) => u.email === email);
    
    if (existingUser) {
      console.log('⚠️ User already exists:', existingUser.id);
      
      // Check if email is confirmed
      if (!existingUser.email_confirmed_at) {
        console.log('🔄 Email not confirmed, confirming now...');
        const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          { email_confirm: true }
        );
        
        if (confirmError) {
          console.error('❌ Failed to confirm email:', confirmError);
        } else {
          console.log('✅ Email confirmed successfully');
        }
      }
      
      return { 
        success: true, 
        user: existingUser, 
        exists: true,
        message: 'User already exists. Email confirmation updated.'
      };
    }

    // Create new user
    console.log('📝 Creating new user...');
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (error) {
      console.error('❌ Error creating user:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ User created successfully!');
    console.log('  - ID:', data.user.id);
    console.log('  - Email:', data.user.email);
    console.log('  - Confirmed:', data.user.email_confirmed_at !== null);
    
    // Create user_data record
    console.log('📝 Creating user_data record...');
    const payload = {
      email: email,
      password: null,
      full_name: fullName,
      auth_user_id: data.user.id,
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

    const { error: insertError } = await supabaseAdmin
      .from('user_data')
      .insert(payload);

    if (insertError) {
      console.error('❌ Error creating user_data:', insertError);
      // Still return success since Auth user was created
      return { 
        success: true, 
        user: data.user, 
        warning: 'User created but user_data insertion failed' 
      };
    }

    console.log('✅ user_data created successfully');
    
    // Test login
    console.log('🔑 Testing login...');
    try {
      const testLogin = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      
      if (testLogin.error) {
        console.log('⚠️ Test login failed:', testLogin.error.message);
      } else {
        console.log('✅ Test login successful!');
      }
    } catch (err) {
      console.log('⚠️ Test login error:', err);
    }

    return { success: true, user: data.user };
  } catch (error: any) {
    console.error('❌ Error in createUserDirectly:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// DEBUG: Reset user password (force reset)
// ============================================================

export const resetUserPassword = async (email: string, newPassword: string) => {
  console.log('🔑 Resetting password for:', email);
  
  if (!supabaseAdmin) {
    console.error('❌ Admin client not available');
    return { success: false, error: 'Admin client not available' };
  }

  try {
    // Find user
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const user = userList?.users?.find((u: any) => u.email === email);
    
    if (!user) {
      console.error('❌ User not found');
      return { success: false, error: 'User not found' };
    }

    console.log('✅ User found:', user.id);
    
    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('❌ Error updating password:', updateError);
      return { success: false, error: updateError.message };
    }

    console.log('✅ Password updated successfully');
    
    // Test login
    try {
      const testLogin = await supabase.auth.signInWithPassword({
        email: email,
        password: newPassword,
      });
      
      if (testLogin.error) {
        console.log('⚠️ Test login failed:', testLogin.error.message);
      } else {
        console.log('✅ Test login successful!');
      }
    } catch (err) {
      console.log('⚠️ Test login error:', err);
    }

    return { success: true, message: 'Password reset successfully' };
  } catch (error: any) {
    console.error('❌ Error resetting password:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// USER AUTHENTICATION
// ============================================================

// Register new user - AUTOMATICALLY FIXES AUTH USER ISSUE
export const registerUser = async (email: string, password: string, fullName: string) => {
  console.log('📝 Registering user:', email);
  console.log('📝 Password length:', password?.length || 0);
  console.log(`🔧 Mode: ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'}`);
  
  try {
    // Validate inputs
    if (!email || !password || !fullName) {
      return { success: false, error: 'All fields are required' };
    }
    
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    // ============================================================
    // STEP 1: Check if user already exists in user_data
    // ============================================================
    const { data: existingUser, error: checkError } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking user:', checkError);
      return { success: false, error: checkError.message };
    }

    // ============================================================
    // STEP 2: If user exists in user_data, check Auth and fix if needed
    // ============================================================
    if (existingUser) {
      console.log('ℹ️ User exists in user_data. Checking Auth...');
      
      // Check if user exists in Auth
      const authCheck = await checkAuthUserExists(email);
      
      if (authCheck.exists) {
        console.log('✅ User exists in Auth. Checking password...');
        
        // Try to login with the provided password
        const testLogin = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });
        
        if (testLogin.error) {
          console.log('⚠️ Password is incorrect or user needs repair.');
          
          // If login fails, update the password
          if (supabaseAdmin) {
            console.log('🔄 Updating Auth password...');
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
              authCheck.user.id,
              { password: password }
            );
            
            if (updateError) {
              console.error('❌ Failed to update password:', updateError);
              return {
                success: false,
                error: 'User exists but password update failed. Please try again.'
              };
            }
            
            console.log('✅ Password updated successfully!');
            return {
              success: true,
              message: 'Password updated successfully! You can now login.',
              data: existingUser
            };
          }
        } else {
          return {
            success: false,
            error: 'User already exists. Please login instead.',
            data: existingUser
          };
        }
      } else {
        // User exists in user_data but not in Auth - AUTO-FIX
        console.log('🔄 User exists in user_data but not in Auth. Auto-creating Auth user...');
        const result = await createAuthUserForExisting(email, password);
        if (result.success) {
          return {
            success: true,
            message: 'Account restored! You can now login.',
            data: existingUser
          };
        } else {
          return {
            success: false,
            error: 'Failed to restore account. Please contact support.'
          };
        }
      }
    }

    // ============================================================
    // STEP 3: Create new user (user doesn't exist in user_data)
    // ============================================================
    let authData = null;
    let authError = null;

    // Check if admin client is available - use it directly in development
    if (isDevelopment && supabaseAdmin) {
      console.log('🚀 Using Admin API for registration (development mode)');
      
      try {
        // Check if user already exists in Auth
        const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = userList?.users?.find((u: any) => u.email === email);
        
        if (existingAuthUser) {
          console.log('⚠️ User already exists in Auth:', existingAuthUser.id);
          
          // Check if email is confirmed
          if (!existingAuthUser.email_confirmed_at) {
            console.log('🔄 Confirming existing user...');
            await supabaseAdmin.auth.admin.updateUserById(
              existingAuthUser.id,
              { email_confirm: true }
            );
          }
          
          authData = { user: existingAuthUser };
          console.log('✅ Using existing Auth user');
        } else {
          // Create user directly with Admin API
          console.log('📝 Creating new user with Admin API...');
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
            authError = error;
          } else {
            authData = { user: data.user };
            console.log('✅ User created with Admin API:', data.user.id);
            console.log('  - Confirmed:', data.user.email_confirmed_at !== null);
          }
        }
      } catch (adminErr) {
        console.error('❌ Admin API exception:', adminErr);
        authError = adminErr as any;
      }
    }

    // Fallback to regular signup (production or if admin fails)
    if (!authData) {
      console.log('📡 Using regular signup...');
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
          console.error('❌ Signup error:', result.error);
          authError = result.error;
          
          // Check if user already exists in Auth
          if (result.error.message.includes('already registered')) {
            // Try to get the existing user
            if (supabaseAdmin) {
              try {
                const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
                const foundUser = userList?.users?.find((u: any) => u.email === email);
                if (foundUser) {
                  authData = { user: foundUser };
                  console.log('✅ Found existing Auth user:', foundUser.id);
                }
              } catch (err) {
                console.error('❌ Could not find existing user:', err);
              }
            }
            
            if (!authData) {
              return {
                success: false,
                error: 'This email is already registered. Please login instead.'
              };
            }
          } else if (result.error.message.includes('rate limit')) {
            return {
              success: false,
              error: 'Too many registration attempts. Please wait a few minutes and try again.'
            };
          } else {
            return {
              success: false,
              error: result.error.message || 'Failed to create account. Please try again.'
            };
          }
        } else {
          authData = result.data;
          console.log('✅ Regular signup successful!');
          console.log('  - User ID:', result.data.user?.id);
          console.log('  - Email confirmed:', result.data.user?.email_confirmed_at !== null);
        }
      } catch (err) {
        console.error('❌ Signup exception:', err);
        authError = err as any;
      }
    }

    if (!authData?.user) {
      console.error('❌ No auth data returned');
      return { 
        success: false, 
        error: authError?.message || 'Failed to create user account.' 
      };
    }

    console.log('✅ User authenticated with ID:', authData.user.id);

    // Wait a moment for Auth to propagate
    console.log('⏳ Waiting for Auth to propagate...');
    await wait(1000);

    // Check if Auth user exists and is confirmed
    const isEmailConfirmed = authData.user.email_confirmed_at !== null;
    console.log(`📧 Email confirmed: ${isEmailConfirmed}`);

    // For development, auto-confirm if not confirmed
    if (isDevelopment && !isEmailConfirmed && supabaseAdmin) {
      console.log('🔄 Auto-confirming email in development...');
      try {
        const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
          authData.user.id,
          { email_confirm: true }
        );
        
        if (!confirmError) {
          console.log('✅ Email auto-confirmed');
          authData.user.email_confirmed_at = new Date().toISOString();
        } else {
          console.error('❌ Failed to auto-confirm:', confirmError);
        }
      } catch (err) {
        console.error('❌ Auto-confirm error:', err);
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

    // Create user_data record
    console.log('📝 Creating user_data record...');
    
    const payload = {
      email: email,
      password: null,
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

    let newData = null;
    let insertError = null;

    // Try using Admin client first (bypasses RLS)
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('user_data')
          .insert(payload)
          .select();

        if (error) {
          console.error('❌ Admin client insert error:', error);
          insertError = error;
        } else {
          newData = data;
          console.log('✅ User_data created using Admin client');
        }
      } catch (err) {
        console.error('❌ Admin client exception:', err);
        insertError = err as any;
      }
    }

    // Fallback to regular client
    if (!newData) {
      console.log('📝 Falling back to regular client...');
      
      try {
        const { data, error } = await supabase
          .from('user_data')
          .insert(payload)
          .select();

        if (error) {
          console.error('❌ Regular client insert error:', error);
          insertError = error;
        } else {
          newData = data;
          console.log('✅ User_data created using regular client');
        }
      } catch (err) {
        console.error('❌ Regular client exception:', err);
        insertError = err as any;
      }
    }

    if (insertError || !newData) {
      console.error('❌ Error creating user_data:', insertError);
      
      // Auth user was created but user_data failed
      // User can still log in - the login function will create user_data
      return { 
        success: true, 
        message: 'Account created but profile setup incomplete. Please login to complete your profile.',
        data: null,
        warning: 'Please login to complete your profile setup.'
      };
    }

    console.log('✅ Registration complete!');
    
    // Verify the user can login immediately (development only)
    if (isDevelopment) {
      console.log('🔑 Testing login with the new credentials...');
      try {
        const testLogin = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });
        
        if (testLogin.error) {
          console.error('⚠️ Immediate login test failed:', testLogin.error.message);
          console.log('💡 This might be due to Auth propagation delay. The user should be able to login shortly.');
        } else {
          console.log('✅ Immediate login test successful!');
        }
      } catch (err) {
        console.error('⚠️ Login test error:', err);
      }
    }
    
    return { 
      success: true, 
      data: newData[0] || null,
      message: isDevelopment 
        ? 'Registration successful! You can now login.' 
        : 'Registration successful! Please check your email to confirm your account.'
    };
    
  } catch (error: any) {
    console.error('❌ Error registering user:', error);
    return { success: false, error: error.message || 'Registration failed. Please try again.' };
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
    console.log('📧 Auto-confirming email for:', email);
    
    // Get user by email
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return { success: false, error: listError.message };
    }

    const user = userList?.users?.find((u: any) => u.email === email);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Update user to confirmed
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (updateError) {
      console.error('❌ Error confirming email:', updateError);
      return { success: false, error: updateError.message };
    }

    console.log('✅ Email confirmed for:', email);
    return { success: true, message: 'Email confirmed successfully!' };
  } catch (error: any) {
    console.error('❌ Error confirming email:', error);
    return { success: false, error: error.message };
  }
};

// For manually confirming existing users
export const confirmExistingUser = async (email: string) => {
  console.log('📧 Manually confirming existing user:', email);
  return await confirmUserEmail(email);
};

// ============================================================
// DEBUG: Check user status
// ============================================================

export const checkUserStatus = async (email: string) => {
  console.log('🔍 Checking user status for:', email);
  
  try {
    // Check auth.users
    if (supabaseAdmin) {
      const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (!listError && userList?.users) {
        const user = userList.users.find((u: any) => u.email === email);
        
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
      .eq('email', email)
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

// ============================================================
// DEBUG: Check Auth user status
// ============================================================

export const debugAuthUser = async (email: string) => {
  console.log('🔍 Debugging Auth user:', email);
  
  try {
    if (!supabaseAdmin) {
      console.log('❌ Admin client not available');
      return;
    }

    // List all users
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }

    const user = userList?.users?.find((u: any) => u.email === email);
    
    if (!user) {
      console.log('❌ User not found in Auth');
      return;
    }

    console.log('✅ Auth user found:');
    console.log('  - ID:', user.id);
    console.log('  - Email:', user.email);
    console.log('  - Created:', user.created_at);
    console.log('  - Confirmed:', user.email_confirmed_at !== null);
    console.log('  - Confirmed at:', user.email_confirmed_at);
    console.log('  - Last sign in:', user.last_sign_in_at);
    console.log('  - User metadata:', user.user_metadata);
    
    // Check if user_data exists
    const { data: userData, error: dataError } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    
    if (dataError) {
      console.error('❌ Error checking user_data:', dataError);
    } else if (userData) {
      console.log('✅ user_data found:');
      console.log('  - ID:', userData.id);
      console.log('  - auth_user_id:', userData.auth_user_id);
      console.log('  - full_name:', userData.full_name);
    } else {
      console.log('❌ user_data not found');
    }
  } catch (error) {
    console.error('❌ Error debugging:', error);
  }
};

// Login user with Supabase Auth - AUTO-FIXES missing Auth users
export const loginUser = async (email: string, password: string) => {
  console.log('🔑 Logging in user:', email);
  console.log('🔑 Password length:', password?.length || 0);
  
  try {
    // Validate inputs
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' };
    }
    
    let authData = null;
    let authError = null;
    let retries = 3;
    
    while (retries > 0) {
      try {
        console.log(`📡 Attempting login (${retries} retries left)...`);
        const result = await supabase.auth.signInWithPassword({
          email: email,
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

    if (authError) {
      console.error('❌ Auth login error:', authError);
      
      let errorMessage = authError.message || 'Invalid email or password.';
      
      if (errorMessage.includes('rate limit')) {
        errorMessage = 'Too many login attempts. Please wait a few minutes and try again.';
      } else if (errorMessage.includes('Invalid login credentials')) {
        // Check if user exists in user_data but not in Auth
        const { data: userData } = await supabase
          .from('user_data')
          .select('*')
          .eq('email', email)
          .maybeSingle();
        
        if (userData) {
          console.log('ℹ️ User exists in user_data but not in Auth. Auto-fixing...');
          
          // AUTO-FIX: Create Auth user
          if (supabaseAdmin) {
            const fixResult = await createAuthUserForExisting(email, password);
            if (fixResult.success) {
              console.log('✅ Auth user created! Retrying login...');
              
              // Retry login
              const retryResult = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
              });
              
              if (!retryResult.error) {
                authData = retryResult.data;
                console.log('✅ Login successful after auto-fix!');
                // Continue to the success flow below
              } else {
                errorMessage = 'Account was repaired but login failed. Please try again.';
              }
            } else {
              errorMessage = 'Account needs repair. Please contact support.';
            }
          } else {
            errorMessage = 'Account needs repair. Please contact support.';
          }
        } else {
          errorMessage = 'Invalid email or password. Please try again.';
        }
      } else if (errorMessage.includes('Email not confirmed')) {
        errorMessage = 'Please verify your email address before logging in.';
      }
      
      if (!authData) {
        return { 
          success: false, 
          error: errorMessage
        };
      }
    }

    if (!authData?.user) {
      return { 
        success: false, 
        error: 'Authentication failed.' 
      };
    }

    console.log('✅ Auth login successful:', authData.user.id);

    // Check if user exists in user_data - CREATE IF MISSING
    let { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase Error:', error);
      return { success: false, error: error.message };
    }

    // If user_data doesn't exist, CREATE IT automatically
    if (!data) {
      console.log('ℹ️ User found in Auth but NOT in user_data. Creating now...');
      
      // Create user_data record
      const newUserData = {
        email: email,
        auth_user_id: authData.user.id,
        full_name: authData.user.user_metadata?.full_name || email,
        email_verified: authData.user.email_confirmed_at !== null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        password: null,
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

      let insertResult = null;
      let insertError = null;

      // Try using Admin client first (bypasses RLS)
      if (supabaseAdmin) {
        try {
          const { data: inserted, error: err } = await supabaseAdmin
            .from('user_data')
            .insert(newUserData)
            .select()
            .single();

          if (err) {
            console.error('❌ Admin client insert error:', err);
            insertError = err;
          } else {
            insertResult = inserted;
            console.log('✅ User_data created using Admin client');
          }
        } catch (err) {
          console.error('❌ Admin client exception:', err);
          insertError = err as any;
        }
      }

      // Fallback to regular client
      if (!insertResult) {
        try {
          const { data: inserted, error: err } = await supabase
            .from('user_data')
            .insert(newUserData)
            .select()
            .single();

          if (err) {
            console.error('❌ Regular client insert error:', err);
            insertError = err;
          } else {
            insertResult = inserted;
            console.log('✅ User_data created using regular client');
          }
        } catch (err) {
          console.error('❌ Regular client exception:', err);
          insertError = err as any;
        }
      }

      if (insertError || !insertResult) {
        console.error('❌ Error creating user_data:', insertError);
        // Still allow login, but with warning
        return {
          success: true,
          user: authData.user,
          token: authData.session?.access_token || '',
          warning: 'Profile data missing. Please update your profile.'
        };
      }

      data = insertResult;
      console.log('✅ User data created successfully!');
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

// Save reset token to database - WITH DEBUGGING
export const saveResetToken = async (email: string, token: string) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const callId = Math.random().toString(36).substring(7);
    
    console.log(`🔵 [${callId}] saveResetToken CALLED`);
    console.log(`🔵 [${callId}] Email:`, normalizedEmail);
    console.log(`🔵 [${callId}] Token:`, token);
    
   
    const { error: deleteError } = await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('email', normalizedEmail)
      .eq('used', false);

    if (deleteError) {
      console.error(`❌ [${callId}] Delete error:`, deleteError);
    }

    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    const expiresAtISO = expiresAt.toISOString();
    
    console.log(`⏰ [${callId}] Expires at:`, expiresAtISO);

    
    const { data, error } = await supabase
      .from('password_reset_tokens')
      .insert({
        email: normalizedEmail,
        token: token,
        expires_at: expiresAtISO,
        used: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id, email, token, expires_at, used, created_at');

    if (error) {
      console.error(`❌ [${callId}] Error saving reset token:`, error);
      return { success: false, error: error.message };
    }

    console.log(`✅ [${callId}] Reset token saved!`);
    console.log(`✅ [${callId}] ID:`, data?.[0]?.id);
    console.log(`✅ [${callId}] Used:`, data?.[0]?.used);
    console.log(`✅ [${callId}] Expires at:`, data?.[0]?.expires_at);
    
    return { success: true, data: data?.[0] || null };
  } catch (error: any) {
    console.error('❌ Error saving reset token:', error);
    return { success: false, error: error.message };
  }
};

// Verify reset token (PIN) - WITH DEBUGGING AND SAFEGUARD
export const verifyResetToken = async (email: string, token: string) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const callId = Math.random().toString(36).substring(7);
    const now = new Date();
    const nowISO = now.toISOString();
    
    console.log(`🔴 [${callId}] verifyResetToken CALLED`);
    console.log(`🔴 [${callId}] Email:`, normalizedEmail);
    console.log(`🔴 [${callId}] Token:`, token);
    console.log(`🔴 [${callId}] Current time:`, nowISO);
    
    // Log the call stack to see who's calling this
    console.log(`🔴 [${callId}] Call stack:`);
    console.trace();

    // First, check if the PIN exists (even if used or expired)
    const { data: checkData, error: checkError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('token', token)
      .maybeSingle();

    if (checkError) {
      console.error(`❌ [${callId}] Check error:`, checkError);
      return { success: false, error: checkError.message };
    }

    if (!checkData) {
      console.log(`❌ [${callId}] No PIN found for this email and token`);
      return { success: false, error: 'Invalid or expired PIN' };
    }

    console.log(`📝 [${callId}] Found PIN:`, {
      id: checkData.id,
      used: checkData.used,
      expires_at: checkData.expires_at
    });

    // Check if already used
    if (checkData.used) {
      console.log(`❌ [${callId}] PIN already used!`);
      return { success: false, error: 'PIN has already been used' };
    }

    // Check if expired
    const expiresAt = new Date(checkData.expires_at);
    if (now > expiresAt) {
      console.log(`❌ [${callId}] PIN expired!`);
      console.log(`   Expires at:`, expiresAt.toISOString());
      console.log(`   Current time:`, nowISO);
      return { success: false, error: 'PIN has expired. Please request a new one.' };
    }

    console.log(`✅ [${callId}] PIN is valid!`);
    console.log(`   Time remaining:`, (expiresAt.getTime() - now.getTime()) / 1000, 'seconds');

    // Mark token as used - with safeguard to prevent race conditions
    const { error: updateError } = await supabase
      .from('password_reset_tokens')
      .update({ 
        used: true,
        updated_at: nowISO
      })
      .eq('id', checkData.id)
      .eq('used', false);

    if (updateError) {
      console.error(`❌ [${callId}] Error marking token as used:`, updateError);
      return { success: false, error: 'Failed to verify PIN' };
    }

    console.log(`✅ [${callId}] PIN marked as used`);
    return { success: true, data: checkData };
  } catch (error: any) {
    console.error('❌ Error verifying token:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// UPDATE PASSWORD - UPDATES BOTH AUTH AND USER_DATA
// ============================================================

export const updateUserPassword = async (email: string, newPassword: string) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log('📝 Updating password for:', normalizedEmail);
    
    let authUpdated = false;
    let userUpdated = false;
    let authErrorMsg = '';

    if (supabaseAdmin) {
      try {
        console.log('🔐 Updating Auth password using admin client...');
        
        const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) {
          console.error('❌ Error listing users:', listError);
          authErrorMsg = listError.message;
        } else {
          const user = userList?.users?.find((u: any) => u.email === normalizedEmail);
          
          if (user) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
              user.id,
              { password: newPassword }
            );
            
            if (authError) {
              console.error('❌ Error updating auth password:', authError);
              authErrorMsg = authError.message;
            } else {
              authUpdated = true;
              console.log('✅ Auth password updated successfully');
            }
          } else {
            console.log('⚠️ User not found in Auth');
            authErrorMsg = 'User not found in Auth';
          }
        }
      } catch (err) {
        console.error('❌ Admin auth update error:', err);
        authErrorMsg = err instanceof Error ? err.message : 'Unknown error';
      }
    } else {
      console.log('⚠️ Admin client not available, skipping Auth update');
      authErrorMsg = 'Admin client not available';
    }

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
    } else {
      userUpdated = true;
      console.log('✅ user_data password updated successfully');
    }

    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('email', normalizedEmail)
      .eq('used', true);

    if (authUpdated && userUpdated) {
      console.log('✅ Password updated successfully in both Auth and user_data');
      return { success: true, message: 'Password updated successfully!' };
    } else if (userUpdated && !authUpdated) {
      console.log('⚠️ Password updated in user_data but Auth update failed:', authErrorMsg);
      return { 
        success: true, 
        message: 'Password updated in database but Auth sync failed. Please contact support.',
        warning: true,
        error: authErrorMsg
      };
    } else if (authUpdated && !userUpdated) {
      console.log('⚠️ Password updated in Auth but user_data update failed');
      return { 
        success: false, 
        error: 'Password updated in Auth but database update failed. Please try again.' 
      };
    } else {
      console.log('❌ Password update failed in both Auth and user_data');
      return { 
        success: false, 
        error: 'Failed to update password. Please try again.' 
      };
    }
  } catch (error: any) {
    console.error('❌ Error updating password:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// SEND PASSWORD RESET EMAIL - Using emailService
// ============================================================

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
// USER PROFILE - COMPLETE WITH ALL FIELDS
// ============================================================

export const saveUserProfile = async (email: string, profileData: any) => {
  console.log('📤 Saving user profile for:', email);
  console.log('📤 Profile data:', profileData);
  
  try {
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

    console.log('📤 Payload to save:', payload);

    const { error } = await supabase
      .from('user_data')
      .update(payload)
      .eq('email', email);

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    console.log('✅ User profile saved successfully to Supabase!');
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
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    if (!data) {
      console.log('ℹ️ No profile data found for:', email);
      return null;
    }

    console.log('📥 Profile data from Supabase:', data);

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
  console.log('📸 Picture data length:', pictureData?.length || 0);
  
  try {
    const payload = {
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

    console.log('✅ Profile picture saved successfully to Supabase!');
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

    console.log('📥 Profile picture:', data?.profile_picture ? 'Found' : 'Not found');
    return data?.profile_picture || null;
  } catch (error: any) {
    console.error('❌ Error getting profile picture:', error);
    return null;
  }
};  