import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { 
  LogOut, User, Mail, Phone, MapPin, Calendar, Shield, Activity, Building2, Clock, Camera, 
  Edit2, Save, X, UserPlus, Award, CheckCircle, Pencil, UserCircle, Check, Plus, Trash2, Building, Users, Search,
  Paintbrush, Loader2, AlertTriangle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getUserData, saveUserProfile, saveProfilePicture } from "../lib/supabase";


// Default user data for new users
const DEFAULT_USER_DATA = {
  name: "New User",
  phone: "",
  role: "User",
  location: "",
  address: "",
  email: "",
  joinDate: new Date().toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  }),
  employeeId: `EMP-${Date.now().toString().slice(-6)}`,
  permissions: ["Seasonal Forecast", "Paint Analyzer"],
  contacts: [
    { id: 1, name: "John Doe", email: "john@example.com", phone: "+1 234 567 890", role: "Manager" },
    { id: 2, name: "Jane Smith", email: "jane@example.com", phone: "+1 234 567 891", role: "Coordinator" }
  ]
};

// Ensure both permissions always exist
const ENSURE_PERMISSIONS = ["Seasonal Forecast", "Paint Analyzer"];

export default function UserProfile() {
  const navigate = useNavigate();
  const { logout, userEmail } = useAuth();
  
  // States
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastLoginDate, setLastLoginDate] = useState("");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [tempProfilePicture, setTempProfilePicture] = useState<string | null>(null);
  const [userData, setUserData] = useState(DEFAULT_USER_DATA);
  const [tempUserData, setTempUserData] = useState(DEFAULT_USER_DATA);
  const [isNewUser, setIsNewUser] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [localAddress, setLocalAddress] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 80);
    return () => clearTimeout(timer);
  }, []);

  // Get user-specific storage keys
  const getUserStorageKey = (key: string) => {
    return `user_${userEmail}_${key}`;
  };

  // Load user data from Supabase AND localStorage
  useEffect(() => {
    const loadUserData = async () => {
      if (!userEmail) {
        setIsLoading(false);
        return;
      }

      console.log("🔄 Loading user data for:", userEmail);

      // FIRST: Try to load from Supabase (source of truth)
      try {
        const supabaseData = await getUserData(userEmail);
        
        if (supabaseData) {
          console.log("📥 Loaded user data from Supabase:", supabaseData);
          
          const profileData = {
            name: supabaseData.full_name || supabaseData.name || "New User",
            phone: supabaseData.phone || "",
            role: supabaseData.role || "User",
            location: supabaseData.location || "",
            address: supabaseData.address || "",
            email: userEmail,
            joinDate: supabaseData.join_date || new Date().toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric' 
            }),
            employeeId: supabaseData.employee_id || `EMP-${Date.now().toString().slice(-6)}`,
            permissions: supabaseData.permissions || ["Seasonal Forecast", "Paint Analyzer"],
            contacts: supabaseData.contacts || DEFAULT_USER_DATA.contacts,
          };
          
          setUserData(profileData);
          setTempUserData(profileData);
          setLocalAddress(profileData.address || '');
          setIsNewUser(false);
          
          // Load picture from Supabase
          if (supabaseData.profile_picture) {
            console.log("📸 Loaded picture from Supabase");
            setProfilePicture(supabaseData.profile_picture);
            setTempProfilePicture(supabaseData.profile_picture);
          }
          
          // Cache in localStorage for faster loading
          const userDataKey = getUserStorageKey('profileData');
          localStorage.setItem(userDataKey, JSON.stringify(profileData));
          
          // Save name separately
          const userNameKey = getUserStorageKey('userName');
          localStorage.setItem(userNameKey, profileData.name);
          
          // Save picture separately
          if (supabaseData.profile_picture) {
            const userPictureKey = getUserStorageKey('profilePicture');
            localStorage.setItem(userPictureKey, supabaseData.profile_picture);
            localStorage.setItem('userProfilePicture', supabaseData.profile_picture);
          }
          
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error("Error loading from Supabase:", error);
      }

      // SECOND: Fallback to localStorage
      const userDataKey = getUserStorageKey('profileData');
      const userPictureKey = getUserStorageKey('profilePicture');
      const userNameKey = getUserStorageKey('userName');
      
      let savedUserData = localStorage.getItem(userDataKey);
      let savedPicture = localStorage.getItem(userPictureKey);
      let savedName = localStorage.getItem(userNameKey);
      
      // Fallback to global keys if not found
      if (!savedUserData) {
        savedUserData = localStorage.getItem("userProfileData");
      }
      if (!savedPicture) {
        savedPicture = localStorage.getItem("userProfilePicture");
      }
      if (!savedName) {
        savedName = localStorage.getItem("userName");
      }
      
      // Load picture from localStorage
      if (savedPicture) {
        console.log("📸 Loaded picture from localStorage");
        setProfilePicture(savedPicture);
        setTempProfilePicture(savedPicture);
      }

      // Load user data from localStorage
      if (savedUserData) {
        console.log("📥 Loaded user data from localStorage");
        const parsedData = JSON.parse(savedUserData);
        
        if (!parsedData.email && userEmail) {
          parsedData.email = userEmail;
        }
        
        delete parsedData.department;
        
        const existingPermissions = parsedData.permissions || [];
        const combinedPermissions = [...new Set([...existingPermissions, ...ENSURE_PERMISSIONS])];
        parsedData.permissions = combinedPermissions;
        
        if (!parsedData.contacts) {
          parsedData.contacts = DEFAULT_USER_DATA.contacts;
        }
        
        // Use saved name if available
        if (savedName) {
          parsedData.name = savedName;
        }
        
        setUserData(parsedData);
        setTempUserData(parsedData);
        setLocalAddress(parsedData.address || '');
        setIsNewUser(false);
        setIsLoading(false);
        return;
      }

      // If nothing works, create default user
      const emailName = userEmail?.split('@')[0] || "New User";
      const formattedName = savedName || emailName
        .split(/[._-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || "New User";
      
      const defaultData = {
        ...DEFAULT_USER_DATA,
        name: formattedName,
        email: userEmail || "",
      };
      
      setUserData(defaultData);
      setTempUserData(defaultData);
      setLocalAddress(defaultData.address || '');
      setIsNewUser(true);
      
      // Save to localStorage
      localStorage.setItem(userDataKey, JSON.stringify(defaultData));
      localStorage.setItem(userNameKey, formattedName);
      
      setIsLoading(false);
    };

    loadUserData();
  }, [userEmail]);

  // Update last login date
  useEffect(() => {
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'long' });
    const day = now.getDate();
    const year = now.getFullYear();
    const time = now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    setLastLoginDate(`${month} ${day}, ${year} at ${time}`);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  // Show notification function
  const showNotificationMessage = (message: string) => {
    setNotificationMessage(message);
    setShowNotification(true);
    
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    
    notificationTimeoutRef.current = setTimeout(() => {
      setShowNotification(false);
      notificationTimeoutRef.current = null;
    }, 3000);
  };

  // Save user data to localStorage AND Supabase
  const saveUserData = async (data: any) => {
    try {
      console.log("💾 Saving user data:", data);
      
      delete data.department;
      
      const existingPermissions = data.permissions || [];
      const combinedPermissions = [...new Set([...existingPermissions, ...ENSURE_PERMISSIONS])];
      
      const dataToSave = {
        ...data,
        permissions: combinedPermissions,
      };
      
      console.log("💾 Data to save:", dataToSave);
      
      // Save to localStorage
      const userDataKey = getUserStorageKey('profileData');
      localStorage.setItem(userDataKey, JSON.stringify(dataToSave));
      localStorage.setItem('userProfileData', JSON.stringify(dataToSave));
      
      // Save name separately
      const userNameKey = getUserStorageKey('userName');
      localStorage.setItem(userNameKey, dataToSave.name);
      localStorage.setItem('userName', dataToSave.name);
      
      // Save picture separately if it exists
      if (profilePicture) {
        const userPictureKey = getUserStorageKey('profilePicture');
        localStorage.setItem(userPictureKey, profilePicture);
        localStorage.setItem('userProfilePicture', profilePicture);
      }
      
      // SAVE TO SUPABASE - Include ALL fields
      if (userEmail) {
        console.log("📤 Saving to Supabase with data:", {
          name: dataToSave.name,
          phone: dataToSave.phone,
          role: dataToSave.role,
          location: dataToSave.location,
          address: dataToSave.address,
          joinDate: dataToSave.joinDate,
          employeeId: dataToSave.employeeId,
          permissions: dataToSave.permissions,
          contacts: dataToSave.contacts,
          profile_picture: profilePicture || null,
        });
        
        try {
          const saveResult = await saveUserProfile(userEmail, {
            name: dataToSave.name,
            phone: dataToSave.phone,
            role: dataToSave.role,
            location: dataToSave.location,
            address: dataToSave.address,
            joinDate: dataToSave.joinDate,
            employeeId: dataToSave.employeeId,
            permissions: dataToSave.permissions,
            contacts: dataToSave.contacts,
            profile_picture: profilePicture || null,
          });
          
          if (saveResult) {
            console.log("✅ Successfully saved all profile data to Supabase");
          } else {
            console.warn("⚠️ Failed to save to Supabase");
          }
        } catch (error) {
          console.warn("⚠️ Error saving to Supabase:", error);
        }
      }
      
      setUserData(dataToSave);
      setLocalAddress(dataToSave.address || '');
      setIsNewUser(false);
      
      // Dispatch event to update Layout
      window.dispatchEvent(new CustomEvent('profileUpdated', { 
        detail: { name: dataToSave.name } 
      }));
      
      return true;
    } catch (error) {
      console.error("Error saving user data:", error);
      return false;
    }
  };

  // Handle edit toggle
  const handleEditToggle = () => {
    if (isEditing) {
      setTempUserData(userData);
      setTempProfilePicture(profilePicture);
      setLocalAddress(userData.address || '');
      showNotificationMessage("Changes cancelled");
    } else {
      setTempUserData(userData);
      setTempProfilePicture(profilePicture);
      setLocalAddress(userData.address || '');
    }
    setIsEditing(!isEditing);
  };

  // Handle save
  const handleSave = async () => {
    try {
      // First save the user data (name, phone, location, address, etc.)
      const saveSuccess = await saveUserData(tempUserData);
      
      if (!saveSuccess) {
        showNotificationMessage("Error saving profile data ❌");
        return;
      }
      
      // Then save picture if changed
      if (tempProfilePicture !== profilePicture) {
        const userPictureKey = getUserStorageKey('profilePicture');
        if (tempProfilePicture) {
          // Save to localStorage
          localStorage.setItem(userPictureKey, tempProfilePicture);
          localStorage.setItem('userProfilePicture', tempProfilePicture);
          setProfilePicture(tempProfilePicture);
          
          // Also save picture to Supabase
          if (userEmail) {
            try {
              await saveProfilePicture(userEmail, tempProfilePicture);
              console.log("📸 Picture saved to Supabase");
            } catch (error) {
              console.warn("⚠️ Failed to save picture to Supabase:", error);
            }
          }
          
          console.log("📸 Picture saved to localStorage");
        } else {
          // Remove picture
          localStorage.removeItem(userPictureKey);
          localStorage.removeItem('userProfilePicture');
          setProfilePicture(null);
          
          // Also remove picture from Supabase
          if (userEmail) {
            try {
              await saveProfilePicture(userEmail, null);
              console.log("📸 Picture removed from Supabase");
            } catch (error) {
              console.warn("⚠️ Failed to remove picture from Supabase:", error);
            }
          }
          
          console.log("📸 Picture removed from localStorage");
        }
      }
      
      setIsEditing(false);
      showNotificationMessage("Profile saved successfully! ✅");
      
      // Dispatch event again for redundancy
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('profileUpdated', { 
          detail: { name: tempUserData.name } 
        }));
      }, 100);
      
    } catch (error) {
      console.error("Save error:", error);
      showNotificationMessage("Error saving profile ❌");
    }
  };

  // Handle input change
  const handleInputChange = useCallback((field: string, value: string) => {
    setTempUserData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Contact management functions
  const handleAddContact = () => {
    const newContact = {
      id: Date.now(),
      name: "",
      email: "",
      phone: "",
      role: ""
    };
    setTempUserData(prev => ({
      ...prev,
      contacts: [...(prev.contacts || []), newContact]
    }));
  };

  const handleRemoveContact = (id: number) => {
    setTempUserData(prev => ({
      ...prev,
      contacts: (prev.contacts || []).filter(contact => contact.id !== id)
    }));
  };

  const handleContactChange = (id: number, field: string, value: string) => {
    setTempUserData(prev => ({
      ...prev,
      contacts: (prev.contacts || []).map(contact => 
        contact.id === id ? { ...contact, [field]: value } : contact
      )
    }));
  };

  // Handle logout with confirmation
  const handleLogoutWithConfirmation = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = () => {
    setShowLogoutDialog(false);
    
    console.log("🔴 Logging out...");
    
    try {
      // Clear all user data from localStorage
      if (userEmail) {
        const keysToRemove = [
          `user_${userEmail}_profileData`,
          `user_${userEmail}_profilePicture`,
          `user_${userEmail}_userName`,
          'userProfileData',
          'userProfilePicture',
          'userName'
        ];
        
        keysToRemove.forEach(key => {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            console.log(`🗑️ Removed localStorage key: ${key}`);
          }
        });
      }
      
      // Call logout from context
      logout();
      console.log("✅ Logout successful");
      
      // Navigate to login
      window.location.href = "/login";
      
    } catch (error) {
      console.error("❌ Logout error:", error);
      // Emergency fallback - force redirect
      window.location.href = "/login";
    }
  };

  // Handle profile picture
  const handleProfilePictureClick = () => {
    if (isEditing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isEditing) return;
    
    console.log("📸 File selected:", file.name, file.size, file.type);
    
    if (!file.type.startsWith('image/')) {
      showNotificationMessage("Please select an image file");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      showNotificationMessage("Image size should be less than 5MB");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      console.log("📸 Image loaded, data length:", imageData.length);
      
      // Update states
      setTempProfilePicture(imageData);
      setProfilePicture(imageData);
      
      // Save to localStorage immediately
      if (userEmail) {
        const key = getUserStorageKey('profilePicture');
        try {
          localStorage.setItem(key, imageData);
          localStorage.setItem('userProfilePicture', imageData);
          console.log("📸 Picture saved to localStorage");
          
          showNotificationMessage("Picture uploaded! 📸");
        } catch (err) {
          console.error("❌ Save error:", err);
          showNotificationMessage("Error saving picture");
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePicture = () => {
    if (!isEditing) return;
    
    console.log("📸 Removing picture");
    
    setTempProfilePicture(null);
    setProfilePicture(null);
    
    if (userEmail) {
      localStorage.removeItem(getUserStorageKey('profilePicture'));
      localStorage.removeItem('userProfilePicture');
      console.log("📸 Picture removed from localStorage");
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    showNotificationMessage("Picture removed");
  };

  const displayData = isEditing ? tempUserData : userData;
  const displayPicture = isEditing ? tempProfilePicture : profilePicture;

  // Sync localAddress with displayData.address
  useEffect(() => {
    setLocalAddress(displayData.address || '');
  }, [displayData.address]);

  // Filter contacts based on search term
  const filteredContacts = useMemo(() => {
    return (displayData.contacts || []).filter((contact: any) =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone.includes(searchTerm) ||
      contact.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [displayData.contacts, searchTerm]);

  // Editable field component - memoized to prevent unnecessary re-renders
  const EditableField = useMemo(() => {
    return function EditableField({ label, value, field, type = "text", icon: Icon, readOnly = false }: any) {
      if (isEditing && !readOnly) {
        return (
          <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Icon className="size-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
              <input
                type={type}
                value={value || ''}
                onChange={(e) => handleInputChange(field, e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#174d32] focus:border-transparent"
                placeholder={`Enter ${label.toLowerCase()}`}
              />
            </div>
          </div>
        );
      }
      return (
        <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Icon className="size-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
            <p className="font-semibold text-gray-900">{value || "Not set"}</p>
          </div>
        </div>
      );
    };
  }, [isEditing, handleInputChange]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f7f4] p-6">
        <div className="rounded-2xl border border-emerald-100 bg-white px-10 py-8 text-center shadow-[0_18px_50px_rgba(20,83,45,0.08)]">
          <Loader2 className="mx-auto size-12 animate-spin text-[#174d32]" />
          <p className="mt-4 text-sm font-medium text-slate-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Notification Toast - Original Design with Fixed Positioning */}
      {showNotification && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-slide-up">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-2xl border max-w-md ${
            notificationMessage.includes("saved") || notificationMessage.includes("✅") || notificationMessage.includes("uploaded")
              ? "bg-green-800 border-green-400/30 text-white"
              : notificationMessage.includes("cancelled") || notificationMessage.includes("removed")
              ? "bg-gray-600 border-gray-400/30 text-white"
              : notificationMessage.includes("Error") || notificationMessage.includes("Please")
              ? "bg-red-600 border-red-400/30 text-white"
              : "bg-blue-600 border-blue-400/30 text-white"
          }`}>
            <Check className="size-5 flex-shrink-0" />
            <span className="font-medium">{notificationMessage}</span>
            <div className="ml-2 w-1 h-8 bg-white/20 rounded-full">
              <div className="w-1 bg-white rounded-full animate-shrink" style={{ height: '100%' }} />
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      {showLogoutDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start gap-4">
              <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="size-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Log Out?</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Are you sure you want to log out? You'll need to sign in again to access your account.
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutDialog(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-red-700 hover:shadow-lg"
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`
          user-profile-page min-h-screen space-y-6 bg-[#f3f7f4] px-4 py-5 sm:px-6 lg:px-8 lg:py-7
          transition-all duration-700 ease-out
          ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}
        `}
      >
        <style>{`
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          
          @keyframes shrink {
            from {
              height: 100%;
            }
            to {
              height: 0%;
            }
          }
          
          .animate-slide-up {
            animation: slideUp 0.3s ease-out forwards;
          }
          
          .animate-shrink {
            animation: shrink 3s linear forwards;
          }

          .user-profile-page [data-slot="card"] {
            border-radius: 1rem;
          }

          .user-profile-page select {
            border-color: rgb(167 243 208);
            background: rgb(255 255 255);
            color: rgb(20 83 45);
            outline: none;
          }

          .user-profile-page select:focus {
            box-shadow: 0 0 0 3px rgb(209 250 229);
            border-color: rgb(5 150 105);
          }

          .user-profile-page [data-slot="table-head"] {
            color: rgb(22 101 52);
            font-weight: 700;
          }

          .user-profile-page [data-slot="table-row"]:hover {
            background: rgb(240 253 244 / 0.7);
          }
        `}</style>

        {/* Header */}
        <header className="overflow-hidden rounded-2xl bg-[#174d32] px-5 py-5 text-white shadow-[0_18px_45px_rgba(23,77,50,0.18)] sm:px-7 sm:py-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/15">
                <User className="size-5 text-emerald-100" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">User Profile</h1>
                <p className="mt-1 text-sm text-emerald-100">
                  {isNewUser 
                    ? "Complete your profile to get started" 
                    : "Manage your account settings and view system information"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleEditToggle}
                className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
                  isEditing 
                    ? "bg-red-50 text-red-600 hover:bg-red-100" 
                    : "bg-[#174d32] text-white shadow-lg shadow-[#174d32]/20 hover:-translate-y-0.5 hover:shadow-xl"
                }`}
              >
                {isEditing ? (
                  <>
                    <X className="size-4" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Pencil className="size-4" />
                    Edit Profile
                  </>
                )}
              </button>
              
              {isEditing && (
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-xl"
                >
                  <Save className="size-4" />
                  Save Changes
                </button>
              )}
              
              <button
                onClick={handleLogoutWithConfirmation}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="size-4" />
                Log Out
              </button>
            </div>
          </div>
        </header>

        {/* New User Banner */}
        {isNewUser && (
          <div className="flex items-start gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-sm">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500">
              <UserPlus className="size-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-emerald-800">Welcome to Paintelligent!</h3>
              <p className="text-sm text-emerald-700">
                This is your profile page. Fill in your details to personalize your experience.
              </p>
            </div>
          </div>
        )}

        {/* Profile Overview Card - MERGED with System Permissions */}
        <Card className={`overflow-hidden rounded-2xl border ${isNewUser ? 'border-emerald-200' : 'border-emerald-100'} bg-white shadow-[0_12px_32px_rgba(20,83,45,0.06)]`}>
          <CardHeader className="border-b border-emerald-100 bg-gradient-to-r from-white to-emerald-50/70 px-6 py-5">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="flex items-start gap-6">
                {/* Profile Picture Section */}
                <div className="relative group">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div
                    className={`w-28 h-28 rounded-2xl overflow-hidden shadow-lg ring-2 ring-offset-2 ring-offset-white ring-emerald-200/50 
                      cursor-pointer transition-all duration-300 hover:scale-105 hover:rotate-3 
                      bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center
                      ${isEditing ? 'hover:ring-[#174d32] hover:ring-4' : ''}
                      group-hover:shadow-2xl`}
                    onClick={handleProfilePictureClick}
                  >
                    {displayPicture ? (
                      <img
                        src={displayPicture}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserCircle className="w-20 h-20 text-gray-400 group-hover:text-[#174d32] transition-colors" />
                    )}
                  </div>
                  
                  {isEditing && (
                    <div className="absolute -bottom-2 -right-2 flex gap-1.5">
                      {displayPicture && (
                        <button
                          onClick={handleRemovePicture}
                          className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-xl shadow-lg 
                            transition-all duration-200 hover:scale-110"
                          title="Remove profile picture"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                      <button
                        onClick={handleProfilePictureClick}
                        className="bg-[#174d32] hover:bg-[#123e28] text-white p-1.5 rounded-xl shadow-lg 
                          transition-all duration-200 hover:scale-110"
                        title="Change profile picture"
                      >
                        <Camera className="size-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* User Info Section - Email removed from header */}
                <div className="flex-1 min-w-0 pt-1">
                  {isEditing ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={displayData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="text-2xl font-bold text-gray-900 bg-transparent border-b-2 
                          border-[#174d32] focus:border-emerald-500 focus:outline-none 
                          w-full max-w-md pb-1 transition-colors duration-200
                          placeholder:text-gray-400"
                        placeholder="Enter your name"
                      />
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#174d32] scale-x-0 
                        focus-within:scale-x-100 transition-transform duration-300 origin-left" />
                    </div>
                  ) : (
                    <CardTitle className="text-2xl font-bold text-gray-900 truncate">
                      {displayData.name}
                    </CardTitle>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {isEditing ? (
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg 
                        border border-gray-200 hover:border-[#174d32] transition-colors duration-200">
                        <Shield className="size-4 text-[#174d32]" />
                        <select
                          value={displayData.role}
                          onChange={(e) => handleInputChange('role', e.target.value)}
                          className="bg-transparent border-none focus:outline-none text-sm font-medium 
                            text-gray-700 cursor-pointer py-0.5"
                        >
                          <option value="User">User</option>
                          <option value="System Administrator">System Administrator</option>
                          <option value="Manager">Manager</option>
                          <option value="Owner">Owner</option>
                        </select>
                      </div>
                    ) : (
                      <Badge className="bg-gradient-to-r from-[#174d32] to-[#123e28] px-4 py-1.5 rounded-lg text-sm font-medium shadow-lg shadow-[#174d32]/20">
                        <Shield className="size-3 mr-1.5 inline-block" />
                        {displayData.role}
                      </Badge>
                    )}

                    
                  </div>
                   <div className="mt-2">
                    <div className="flex items-center gap-2 text-gray-600 
                      bg-gray-50/50 px-3 py-1.5 rounded-lg border border-gray-100/50
                      hover:bg-gray-50 transition-colors duration-200">
                      <Mail className="size-4 text-[#174d32]/70" />
                      <span className="text-sm font-medium truncate">
                        {displayData.email || userEmail}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metadata Section */}
              <div className="flex flex-col items-start lg:items-end gap-3 flex-shrink-0">
                {isNewUser && (
                  <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl 
                    border border-emerald-200 shadow-sm">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                      <div className="absolute inset-0 w-2.5 h-2.5 bg-emerald-500 rounded-full 
                        animate-ping opacity-75" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-700">New User</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-gray-500 text-sm 
                  bg-white/50 backdrop-blur-sm px-4 py-2 rounded-xl border border-gray-200/50
                  shadow-sm hover:shadow-md transition-all duration-200">
                  <Clock className="size-4 text-[#174d32]/60" />
                  <span className="font-medium">
                    Last login: <span className="text-gray-700">{lastLoginDate}</span>
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          
          {/* System Permissions - MERGED INSIDE PROFILE CARD */}
          <CardContent >
            <div className="flex items-center gap-2 mb-3">
              <Shield className="size-4 text-[#174d32]" />
              <h3 className="text-sm font-semibold text-gray-700">System Permissions & Access</h3>
             
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {displayData.permissions && displayData.permissions.length > 0 ? (
                displayData.permissions.map((permission: string, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-2 border border-green-100 bg-green-50 rounded-lg hover:border-green-200 transition-colors"
                  >
                    <CheckCircle className="size-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-700">{permission}</span>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center text-gray-400 text-sm py-2">
                  No permissions assigned yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contact Information - Email field removed */}
          <Card className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_12px_32px_rgba(20,83,45,0.06)]">
            <CardHeader className="border-b border-emerald-100 bg-gradient-to-r from-white to-emerald-50/70 py-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[#174d32]">
                  <Phone className="size-4 text-white" />
                </div>
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EditableField
                label="Phone Number"
                value={displayData.phone}
                field="phone"
                icon={Phone}
              />
              <EditableField
                label="Office Location"
                value={displayData.location}
                field="location"
                icon={MapPin}
              />
              {isEditing ? (
                <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <MapPin className="size-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500 mb-1">Address</p>
                    <textarea
                      value={localAddress}
                      onChange={(e) => {
                        setLocalAddress(e.target.value);
                        handleInputChange('address', e.target.value);
                      }}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#174d32] focus:border-transparent min-h-[60px] text-sm"
                      placeholder="Enter your address"
                    />
                  </div>
                </div>
              ) : (
                displayData.address && (
                  <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <MapPin className="size-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-500 mb-1">Address</p>
                      <p className="text-sm font-semibold text-gray-900">{displayData.address}</p>
                    </div>
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* Contacts */}
          <Card className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_12px_32px_rgba(20,83,45,0.06)]">
            <CardHeader className="border-b border-emerald-100 bg-gradient-to-r from-white to-emerald-50/70  py-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[#174d32]">
                  <Users className="size-4 text-white" />
                </div>
                Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#174d32] focus:border-transparent text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              {isEditing && (
                <div className="flex justify-end mb-3">
                  <button
                    onClick={handleAddContact}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#174d32] hover:bg-[#123e28] text-white text-sm rounded-lg transition-all"
                  >
                    <Plus className="size-3.5" />
                    Add Contact
                  </button>
                </div>
              )}
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {filteredContacts.length > 0 ? (
                  filteredContacts.map((contact: any) => (
                    <div key={contact.id} className="p-2.5 border border-gray-200 rounded-lg hover:border-[#174d32] transition-colors">
                      {isEditing ? (
                        <div className="space-y-1.5">
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={contact.name}
                              onChange={(e) => handleContactChange(contact.id, 'name', e.target.value)}
                              placeholder="Name"
                              className="flex-1 p-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#174d32]"
                            />
                            <input
                              type="email"
                              value={contact.email}
                              onChange={(e) => handleContactChange(contact.id, 'email', e.target.value)}
                              placeholder="Email"
                              className="flex-1 p-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#174d32]"
                            />
                          </div>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={contact.phone}
                              onChange={(e) => handleContactChange(contact.id, 'phone', e.target.value)}
                              placeholder="Phone"
                              className="flex-1 p-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#174d32]"
                            />
                            <input
                              type="text"
                              value={contact.role}
                              onChange={(e) => handleContactChange(contact.id, 'role', e.target.value)}
                              placeholder="Role"
                              className="flex-1 p-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#174d32]"
                            />
                            <button
                              onClick={() => handleRemoveContact(contact.id)}
                              className="p-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm">{contact.name}</p>
                            <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-gray-600">
                              <span className="flex items-center gap-0.5">
                                <Mail className="size-3" />
                                {contact.email}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Phone className="size-3" />
                                {contact.phone}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Shield className="size-3" />
                                {contact.role}
                              </span>
                            </div>
                          </div>
                          <Badge className="bg-[#174d32] text-xs ml-2 flex-shrink-0">
                            Contact
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm text-center py-4">
                    {searchTerm ? "No contacts match your search" : "No contacts added yet"}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between text-xs text-gray-500">
                <span>{filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}</span>
                {searchTerm && filteredContacts.length !== (displayData.contacts || []).length && (
                  <span>Showing {filteredContacts.length} of {(displayData.contacts || []).length}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}