import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "./ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  User,
  Mail,
  Building2,
  Phone,
  Calendar,
  Clock,
  Edit,
  Lock,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  Activity,
} from "lucide-react";
import { Badge } from "./ui/badge";
import axios from "axios";
import { toast } from "sonner";

interface AdminProfileProps {
  onBack?: () => void;
}

interface AdminData {
  _id: string;
  name: string;
  email: string;
  department?: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
  lastLogin?: string;
}

interface AdminStats {
  totalExams: number;
  activeExams: number;
  totalSubmissions: number;
  totalSuspiciousFlags: number;
}

export function AdminProfile({ onBack }: AdminProfileProps) {
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalExams: 0,
    activeExams: 0,
    totalSubmissions: 0,
    totalSuspiciousFlags: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    department: "",
    phone: "",
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Fetch admin profile and stats
  useEffect(() => {
    fetchAdminProfile();
    fetchAdminStats();
  }, []);

  const fetchAdminProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required");
        setLoading(false);
        return;
      }

      const response = await axios.get("https://smart-ai-proctoring.onrender.com/api/v1/admin/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Fetched admin profile:", response.data);
      console.log("Avatar URL:", response.data.avatar);
      
      setAdminData(response.data);
      setEditForm({
        name: response.data.name || "",
        email: response.data.email || "",
        department: response.data.department || "",
        phone: response.data.phone || "",
      });
      setError(null);
    } catch (err: any) {
      console.error("Error fetching admin profile:", err);
      setError(err.response?.data?.message || "Failed to load admin profile");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminStats = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get("https://smart-ai-proctoring.onrender.com/api/v1/admin/stats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setAdminStats(response.data);
    } catch (err: any) {
      console.error("Error fetching admin stats:", err);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await axios.put(
        "https://smart-ai-proctoring.onrender.com/api/v1/admin/profile",
        editForm,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setAdminData(response.data);
      setShowEditModal(false);
      toast.success("Profile updated successfully");
    } catch (err: any) {
      console.error("Error updating profile:", err);
      toast.error(err.response?.data?.message || "Failed to update profile");
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      await axios.put(
        "https://smart-ai-proctoring.onrender.com/api/v1/admin/update-password",
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setShowPasswordModal(false);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success("Password changed successfully");
    } catch (err: any) {
      console.error("Error changing password:", err);
      toast.error(err.response?.data?.message || "Failed to change password");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }

    console.log("File selected:", file.name, file.type, file.size);

    // Base64 encoding increases file size by ~33%, so limit original file to 3MB
    // This ensures base64 won't exceed ~4MB, well within server limits
    if (file.size > 3 * 1024 * 1024) {
      toast.error("File size must be less than 3MB. Please compress or resize your image.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    try {
      setUploadingAvatar(true);
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required");
        setUploadingAvatar(false);
        return;
      }

      // Convert file to base64
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          
          if (!base64String) {
            console.error("FileReader result is null or undefined");
            toast.error("Failed to read file. Please try again.");
            setUploadingAvatar(false);
            return;
          }

          if (!base64String.startsWith('data:image/')) {
            console.error("Invalid base64 format:", base64String.substring(0, 50));
            toast.error("Invalid image format. Please select a valid image file.");
            setUploadingAvatar(false);
            return;
          }

          console.log("Uploading avatar, base64 length:", base64String.length);
          console.log("Base64 preview:", base64String.substring(0, 50) + "...");

          const response = await axios.post(
            "https://smart-ai-proctoring.onrender.com/api/v1/admin/upload-avatar",
            { avatar: base64String },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          console.log("Avatar upload response:", response.data);
          // Force state update with the new avatar
          if (response.data.avatar) {
            setAdminData((prev) => {
              const updated = prev ? { ...prev, avatar: response.data.avatar } : { ...prev, avatar: response.data.avatar } as AdminData;
              console.log("Updated adminData with avatar:", updated);
              return updated;
            });
            toast.success("Avatar uploaded successfully");
          } else {
            toast.error("Avatar upload failed: No avatar data received");
          }
          
          // Reset file input to allow re-uploading the same file
          const fileInput = document.getElementById('avatar-upload') as HTMLInputElement;
          if (fileInput) {
            fileInput.value = '';
          }
        } catch (err: any) {
          console.error("Error uploading avatar:", err);
          console.error("Error response:", err.response?.data);
          const errorMessage = err.response?.data?.message || err.message || "Failed to upload avatar";
          toast.error(errorMessage);
          
          // Reset file input on error
          const fileInput = document.getElementById('avatar-upload') as HTMLInputElement;
          if (fileInput) {
            fileInput.value = '';
          }
        } finally {
          setUploadingAvatar(false);
        }
      };
      
      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        toast.error("Error reading file. Please try again.");
        setUploadingAvatar(false);
        
        // Reset file input on error
        const fileInput = document.getElementById('avatar-upload') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      };
      
      reader.onabort = () => {
        console.error("FileReader aborted");
        toast.error("File reading was cancelled.");
        setUploadingAvatar(false);
        
        // Reset file input on abort
        const fileInput = document.getElementById('avatar-upload') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      };
      
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("Error in handleAvatarUpload:", err);
      toast.error(err.message || "Failed to upload avatar");
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-gray-600">Loading profile...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !adminData) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="w-48 h-48 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                  {adminData?.avatar ? (
                    <img 
                      key={adminData.avatar} 
                      src={adminData.avatar} 
                      alt={adminData.name || "Admin"} 
                      className="w-full h-full"
                      style={{ objectFit: 'contain' }}
                      onError={(e) => {
                        console.error("Image failed to load:", adminData.avatar);
                        // If image fails to load, show fallback
                        e.currentTarget.style.display = 'none';
                      }}
                      onLoad={() => {
                        console.log("Image loaded successfully:", adminData.avatar);
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-5xl font-semibold" style={{ backgroundColor: '#4444FF' }}>
                      {adminData?.name ? getInitials(adminData.name) : 'AD'}
                    </div>
                  )}
                </div>
                <label
                  htmlFor="avatar-upload"
                  className={`absolute bottom-0 right-0 rounded-full p-2 cursor-pointer transition-colors shadow-lg ${
                    uploadingAvatar 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  title={uploadingAvatar ? "Uploading..." : "Upload avatar"}
                >
                  {uploadingAvatar ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl text-gray-900 mb-2">
                  {adminData?.name || "Admin"}
                </CardTitle>
                <CardDescription className="text-base mb-4">
                  {adminData?.email || "No email provided"}
                </CardDescription>
                <div className="flex items-center space-x-4">
                  <Badge className="bg-green-50 text-green-700 border-green-200 text-sm px-3 py-1">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active Admin
                  </Badge>
                  {adminData?.department && (
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      <Building2 className="w-3 h-3 mr-1" />
                      {adminData.department}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setShowEditModal(true)}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>Edit Profile</span>
              </Button>
              <Button
                onClick={() => setShowPasswordModal(true)}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Lock className="w-4 h-4" />
                <span>Change Password</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Exams Created</CardDescription>
            <CardTitle className="text-3xl" style={{ color: '#4444FF' }}>
              {adminStats.totalExams}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <FileText className="w-4 h-4" />
              <span>All Time</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Exams</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {adminStats.activeExams}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Activity className="w-4 h-4" />
              <span>Currently Active</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Submissions</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {adminStats.totalSubmissions}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4" />
              <span>All Submissions</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Suspicious Flags</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {adminStats.totalSuspiciousFlags}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <AlertTriangle className="w-4 h-4" />
              <span>Total Flags</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profile Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>Personal Information</span>
            </CardTitle>
            <CardDescription>
              Your account details and information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Full Name</p>
                <p className="text-gray-900 text-lg">{adminData?.name || "Not provided"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Email Address</p>
                <p className="text-gray-900 text-lg">{adminData?.email || "Not provided"}</p>
              </div>
              {adminData?.department && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">Department</p>
                  <p className="text-gray-900 text-lg">{adminData.department}</p>
                </div>
              )}
              {adminData?.phone && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">Phone Number</p>
                  <p className="text-gray-900 text-lg">{adminData.phone}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>Account Information</span>
            </CardTitle>
            <CardDescription>
              Account activity and metadata
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Date Joined</p>
                <p className="text-gray-900 text-lg">
                  {adminData?.createdAt
                    ? new Date(adminData.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Not available"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Last Login</p>
                <p className="text-gray-900 text-lg">
                  {adminData?.lastLogin
                    ? new Date(adminData.lastLogin).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "Not available"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Account Status</p>
                <Badge className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your profile information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder="Enter your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
                placeholder="Enter your email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={editForm.department}
                onChange={(e) =>
                  setEditForm({ ...editForm, department: e.target.value })
                }
                placeholder="Enter your department"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm({ ...editForm, phone: e.target.value })
                }
                placeholder="Enter your phone number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateProfile} style={{ backgroundColor: '#4444FF' }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and new password
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    currentPassword: e.target.value,
                  })
                }
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    newPassword: e.target.value,
                  })
                }
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordModal(false);
                setPasswordForm({
                  currentPassword: "",
                  newPassword: "",
                  confirmPassword: "",
                });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleChangePassword} style={{ backgroundColor: '#4444FF' }}>
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

