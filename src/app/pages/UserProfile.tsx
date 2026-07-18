import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { 
  LogOut, User, Mail, Phone, MapPin, Calendar, Shield, Activity, Building2, Clock, Camera, 
  Edit2, Save, X, UserPlus, Award, CheckCircle, Pencil, UserCircle, Check, Plus, Trash2, Building, Users, Search
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useRef } from "react";

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
  const [lastLoginDate, setLastLoginDate] = useState("");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [tempProfilePicture, setTempProfilePicture] = useState<string | null>(null);
  const [userData, setUserData] = useState(DEFAULT_USER_DATA);
  const [tempUserData, setTempUserData] = useState(DEFAULT_USER_DATA);
  const [isNewUser, setIsNewUser] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load user data from localStorage on mount
  useEffect(() => {
    const savedUserData = localStorage.getItem("userProfileData");
    const savedPicture = localStorage.getItem("userProfilePicture");
    const isNew = !savedUserData;
    
    setIsNewUser(isNew);
    
    if (savedPicture) {
      setProfilePicture(savedPicture);
      setTempProfilePicture(savedPicture);
    }

    if (savedUserData) {
      const parsedData = JSON.parse(savedUserData);
      
      // Ensure email is set from auth context if not in saved data
      if (!parsedData.email && userEmail) {
        parsedData.email = userEmail;
      }
      
      // Remove department if it exists (cleanup old data)
      delete parsedData.department;
      
      // FORCE both permissions to always exist
      const existingPermissions = parsedData.permissions || [];
      const combinedPermissions = [...new Set([...existingPermissions, ...ENSURE_PERMISSIONS])];
      parsedData.permissions = combinedPermissions;
      
      // Initialize contacts if they don't exist
      if (!parsedData.contacts) {
        parsedData.contacts = DEFAULT_USER_DATA.contacts;
      }
      
      setUserData(parsedData);
      setTempUserData(parsedData);
    } else {
      // New user - start with default data but set name from email
      const emailName = userEmail?.split('@')[0] || "New User";
      const formattedName = emailName
        .split(/[._-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      const defaultData = {
        ...DEFAULT_USER_DATA,
        name: formattedName || "New User",
        email: userEmail || "",
      };
      setUserData(defaultData);
      setTempUserData(defaultData);
    }
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
    
    // Clear any existing timeout
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    
    // Hide notification after 3 seconds
    notificationTimeoutRef.current = setTimeout(() => {
      setShowNotification(false);
      notificationTimeoutRef.current = null;
    }, 3000);
  };

  // Save user data to localStorage
  const saveUserData = (data: any) => {
    try {
      // Remove department if it exists (cleanup)
      delete data.department;
      
      // FORCE both permissions to always exist when saving
      const existingPermissions = data.permissions || [];
      const combinedPermissions = [...new Set([...existingPermissions, ...ENSURE_PERMISSIONS])];
      
      const dataToSave = {
        ...data,
        permissions: combinedPermissions
      };
      
      localStorage.setItem("userProfileData", JSON.stringify(dataToSave));
      setUserData(dataToSave);
      setIsNewUser(false);
      
      return true;
    } catch (error) {
      console.error("Error saving user data:", error);
      return false;
    }
  };

  // Handle edit toggle
  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel edit - revert changes
      setTempUserData(userData);
      setTempProfilePicture(profilePicture);
      showNotificationMessage("Changes cancelled");
    } else {
      // Start editing - copy current data to temp
      setTempUserData(userData);
      setTempProfilePicture(profilePicture);
    }
    setIsEditing(!isEditing);
  };

  // Handle save - ENHANCED with better error handling
  const handleSave = () => {
    try {
      // Save user data to localStorage
      const saveSuccess = saveUserData(tempUserData);
      
      if (!saveSuccess) {
        showNotificationMessage("Error saving profile data ❌");
        return;
      }
      
      // Save profile picture if changed
      if (tempProfilePicture !== profilePicture) {
        if (tempProfilePicture) {
          localStorage.setItem('userProfilePicture', tempProfilePicture);
          setProfilePicture(tempProfilePicture);
        } else {
          localStorage.removeItem('userProfilePicture');
          setProfilePicture(null);
        }
      }
      
      setIsEditing(false);
      showNotificationMessage("Profile saved successfully! ✅");
      
      // Dispatch custom event to notify Layout component about the update
      window.dispatchEvent(new Event('profileUpdated'));
    } catch (error) {
      console.error("Save error:", error);
      showNotificationMessage("Error saving profile ❌");
    }
  };

  // Handle input change
  const handleInputChange = (field: string, value: string) => {
    setTempUserData(prev => ({
      ...prev,
      [field]: value
    }));
  };

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

  // UPDATED: Handle logout WITHOUT clearing user profile data
  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (confirmLogout) {
      try {
        // Clear authentication data
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('userToken');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userId');
        
        // Call the logout function from context
        logout();
        
        // Navigate to login with replace to prevent going back
        navigate("/login", { replace: true });
      } catch (error) {
        console.error("Logout error:", error);
        // Force navigation even if there's an error
        navigate("/login", { replace: true });
      }
    }
  };

  // Handle profile picture change
  const handleProfilePictureClick = () => {
    if (isEditing) {
      // Reset the file input value so onChange fires even for the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && isEditing) {
      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        showNotificationMessage("Please select an image file");
        return;
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showNotificationMessage("Image size should be less than 5MB");
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        setTempProfilePicture(imageData);
        showNotificationMessage("Picture uploaded successfully! 📸");
      };
      reader.onerror = () => {
        showNotificationMessage("Error uploading picture");
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle remove profile picture (only in edit mode)
  const handleRemovePicture = () => {
    if (isEditing) {
      setTempProfilePicture(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      showNotificationMessage("Picture removed");
    }
  };

  // Editable field component
  const EditableField = ({ label, value, field, type = "text", icon: Icon }: any) => {
    if (isEditing) {
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
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a4d2e] focus:border-transparent"
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

  const displayData = isEditing ? tempUserData : userData;
  const displayPicture = isEditing ? tempProfilePicture : profilePicture;

  // Filter contacts based on search term
  const filteredContacts = (displayData.contacts || []).filter((contact: any) =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm) ||
    contact.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6 bg-gray-50 min-h-screen relative">
      {/* Notification Toast */}
      {showNotification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg ${
            notificationMessage.includes("saved") || notificationMessage.includes("✅") || notificationMessage.includes("uploaded")
              ? "bg-green-600 text-white"
              : notificationMessage.includes("cancelled") || notificationMessage.includes("removed")
              ? "bg-gray-600 text-white"
              : notificationMessage.includes("Error") || notificationMessage.includes("Please")
              ? "bg-red-600 text-white"
              : "bg-blue-600 text-white"
          }`}>
            <Check className="size-5" />
            <span className="font-medium">{notificationMessage}</span>
            <div className="ml-2 w-1 h-8 bg-white/20 rounded-full">
              <div className="w-1 bg-white rounded-full animate-shrink" style={{ height: '100%' }} />
            </div>
          </div>
        </div>
      )}

      {/* New User Banner */}
      {isNewUser && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 flex items-start gap-4 shadow-sm">
          <div className="p-2 bg-green-500 rounded-full">
            <UserPlus className="size-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-green-800 text-lg">Welcome to Paintelligent!</h3>
            <p className="text-green-700 text-sm">
              This is your profile page. Fill in your details to personalize your experience.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Profile</h1>
          <p className="text-gray-600 mt-2">
            {isNewUser 
              ? "Complete your profile to get started" 
              : "Manage your account settings and view system information"}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleEditToggle}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all shadow-md hover:shadow-lg transform hover:scale-105 ${
              isEditing 
                ? "bg-gray-600 hover:bg-gray-700 text-white" 
                : "bg-[#1a4d2e] hover:bg-[#2d6b45] text-white"
            }`}
          >
            {isEditing ? (
              <>
                <X className="size-5" />
                Cancel
              </>
            ) : (
              <>
                <Pencil className="size-5" />
                Edit Profile
              </>
            )}
          </button>
          {isEditing && (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <Save className="size-5" />
              Save Changes
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-md hover:shadow-lg transform hover:scale-105"
          >
            <LogOut className="size-5" />
            Log Out
          </button>
        </div>
      </div>

      {/* Profile Overview Card */}
      <Card className={`border-l-4 ${isNewUser ? 'border-green-500' : 'border-[#1a4d2e]'} shadow-lg`}>
        <CardHeader className="pb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex items-start gap-6">
              <div className="relative group">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <div
                  className={`w-28 h-28 rounded-full overflow-hidden shadow-lg ring-4 ring-green-100 cursor-pointer transition hover:scale-105 bg-gray-100 flex items-center justify-center ${
                    isEditing ? 'hover:ring-2 hover:ring-[#1a4d2e]' : ''
                  }`}
                  onClick={handleProfilePictureClick}
                >
                  {displayPicture ? (
                    <img
                      src={displayPicture}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserCircle className="w-20 h-20 text-gray-400" />
                  )}
                </div>
                
                {/* Remove button (X) - bottom left, only in edit mode and when picture exists */}
                {isEditing && displayPicture && (
                  <button
                    onClick={handleRemovePicture}
                    className="absolute bottom-0 left-0 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-all transform hover:scale-110"
                    title="Remove profile picture"
                  >
                    <X className="size-4" />
                  </button>
                )}
                
                {/* Camera button - bottom right, only in edit mode */}
                {isEditing && (
                  <button
                    onClick={handleProfilePictureClick}
                    className="absolute bottom-0 right-0 bg-[#1a4d2e] hover:bg-[#2d6b45] text-white p-2 rounded-full shadow-lg transition-all transform group-hover:scale-110"
                    title="Change profile picture"
                  >
                    <Camera className="size-4" />
                  </button>
                )}
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <input
                    type="text"
                    value={displayData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="text-3xl font-bold text-gray-900 bg-transparent border-b-2 border-[#1a4d2e] focus:outline-none w-full max-w-md"
                    placeholder="Enter your name"
                  />
                ) : (
                  <CardTitle className="text-3xl text-gray-900">{displayData.name}</CardTitle>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Shield className="size-4 text-gray-500" />
                      <select
                        value={displayData.role}
                        onChange={(e) => handleInputChange('role', e.target.value)}
                        className="p-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a4d2e]"
                      >
                        <option value="User">User</option>
                        <option value="System Administrator">System Administrator</option>
                        <option value="Manager">Manager</option>
                        <option value="Owner">Owner</option>
                      </select>
                    </div>
                  ) : (
                    <Badge className="bg-[#1a4d2e] hover:bg-[#2d6b45] px-3 py-1">
                      <Shield className="size-3 mr-1.5" />
                      {displayData.role}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="size-4" />
                    <span className="text-sm">{displayData.email || userEmail}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-full border border-green-200">
                <div className="size-2.5 bg-green-500 rounded-full animate-pulse shadow-sm"></div>
                <span className="text-sm font-semibold">Active Now</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Clock className="size-4" />
                <span>Last login: {lastLoginDate}</span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Information */}
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-[#1a4d2e] rounded-lg">
                <Mail className="size-5 text-white" />
              </div>
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <EditableField
              label="Email Address"
              value={displayData.email || userEmail}
              field="email"
              icon={Mail}
            />
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
                <div className="p-2 bg-purple-50 rounded-lg">
                  <MapPin className="size-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 mb-1">Address</p>
                  <textarea
                    value={displayData.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a4d2e] focus:border-transparent min-h-[60px]"
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
                    <p className="font-semibold text-gray-900">{displayData.address}</p>
                  </div>
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Contacts - Compact Version with Search */}
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b py-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 bg-[#1a4d2e] rounded-lg">
                <Users className="size-4 text-white" />
              </div>
              Contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search contacts by name, email, phone, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a4d2e] focus:border-transparent text-sm"
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

            {/* Add Contact Button */}
            {isEditing && (
              <div className="flex justify-end mb-3">
                <button
                  onClick={handleAddContact}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#1a4d2e] hover:bg-[#2d6b45] text-white text-sm rounded-lg transition-all"
                >
                  <Plus className="size-3.5" />
                  Add Contact
                </button>
              </div>
            )}
            
            {/* Contacts List - Compact */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact: any) => (
                  <div key={contact.id} className="p-2.5 border border-gray-200 rounded-lg hover:border-[#1a4d2e] transition-colors">
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={contact.name}
                            onChange={(e) => handleContactChange(contact.id, 'name', e.target.value)}
                            placeholder="Name"
                            className="flex-1 p-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#1a4d2e]"
                          />
                          <input
                            type="email"
                            value={contact.email}
                            onChange={(e) => handleContactChange(contact.id, 'email', e.target.value)}
                            placeholder="Email"
                            className="flex-1 p-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#1a4d2e]"
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={contact.phone}
                            onChange={(e) => handleContactChange(contact.id, 'phone', e.target.value)}
                            placeholder="Phone"
                            className="flex-1 p-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#1a4d2e]"
                          />
                          <input
                            type="text"
                            value={contact.role}
                            onChange={(e) => handleContactChange(contact.id, 'role', e.target.value)}
                            placeholder="Role"
                            className="flex-1 p-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#1a4d2e]"
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
                        <Badge className="bg-[#1a4d2e] text-xs ml-2 flex-shrink-0">
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

            {/* Contact Count */}
            <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between text-xs text-gray-500">
              <span>{filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}</span>
              {searchTerm && filteredContacts.length !== (displayData.contacts || []).length && (
                <span>Showing {filteredContacts.length} of {(displayData.contacts || []).length}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Permissions */}
      <Card className="shadow-md">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Shield className="size-5 text-white" />
            </div>
            System Permissions & Access
          </CardTitle>
          <CardDescription className="mt-2">
            {isNewUser 
              ? "You'll get more permissions as you use the system" 
              : "Your current access levels and permissions within the Paintelligent system"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayData.permissions && displayData.permissions.length > 0 ? (
              displayData.permissions.map((permission: string, index: number) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-4 border-2 border-green-100 bg-green-50 rounded-lg hover:border-green-200 transition-colors"
                >
                  <div className="p-2 bg-green-600 rounded-lg">
                    <CheckCircle className="size-4 text-white" />
                  </div>
                  <span className="font-semibold text-gray-800">{permission}</span>
                </div>
              ))
            ) : (
              <div className="col-span-2 text-center text-gray-500 py-4">
                No permissions assigned yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add animation styles */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
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
        
        .animate-slide-in {
          animation: slideIn 0.3s ease-out forwards;
        }
        
        .animate-shrink {
          animation: shrink 3s linear forwards;
        }
      `}</style>
    </div>
  );
}