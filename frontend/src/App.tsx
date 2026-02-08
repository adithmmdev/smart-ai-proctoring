import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Brain, Shield, User, Lock, Mail } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { motion } from 'framer-motion';
import { AdminDashboard } from './components/AdminDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { Skeleton } from './components/ui/skeleton';
import { ProctoringStatusIndicator } from './components/ProctoringStatusIndicator';

const techLogos = [
  {
    alt: 'AI icon',
    src: 'https://img.icons8.com/?size=100&id=114433&format=png&color=000000',
  },
  {
    alt: 'Shield security icon',
    src: 'https://img.icons8.com/?size=100&id=8146&format=png&color=000000',
  },
  {
    alt: 'Cloud server icon',
    src: 'https://img.icons8.com/?size=100&id=41401&format=png&color=000000',
  },
];

export default function App() {

  const [activeTab, setActiveTab] = useState('student');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userType, setUserType] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [name, setName] = useState('');
  const [visitCount, setVisitCount] = useState<number | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [proctorStatus] = useState<'normal' | 'warning' | 'suspicious'>('normal');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem('landingVisitCount');
      const previous = raw ? parseInt(raw, 10) || 0 : 0;
      const next = previous + 1;
      localStorage.setItem('landingVisitCount', String(next));
      setVisitCount(next);
    } catch (err) {
      console.error('Error updating visit count:', err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const ThemeToggleButton = () => (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      className="fixed top-4 right-4 z-50 rounded-full border border-gray-200 bg-white/80 px-3 py-1 text-xs font-medium text-gray-700 shadow-sm backdrop-blur-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {theme === 'light' ? 'Dark mode' : 'Light mode'}
    </button>
  );

  const handleLogin = async (type: string) => {
    try {
      setLoading(true);
      setError('');

      // Validate inputs
      const loginEmail = type === 'admin' ? (username || email) : email;
      if (!loginEmail || !password) {
        setError('Please enter both email and password');
        setLoading(false);
        return;
      }

      let response;
      try {
        response = await fetch('https://smart-ai-proctoring.onrender.com/api/v1/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: loginEmail.toLowerCase().trim(),
            password: password,
          }),
        });
      } catch (fetchError: any) {
        // Network error
        throw new Error('Failed to connect to server. Please check if the backend is running.');
      }

      // Check if response is ok
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        throw new Error(errorData.message || `Login failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate response data
      if (!data.token || !data.role) {
        throw new Error('Invalid response from server');
      }

      // Verify role matches expected type
      if (type === 'admin' && data.role !== 'admin') {
        throw new Error('Access denied. Admin privileges required.');
      }
      if (type === 'student' && data.role !== 'student') {
        throw new Error('Access denied. Student account required.');
      }

      // Store token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify({
        _id: data._id,
        name: data.name,
        email: data.email,
        role: data.role,
      }));

      setUserType(data.role);
      setIsLoggedIn(true);
      setLoading(false);
      toast.success(`Logged in successfully as ${data.role === 'admin' ? 'Admin' : 'Student'}`);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please check your credentials and try again.');
      setLoading(false);
      toast.error(err.message || 'Login failed. Please check your credentials and try again.');
    }
  };

  const handleRegister = async (type: string) => {
    try {
      setLoading(true);
      setError('');

      const registerEmail = type === 'admin' ? (username || email) : email;
      if (!registerEmail || !password || !name) {
        setError('Please fill in all fields');
        setLoading(false);
        return;
      }

      let response;
      try {
        response = await fetch('https://smart-ai-proctoring.onrender.com/api/v1/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            email: registerEmail.toLowerCase().trim(),
            password: password,
            role: type,
          }),
        });
      } catch (fetchError: any) {
        throw new Error('Failed to connect to server. Please check if the backend is running.');
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        throw new Error(errorData.message || `Registration failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.token || !data.role) {
        throw new Error('Invalid response from server');
      }

      // Store token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify({
        _id: data._id,
        name: data.name,
        email: data.email,
        role: data.role,
      }));

      setUserType(data.role);
      setIsLoggedIn(true);
      setLoading(false);
      setShowRegister(false);
      toast.success(`Account created successfully as ${data.role === 'admin' ? 'Admin' : 'Student'}`);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
      setLoading(false);
      toast.error(err.message || 'Registration failed. Please try again.');
    }
  };

  if (isLoggedIn && userType === 'admin') {
    return (
      <>
        <ThemeToggleButton />
        <AdminDashboard />
        <Toaster position="top-right" richColors />
      </>
    );
  }

  if (isLoggedIn && userType === 'student') {
    return (
      <>
        <ThemeToggleButton />
        <StudentDashboard />
        <Toaster position="top-right" richColors />
      </>
    );
  }

  return (
    <div className="h-screen relative animated-bg">
      <ThemeToggleButton />
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-gradient-to-br from-blue-300/15 to-purple-300/15 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-gradient-to-tr from-indigo-300/15 to-cyan-300/15 blur-3xl"></div>
      </div>

      <div className="relative z-10 h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          aria-label="Login card"
        >
          <Card className="w-96 shadow-2xl bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4 pb-6 main-title-shadow-wrapper">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#4444FF' }}>
              <Brain className="w-8 h-8 text-white" />
            </div>
            <CardTitle style={{ color: '#4444FF' }}>
              Smart AI Proctoring System
            </CardTitle>
            <CardDescription className="text-gray-600">
              Secure, Smart, Reliable Exams
            </CardDescription>
            {visitCount !== null && (
              <p className="mt-2 inline-flex items-center justify-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-medium text-blue-700 shadow-xs">
                Welcome! You have visited this page {visitCount}{' '}
                {visitCount === 1 ? 'time' : 'times'}.
              </p>
            )}
            <div className="mt-2 flex justify-center gap-3">
              {techLogos.map((logo) => (
                <img
                  key={logo.alt}
                  src={logo.src}
                  alt={logo.alt}
                  loading="lazy"
                  className="h-6 w-6 rounded-full shadow-xs"
                />
              ))}
            </div>
            <div className="mt-3 flex justify-center">
              <ProctoringStatusIndicator status={proctorStatus} />
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {loading && (
              <div className="space-y-4" aria-hidden="true">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 mx-auto" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 mx-auto" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-4 w-28 ml-auto" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-40 mx-auto" />
              </div>
            )}
            {!loading && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="student">
                  <User className="w-4 h-4 mr-2" />
                  Student Login
                </TabsTrigger>
                <TabsTrigger value="admin">
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Login
                </TabsTrigger>
              </TabsList>

              <TabsContent value="student" className="space-y-4">
                {error && activeTab === 'student' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="student-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                    <Input 
                      id="student-email" 
                      type="email" 
                      placeholder="Enter your email" 
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="student-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                    <Input 
                      id="student-password" 
                      type="password" 
                      placeholder="Enter your password" 
                      className="pl-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !loading) {
                          handleLogin('student');
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button className="text-blue-600 hover:text-blue-800 hover:underline">
                    Forgot Password?
                  </button>
                </div>
                <Button 
                  onClick={() => handleLogin('student')}
                  disabled={loading || !email || !password}
                  className="w-full"
                  style={{ backgroundColor: '#4444FF' }}
                  onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#3333EE')}
                  onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#4444FF')}
                >
                  {loading ? 'Logging in...' : 'Login as Student'}
                </Button>
                <div className="text-center pt-4 border-t">
                  <span className="text-gray-600">
                    {showRegister ? 'Already have an account? ' : "Don't have an account? "}
                    <button 
                      onClick={() => {
                        setShowRegister(!showRegister);
                        setError('');
                      }}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {showRegister ? 'Sign in' : 'Sign up'}
                    </button>
                  </span>
                </div>
                {showRegister && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="student-name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                        <Input 
                          id="student-name" 
                          type="text" 
                          placeholder="Enter your full name" 
                          className="pl-10"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleRegister('student')}
                      disabled={loading || !name || !email || !password}
                      className="w-full"
                      style={{ backgroundColor: '#4444FF' }}
                      onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#3333EE')}
                      onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#4444FF')}
                    >
                      {loading ? 'Registering...' : 'Register as Student'}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="admin" className="space-y-4">
                {error && activeTab === 'admin' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="admin-username">Email/Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                    <Input 
                      id="admin-username" 
                      type="text" 
                      placeholder="Enter admin email" 
                      className="pl-10"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                    <Input 
                      id="admin-password" 
                      type="password" 
                      placeholder="Enter admin password" 
                      className="pl-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !loading) {
                          handleLogin('admin');
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button className="text-blue-600 hover:text-blue-800 hover:underline">
                    Forgot Password?
                  </button>
                </div>
                <Button 
                  onClick={() => handleLogin('admin')}
                  disabled={loading || !username || !password}
                  className="w-full"
                  style={{ backgroundColor: '#4444FF' }}
                  onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#3333EE')}
                  onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#4444FF')}
                >
                  {loading ? 'Logging in...' : 'Login as Admin'}
                </Button>
                {showRegister && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="admin-name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                        <Input 
                          id="admin-name" 
                          type="text" 
                          placeholder="Enter admin full name" 
                          className="pl-10"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleRegister('admin')}
                      disabled={loading || !name || !username || !password}
                      className="w-full"
                      style={{ backgroundColor: '#4444FF' }}
                      onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#3333EE')}
                      onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#4444FF')}
                    >
                      {loading ? 'Registering...' : 'Register as Admin'}
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            )}
          </CardContent>
          </Card>
        </motion.div>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
  /* NEW CHANGE */
  return (
    <div className="animated-bg">
      {/* existing routes/components stay SAME */}
    </div>
  );
}

