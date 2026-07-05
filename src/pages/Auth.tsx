import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Zap, User, Mail, Lock, Eye, EyeOff, ArrowLeft, Users, Upload, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "login";
  const [isLogin, setIsLogin] = useState(mode === "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const isInIframe = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    setIsLogin(mode === "login");
  }, [mode]);

  // If user is already signed-in (or signs-in via Google), push to dashboard.
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) navigate("/dashboard");
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/dashboard");
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        toast({ title: "Welcome back!" });
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // If email confirmations are enabled, this makes the confirm link return to the app.
            emailRedirectTo: `${window.location.origin}/auth?mode=login`,
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;

        toast({
          title: "Account created!",
          description: "Agar email confirmation aa jaye to confirm karke phir login karein.",
        });
        navigate("/auth?mode=login");
      }
    } catch (error: any) {
      const msg = String(error?.message || "");
      const msgLower = msg.toLowerCase();

      if (msgLower.includes("email not confirmed")) {
        toast({
          title: "Email confirm required",
          description: "Apni email inbox me confirmation link open karein, phir login karein.",
          variant: "destructive",
        });
      } else if (msgLower.includes("invalid login credentials")) {
        // Common confusion: user created account via Google and then tries email/password.
        toast({
          title: "Login nahi ho raha",
          description:
            "Agar aapne account Google se banaya tha to 'Continue with Google' use karein (email/password us account par kaam nahi karta jab tak aap password set na karein).",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: msg || "Unknown error",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (isInIframe) {
      toast({
        title: "Block in iframe",
        description: "Open in a new tab to use Google login.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: { prompt: 'select_account' }
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Google login failed",
        description: "Bhai, Supabase mein Google provider enable karein pehle.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-background grid md:grid-cols-2">
      <SEO
        title="Sign In — NitroDrive"
        description="Sign in or create a NitroDrive account to start uploading, cloning, and managing your Google Drive files."
        noindex
      />
      {/* Left Side - Form */}
      <div className="flex flex-col p-8 md:p-12 lg:p-16">
        <Link to="/" className="flex items-center gap-2 mb-8 group">
          <ArrowLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">Back to Home</span>
        </Link>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="flex items-center gap-2 mb-8">
              <div className="h-12 w-12 rounded-lg bg-gradient-hero flex items-center justify-center shadow-glow-primary">
                <Zap className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary">NitroDrive</h1>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Ultra Fast Uploader</p>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-3xl font-bold mb-2">
                {isLogin ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-muted-foreground">
                {isLogin 
                  ? "Sign in to continue to NitroDrive" 
                  : "Start uploading files at lightning speed"}
              </p>
            </div>



              <Button
                variant="outline"
                className="w-full mb-6"
                onClick={handleGoogleAuth}
                disabled={loading}
              >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="relative mb-6">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                or
              </span>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="hero"
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <Link
                to={`/auth?mode=${isLogin ? 'signup' : 'login'}`}
                className="text-primary hover:underline font-semibold"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Info */}
      <div className="hidden md:flex bg-gradient-accent items-center justify-center p-12 border-l border-border">
        <div className="max-w-md text-center">
          <div className="h-20 w-20 rounded-full bg-gradient-hero flex items-center justify-center mx-auto mb-6 shadow-glow-primary">
            <Zap className="h-10 w-10 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold mb-4">
            Upload at <span className="text-primary">Light Speed</span>
          </h2>
          <p className="text-muted-foreground mb-8">
            Join thousands of users who trust NitroDrive for their fastest uploads ever.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold text-primary">10K+</p>
              <p className="text-xs text-muted-foreground">Users</p>
            </div>
            <div>
              <Upload className="h-6 w-6 mx-auto mb-2 text-cyan-400" />
              <p className="text-2xl font-bold text-cyan-400">5M+</p>
              <p className="text-xs text-muted-foreground">Files</p>
            </div>
            <div>
              <Activity className="h-6 w-6 mx-auto mb-2 text-cyan-400" />
              <p className="text-2xl font-bold text-cyan-400">99.9%</p>
              <p className="text-xs text-muted-foreground">Uptime</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
