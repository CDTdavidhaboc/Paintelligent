// src/app/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================
// USER AUTHENTICATION
// ============================================================

// Register new user
export const registerUser = async (email: string, password: string, fullName: string) => {
  console.log('📝 Registering user:', email);
  
  try {
    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('user_data')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking user:', checkError);
      return { success: false, error: checkError.message };
    }

    if (existingUser) {
      return { 
        success: false, 
        error: 'User already exists. Please login instead.' 
      };
    }

    // Create new user in user_data table
    const payload = {
      email: email,
      password: password, // In production, hash this!
      full_name: fullName,
      inventory_data: null,
      inventory_data_name: null,
      color_analysis: null,
      uploaded_image: null,
      uploaded_file_name: null,
      uploaded_file_size: null,
      batch_size: 0.1,
      last_fetched: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('user_data')
      .insert(payload)
      .select();

    if (error) {
      console.error('❌ Supabase Error:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ User registered successfully!');
    return { 
      success: true, 
      data: data[0],
      message: 'Registration successful! Please login.'
    };
  } catch (error: any) {
    console.error('❌ Error registering user:', error);
    return { success: false, error: error.message };
  }
};

// Login user
export const loginUser = async (email: string, password: string) => {
  console.log('🔑 Logging in user:', email);
  
  try {
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
      return { 
        success: false, 
        error: 'Invalid email or password.' 
      };
    }

    // In production, compare hashed passwords!
    if (data.password !== password) {
      return { 
        success: false, 
        error: 'Invalid email or password.' 
      };
    }

    console.log('✅ User logged in successfully!');
    
    // Generate a simple token (in production, use JWT)
    const token = btoa(`${email}:${Date.now()}`);
    
    // Return user data without password
    const { password: _, ...userWithoutPassword } = data;
    
    return { 
      success: true, 
      user: userWithoutPassword,
      token: token
    };
  } catch (error: any) {
    console.error('❌ Error logging in:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// USER DATA STORAGE
// ============================================================

// Save user data to Supabase (for PaintComponentAnalyzer)
export const saveUserData = async (email: string, data: any) => {
  console.log('📤 Saving data for user:', email);
  
  try {
    // Prepare the payload with proper field mapping
    const payload = {
      email: email,
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

    // Only update, don't overwrite authentication fields
    const { error } = await supabase
      .from('user_data')
      .update(payload)
      .eq('email', email);

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    console.log('✅ Data saved successfully!');
    return true;
  } catch (error: any) {
    console.error('❌ Error saving user data:', error);
    return false;
  }
};

// Get user data from Supabase
export const getUserData = async (email: string) => {
  console.log('📥 Fetching data for user:', email);

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

// ============================================================
// USER PROFILE (for UserProfile component)
// ============================================================

// Save user profile to Supabase
export const saveUserProfile = async (email: string, profileData: any) => {
  console.log('📤 Saving user profile for:', email);
  
  try {
    // Map profile data to database fields
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

// Get user profile from Supabase
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

    // Map database fields back to profile format
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

// Save profile picture to Supabase
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

// Get profile picture from Supabase
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