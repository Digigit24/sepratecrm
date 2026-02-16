import { useState } from "react";
import { useAuth} from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import "@/styles/login-animations.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      return;
    }
    
    try {
      await login({ email, password });
    } catch (err) {
      // Error is handled by useAuth hook
      console.error("Login error:", err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden relative px-4">
      {/* Animated Gradient Blobs Background */}
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>

      {/* Glassmorphic Login Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your account to continue</p>
        </div>

        {/* Glassmorphic Login Form */}
        <div className="glass-card rounded-2xl p-8 backdrop-blur-xl bg-white/70 border border-gray-200 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-900 font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="doctor@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="w-full bg-white/50 border-gray-300 text-gray-900 placeholder:text-gray-400 backdrop-blur-sm focus:bg-white/70 focus:border-gray-400"
                autoComplete="email"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-900 font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full bg-white/50 border-gray-300 text-gray-900 placeholder:text-gray-400 backdrop-blur-sm focus:bg-white/70 focus:border-gray-400 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive" className="bg-red-50 border-red-300 backdrop-blur-sm">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-gray-900 text-white hover:bg-gray-800 border border-gray-900 backdrop-blur-sm font-semibold py-6 transition-all duration-300"
              disabled={isLoading || !email || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          {/* SSO Login Options */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={(e) => e.preventDefault()}
              className="w-full flex items-center justify-center gap-3 bg-white/50 hover:bg-white/80 border border-gray-300 backdrop-blur-sm text-gray-900 font-medium py-3 px-4 rounded-lg transition-all duration-300"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <button
              type="button"
              onClick={(e) => e.preventDefault()}
              className="w-full flex items-center justify-center gap-3 bg-white/50 hover:bg-white/80 border border-gray-300 backdrop-blur-sm text-gray-900 font-medium py-3 px-4 rounded-lg transition-all duration-300"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M11.4 24H0V8h11.4v16zm.6-16h12v16H12V8zm0-8h12v7.6H12V0z"/>
              </svg>
              Continue with Microsoft
            </button>

            <button
              type="button"
              onClick={(e) => e.preventDefault()}
              className="w-full flex items-center justify-center gap-3 bg-white/50 hover:bg-white/80 border border-gray-300 backdrop-blur-sm text-gray-900 font-medium py-3 px-4 rounded-lg transition-all duration-300"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
              </svg>
              Continue with Apple
            </button>
          </div>

          {/* Footer Links */}
          <div className="mt-6 text-center">
            <a
              href="#"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              Forgot password?
            </a>
          </div>
        </div>

        {/* Additional Info */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Don't have an account?{" "}
          <a
            href="#"
            className="text-gray-900 font-semibold hover:underline"
            onClick={(e) => e.preventDefault()}
          >
            Contact Admin
          </a>
        </p>
      </div>
    </div>
  );
};

export default Login;