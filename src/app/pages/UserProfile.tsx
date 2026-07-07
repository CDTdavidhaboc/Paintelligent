import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { LogOut, User, Mail, Phone, MapPin, Calendar, Shield, Activity, Building2, Clock, Camera } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useRef } from "react";
import profileImage from "@/assets/Userprofile.jpg";

export default function UserProfile() {
  const navigate = useNavigate();
  const { logout, userEmail } = useAuth();

  // Dynamic last login date
  const [lastLoginDate, setLastLoginDate] = useState("");
  
  // Profile picture state
  const [profilePicture, setProfilePicture] = useState(profileImage);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'long' });
    const day = now.getDate();
    const year = now.getFullYear();
    const time = now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    setLastLoginDate(`${month} ${day}, ${year} at ${time}`);
    
    // Load saved profile picture from localStorage
    // Keep the uploaded image if the user changed it
const savedPicture = localStorage.getItem("userProfilePicture");

if (savedPicture) {
  setProfilePicture(savedPicture);
} else {
  setProfilePicture(profileImage);
}
  }, []);

  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (confirmLogout) {
      logout();
      navigate("/login");
    }
  };

  const handleProfilePictureClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result);
        // Save the profile picture to localStorage
        localStorage.setItem('userProfilePicture', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Mock user data
  const userData = {
    name: "Clyde Garcia",
    email: userEmail || "admin@garciapaint.com",
    phone: "+63 917 234 5678",
    role: "System Administrator",
    department: "Owner",
    location: "Garcia Paint Center - Balayan Branch",
    address: "Barangay 6, Antorcha Street, Balayan, Philippines, 4213",
    joinDate: "January 15, 2023",
    lastLogin: lastLoginDate,
    employeeId: "GPC-2023-001",
    permissions: ["Seasonal Forecast", "Paint Analyzer"],
    activityStats: [
      { label: "Total Sessions", value: "247" },
      { label: "Reports Generated", value: "89" },
      { label: "Analyses Completed", value: "156" },
      { label: "Average Session Time", value: "2.5 hrs" },
    ],
  };

  return (
    <div className="p-8 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Profile</h1>
          <p className="text-gray-600 mt-2">Manage your account settings and view system information</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-md hover:shadow-lg transform hover:scale-105"
        >
          <LogOut className="size-5" />
          Log Out
        </button>
      </div>

      {/* Profile Overview Card */}
      <Card className="border-l-4 border-[#1a4d2e] shadow-lg">
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
  className="w-28 h-28 rounded-full overflow-hidden shadow-lg ring-4 ring-green-100 cursor-pointer transition hover:scale-105"
  onClick={handleProfilePictureClick}
>
  <img
    src={profilePicture}
    alt="Profile"
    className="w-full h-full object-cover"
  />
</div>
                <button
                  onClick={handleProfilePictureClick}
                  className="absolute bottom-0 right-0 bg-[#1a4d2e] hover:bg-[#2d6b45] text-white p-2 rounded-full shadow-lg transition-all transform group-hover:scale-110"
                  title="Change profile picture"
                >
                  <Camera className="size-4" />
                </button>
              </div>
              <div className="flex-1">
                <CardTitle className="text-3xl text-gray-900">{userData.name}</CardTitle>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <Badge className="bg-[#1a4d2e] hover:bg-[#2d6b45] px-3 py-1">
                    <Shield className="size-3 mr-1.5" />
                    {userData.role}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="size-4" />
                    <span className="text-sm">{userData.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Building2 className="size-4" />
                    <span className="text-sm">{userData.department}</span>
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
                <span>Last login: {userData.lastLogin}</span>
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
            <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Mail className="size-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">Email Address</p>
                <p className="font-semibold text-gray-900">{userData.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-green-50 rounded-lg">
                <Phone className="size-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">Phone Number</p>
                <p className="font-semibold text-gray-900">{userData.phone}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-purple-50 rounded-lg">
                <MapPin className="size-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">Office Location</p>
                <p className="font-semibold text-gray-900">{userData.location}</p>
                <p className="text-sm text-gray-600 mt-1">{userData.address}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Details */}
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-[#1a4d2e] rounded-lg">
                <Calendar className="size-5 text-white" />
              </div>
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Calendar className="size-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">Member Since</p>
                <p className="font-semibold text-gray-900">{userData.joinDate}</p>
                <p className="text-xs text-gray-500 mt-1">2 years of service</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Activity className="size-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">Last Login</p>
                <p className="font-semibold text-gray-900">{userData.lastLogin}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-green-50 rounded-lg">
                <Shield className="size-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">Account Status</p>
                <Badge className="bg-green-600 hover:bg-green-700 mt-1 px-3 py-1">
                  <div className="size-2 bg-white rounded-full mr-2"></div>
                  Active & Verified
                </Badge>
              </div>
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
            Your current access levels and permissions within the Paintelligent system
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userData.permissions.map((permission, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-4 border-2 border-green-100 bg-green-50 rounded-lg hover:border-green-200 transition-colors"
              >
                <div className="p-2 bg-green-600 rounded-lg">
                  <Shield className="size-4 text-white" />
                </div>
                <span className="font-semibold text-gray-800">{permission}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card className="border-t-4 border-[#1a4d2e] shadow-md">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-white">
          <CardTitle className="text-xl">System Information</CardTitle>
          <CardDescription>Paintelligent POS System Details for Garcia Paint Center</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-gray-600 mb-1">System Version</p>
              <p className="text-lg font-bold text-gray-900">Prototype</p>
              <p className="text-xs text-gray-500 mt-1">Latest Release</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-sm text-gray-600 mb-1">Organization</p>
              <p className="text-lg font-bold text-gray-900">Garcia Paint Center</p>
              <p className="text-xs text-gray-500 mt-1">Main Branch</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border  border-green-100 ">
              <p className="text-sm text-gray-600 mb-1">Current Season</p>
              <p className="text-lg font-bold text-gray-900">Dry Season</p>
              <p className="text-xs text-gray-500 mt-1">Nov - May Period</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-sm text-gray-600 mb-1">System Uptime</p>
              <p className="text-lg font-bold text-gray-900">99.8%</p>
              <p className="text-xs text-gray-500 mt-1">Last 30 Days</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}