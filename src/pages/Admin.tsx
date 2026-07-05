import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { saveSiteConfig, fetchSiteConfig, DEFAULT_CONFIG } from "@/lib/siteConfig";
import { useNavigate } from "react-router-dom";
import { Lock, Key, ArrowRight, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Users, Settings, History, LayoutDashboard,
  CreditCard, LogOut, Zap, RefreshCcw, Crown, TrendingUp,
  Activity, Globe, Bell, ToggleLeft,
  Save, Trash2, AlertTriangle, CheckCircle, Plus, XCircle,
  DollarSign, BarChart3, Wrench, Clock, DownloadCloud
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';

const ADMIN_EMAILS = ["sheikhsami3082@gmail.com", "sheikhsami3010@gmail.com"];

const PLANS = [
  { key: "weekly",  label: "Weekly",  price: 299,  days: 7 },
  { key: "monthly", label: "Monthly", price: 799,  days: 30 },
  { key: "yearly",  label: "Yearly",  price: 4999, days: 365 },
];

type UserRow = {
  user_id: string;
  full_name: string | null;
  is_pro: boolean;
  pro_expires_at: string | null;
  email: string | null;
};

type LogRow = {
  id: string;
  user_email: string | null;
  event_type: string;
  source_name: string | null;
  status: string | null;
  created_at: string;
  metadata?: any;
};

type PaymentRow = {
  id: string;
  user_id: string;
  user_email: string;
  plan_key: string;
  plan_label: string;
  amount_pkr: number;
  screenshot_url: string | null;
  status: string;
  created_at: string;
  reviewed_by: string | null;
};

type CouponRow = {
  id: string;
  code: string;
  plan_key: string;
  duration_days: number;
  active: boolean;
  max_uses: number | null;
  used_count: number;
  created_at: string;
};

type SiteConfig = {
  siteName: string;
  tagline: string;
  maintenanceMode: boolean;
  paidModeEnabled: boolean;
  freeTransfersPerDay: number;
  proTransfersPerDay: number;
  maxFileSizeMB: number;
  googleApiKey: string;
  googleClientId: string;
  supportEmail: string;
  announcementBanner: string;
  showBanner: boolean;
  paymentNumber: string;
  paymentName: string;
  paymentMethods: string;
  weeklyPrice: number;
  monthlyPrice: number;
  yearlyPrice: number;
  weeklyLimit: string;
  monthlyLimit: string;
  yearlyLimit: string;
  channelLink: string;
  telegramLink: string;
  youtubeLink: string;
};

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: any; color: string; sub?: string;
}) {
  return (
    <Card className="border-border bg-card/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className="text-3xl font-extrabold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const dataLoaded = useRef(false);

  const [loading, setLoading]               = useState(true);
  const [isAdmin, setIsAdmin]               = useState(false);
  const [currentEmail, setCurrentEmail]     = useState("");
  const [users, setUsers]                   = useState<UserRow[]>([]);

  const [config, setConfig] = useState<SiteConfig>(() => {
    try { 
      const saved = JSON.parse(localStorage.getItem("lws_admin_config") || "null");
      return saved ? { ...defaultConfig(), ...saved } : defaultConfig();
    }
    catch { return defaultConfig(); }
  });

  // Load config from Supabase on mount (overrides localStorage with live DB values)
  const [configLoaded, setConfigLoaded] = useState(false);

  const dynamicPlans = useMemo(() => [
    { key: "weekly",  label: "Weekly",  price: config.weeklyPrice || 299,  days: 7 },
    { key: "monthly", label: "Monthly", price: config.monthlyPrice || 799,  days: 30 },
    { key: "yearly",  label: "Yearly",  price: config.yearlyPrice || 4999, days: 365 },
  ], [config.weeklyPrice, config.monthlyPrice, config.yearlyPrice]);

  const [logs, setLogs]                     = useState<LogRow[]>([]);
  const [payments, setPayments]             = useState<PaymentRow[]>([]);
  const [userSearch, setUserSearch]         = useState("");
  const [grantEmail, setGrantEmail]         = useState("");
  const [grantPlan, setGrantPlan]           = useState("monthly");
  const [granting, setGranting]             = useState(false);
  const [approvingId, setApprovingId]       = useState<string | null>(null);
  const [revokingId, setRevokingId]         = useState<string | null>(null);
  const [savingConfig, setSavingConfig]     = useState(false);
  const [exportModal, setExportModal]       = useState<"none" | "full" | "base">("none");
  const [coupons, setCoupons]               = useState<CouponRow[]>([]);
  const [couponCode, setCouponCode]         = useState("");
  const [couponPlan, setCouponPlan]         = useState("weekly");
  const [couponDuration, setCouponDuration] = useState("7");
  const [couponMaxUses, setCouponMaxUses]   = useState("");
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  function defaultConfig(): SiteConfig {
    return {
      siteName: "NitroDrive",
      tagline: "High Speed Drive Toolkit",
      maintenanceMode: false,
      paidModeEnabled: false,
      freeTransfersPerDay: 10,
      proTransfersPerDay: 500,
      maxFileSizeMB: 500,
      googleApiKey: "AIzaSyC2CeH8R9aUMoVMeMQllc6hv1skCdoKHmE",
      googleClientId: "414112233584-tbobsjntokcq82fkcm7cajuhb8r1n93p.apps.googleusercontent.com",
      supportEmail: "support@lwsdrive.com",
      announcementBanner: "",
      showBanner: false,
      paymentNumber: "0310-7701416",
      paymentName: "Muhammad Sami",
      paymentMethods: "JazzCash, Easypaisa, NayaPay",
      weeklyPrice: 299,
      monthlyPrice: 799,
      yearlyPrice: 4999,
      weeklyLimit: "50",
      monthlyLimit: "200",
      yearlyLimit: "Unlimited",
      channelLink: "",
      telegramLink: "",
      youtubeLink: "",
    };
  }

  const loadData = useCallback(async () => {
    // Profiles
    try {
      const { data } = await (supabase as any).from("profiles").select("*").limit(500);
      if (data) setUsers(data as UserRow[]);
    } catch (_) {}

    // Activity logs
    try {
      const { data } = await (supabase as any)
        .from("activity_logs")
        .select("id,user_email,event_type,source_name,status,created_at,metadata")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) setLogs(data as LogRow[]);
    } catch (_) {}

    // Payment requests — graceful if table doesn't exist yet
    try {
      const { data } = await (supabase as any)
        .from("payment_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) setPayments(data as PaymentRow[]);
    } catch (_) {}

    // Coupons
    try {
      const { data } = await (supabase as any)
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setCoupons(data as CouponRow[]);
    } catch (_) {}
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth?mode=login"); return; }

      const email = session.user.email || "";
      setCurrentEmail(email);

      let admin = ADMIN_EMAILS.includes(email);
      if (!admin) {
        try {
          const { data } = await (supabase as any)
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .eq("role", "admin")
            .limit(1);
          if (Array.isArray(data) && data.length > 0) admin = true;
        } catch (_) {}
      }

      setIsAdmin(admin);
      setLoading(false);

      if (admin && !dataLoaded.current) {
        dataLoaded.current = true;
        void loadData();
        // Load live config from Supabase
        if (!configLoaded) {
          fetchSiteConfig().then(liveConfig => {
            setConfig(liveConfig);
            setConfigLoaded(true);
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Admin auth error:", e);
      setLoading(false);
    }
  }, [navigate, loadData]);

  const [isLocked, setIsLocked] = useState(true);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const configPassword = config.adminPassword || "nitro-admin-786";
    if (adminPassword === configPassword) {
      setIsLocked(false);
      localStorage.setItem("nitro_admin_unlocked", "true");
    } else {
      setPasswordError(true);
      toast({ title: "Access Denied", description: "Invalid admin secret key.", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (localStorage.getItem("nitro_admin_unlocked") === "true") {
      setIsLocked(false);
    }
    void checkAuth();
  }, [checkAuth]);

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const result = await saveSiteConfig(config);
      if (result.error) {
        toast({ title: "Settings saved!", description: result.error });
      } else {
        toast({ title: "Settings saved & synced to all users! ✅" });
      }
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
    setSavingConfig(false);
  };

  const handleGrantPremium = async () => {
    if (!grantEmail.trim()) { toast({ title: "Email required", variant: "destructive" }); return; }
    setGranting(true);
    try {
      const plan = PLANS.find(p => p.key === grantPlan)!;
      const expiresAt = new Date(Date.now() + plan.days * 24 * 60 * 60 * 1000).toISOString();

      // Always use the RPC to grant premium, it handles everything: 
      // 1. Updates profile 2. Creates premium_grant audit log 3. Triggers email
      const { error } = await (supabase as any).rpc("admin_grant_premium_by_email", {
        _email: grantEmail.trim(), 
        _plan_key: grantPlan,
      });

      if (error) throw error;

      toast({ title: "Premium Granted!", description: `${grantEmail} → ${plan.label} plan (PKR ${plan.price})` });
      setGrantEmail("");
      void loadData();
    } catch (e: any) {
      toast({ title: "Grant failed", description: e.message, variant: "destructive" });
    }
    setGranting(false);
  };

  const createCoupon = async () => {
    if (!couponCode.trim()) {
      toast({ title: "Error", description: "Coupon code is required", variant: "destructive" });
      return;
    }
    setCreatingCoupon(true);
    try {
      const maxUsesVal = couponMaxUses.trim() ? parseInt(couponMaxUses) : null;
      const { data, error } = await (supabase as any)
        .from("coupons")
        .insert({
          code: couponCode.trim().toUpperCase(),
          plan_key: couponPlan,
          duration_days: parseInt(couponDuration) || 7,
          max_uses: maxUsesVal,
          used_count: 0,
          active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      
      toast({ title: "Success", description: "Coupon created successfully!" });
      setCoupons(prev => [data as CouponRow, ...prev]);
      setCouponCode("");
      setCouponMaxUses("");
    } catch (e: any) {
      toast({ title: "Failed to create coupon", description: e.message, variant: "destructive" });
    } finally {
      setCreatingCoupon(false);
    }
  };

  const toggleCouponActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("coupons")
        .update({ active: !currentStatus })
        .eq("id", id);
      
      if (error) throw error;
      
      setCoupons(prev => prev.map(c => c.id === id ? { ...c, active: !currentStatus } : c));
      toast({ title: "Success", description: `Coupon ${!currentStatus ? "activated" : "deactivated"}!` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;
    try {
      const { error } = await (supabase as any)
        .from("coupons")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      
      setCoupons(prev => prev.filter(c => c.id !== id));
      toast({ title: "Success", description: "Coupon deleted!" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const approvePayment = async (req: PaymentRow) => {
    setApprovingId(req.id);
    try {
      // Using RPC for atomic operation and RLS bypass
      const { data, error } = await (supabase as any).rpc("admin_approve_payment", {
        _request_id: req.id,
        _admin_email: currentEmail
      });

      if (error) throw error;

      toast({ 
        title: "Success! 🎉", 
        description: `Premium activated for ${req.user_email}. Confirmation email sent.` 
      });
      
      void loadData();
    } catch (e: any) {
      console.error("Approval error:", e);
      toast({ title: "Approval Failed", description: e.message, variant: "destructive" });
    }
    setApprovingId(null);
  };

  const rejectPayment = async (id: string, email: string) => {
    try {
      await (supabase as any).from("payment_requests")
        .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: currentEmail })
        .eq("id", id);
      toast({ title: "Request Rejected", description: `${email}'s request has been rejected.` });
      void loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const revokePayment = async (req: PaymentRow) => {
    if (!window.confirm(`Are you sure you want to revoke premium access for ${req.user_email}? This will remove their Pro status and set the payment request status to rejected.`)) {
      return;
    }
    setRevokingId(req.id);
    try {
      const { error } = await (supabase as any).rpc("admin_revoke_payment", {
        _request_id: req.id,
        _admin_email: currentEmail
      });

      if (error) throw error;

      toast({ 
        title: "Success! 🚫", 
        description: `Premium revoked for ${req.user_email}.` 
      });
      
      void loadData();
    } catch (e: any) {
      console.error("Revocation error:", e);
      toast({ title: "Revocation Failed", description: e.message, variant: "destructive" });
    }
    setRevokingId(null);
  };

  // Stats
  const proUsers       = users.filter(u => u.is_pro).length;
  const totalTransfers = logs.filter(l => l.event_type === "transfer").length;
  const totalRevenue   = payments.filter(p => p.status === "approved").reduce((sum, p) => sum + (p.amount_pkr || 0), 0);
  
  const todayLogins    = logs.filter(l => {
    const today = new Date().toDateString();
    return l.event_type === "login" && new Date(l.created_at).toDateString() === today;
  }).length;
  const pendingPayments = payments.filter(p => p.status === "pending").length;

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toDateString();
    }).reverse();

    return last7Days.map(date => ({
      name: date.split(' ').slice(1, 3).join(' '),
      transfers: logs.filter(l => l.event_type === "transfer" && new Date(l.created_at).toDateString() === date).length
    }));
  }, [logs]);

  const filteredUsers = users.filter(u =>
    (u.full_name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(userSearch.toLowerCase())
  );

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground">Loading Admin Panel...</p>
      </div>
    );
  }

  // ── Unauthorized ─────────────────────────────────────────────────────────────
  if (isLocked) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50 bg-[#161b22] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-hero" />
          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-6 border border-yellow-500/20">
              <Lock className="h-8 w-8 text-yellow-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Restricted Access</h1>
            <p className="text-muted-foreground text-sm mb-8">
              This area is for Nitro Drive administrators only. Please enter your secret key to proceed.
            </p>
            
            <form onSubmit={handleAdminLogin} className="w-full space-y-4">
              <div className="space-y-2 text-left">
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">Admin Secret Key</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="password" 
                    placeholder="••••••••••••" 
                    className={`pl-10 bg-[#0d1117] border-border/50 focus:border-yellow-500/50 transition-all ${passwordError ? 'border-destructive' : ''}`}
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      setPasswordError(false);
                    }}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-11">
                Unlock Control Center
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <div className="mt-8 flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-tighter">
              <ShieldCheck className="h-3 w-3" />
              <span>Multi-layer Security Enabled</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-red-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <Shield className="h-5 w-5" /> Unauthorized Access
            </CardTitle>
            <CardDescription>
              This area is restricted to system administrators only.<br />
              <span className="text-xs text-muted-foreground">Logged in as: {currentEmail}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/dashboard")} variant="outline" className="w-full">
              ← Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Admin UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-lg">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-lg">LWS <span className="text-primary">Admin</span></span>
              <p className="text-[10px] text-muted-foreground -mt-0.5 uppercase tracking-widest">Control Center</p>
            </div>
            <Badge variant="outline" className="ml-1 text-primary border-primary/30 text-[10px]">SaaS v3.0</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs hidden md:flex">
              <CheckCircle className="h-3 w-3 mr-1 text-green-500" /> {currentEmail}
            </Badge>
            <Button variant="ghost" size="sm" onClick={loadData} title="Refresh data">
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
              <LogOut className="h-4 w-4 mr-2 rotate-180" /> Exit Admin
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight">
            System <span className="text-primary">Control</span> Panel
          </h1>
          <p className="text-muted-foreground mt-1">Complete A-to-Z SaaS management — users, payments, billing, config, logs.</p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted rounded-xl">
            {[
              { value: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
              { value: "users",     icon: Users,           label: "Users" },
              { value: "payments",  icon: CreditCard,      label: `Payments${pendingPayments > 0 ? ` (${pendingPayments})` : ""}` },
              { value: "billing",   icon: DollarSign,      label: "Billing" },
              { value: "toolconfig",icon: Wrench,          label: "Tool Config" },
              { value: "logs",      icon: History,         label: "Activity Logs" },
              { value: "settings",  icon: Settings,        label: "Site Settings" },
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger key={value} value={value}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow">
                <Icon className="h-3.5 w-3.5" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── DASHBOARD ── */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Users"     value={users.length}   icon={Users}       color="bg-blue-500/10 text-blue-500"   sub="Registered accounts" />
              <StatCard label="Pro Members"     value={proUsers}       icon={Crown}       color="bg-yellow-500/10 text-yellow-500" sub={`${users.length ? Math.round(proUsers/users.length*100) : 0}% conversion`} />
              <StatCard label="Nitro Revenue"  value={`PKR ${totalRevenue.toLocaleString()}`} icon={DollarSign} color="bg-green-500/10 text-green-500" sub="Total approved payments" />
              <StatCard label="Total Transfers" value={totalTransfers} icon={TrendingUp}  color="bg-purple-500/10 text-purple-500"  sub="Total files cloned" />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-2 border-border bg-card/40 backdrop-blur-md glass-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" /> Daily Transfer Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                        <Tooltip 
                          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        />
                        <Bar dataKey="transfers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> System Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Paid Mode",         value: config.paidModeEnabled ? "Enabled"      : "Free (all users)", ok: true },
                    { label: "Maintenance Mode",  value: config.maintenanceMode ? "ON ⚠️"         : "Off",              ok: !config.maintenanceMode },
                    { label: "Google Drive API",  value: config.googleApiKey    ? "Configured ✓"  : "Missing ✗",         ok: !!config.googleApiKey },
                    { label: "Today's Logins",    value: todayLogins,                                                   ok: true },
                  ].map(({ label, value, ok }) => (
                    <div key={label} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={ok ? "text-green-500 font-medium" : "text-red-500 font-medium"}>{String(value)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" /> Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="justify-start"
                    onClick={() => setConfig(c => ({ ...c, maintenanceMode: !c.maintenanceMode }))}>
                    <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                    {config.maintenanceMode ? "Disable" : "Enable"} Maintenance
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start"
                    onClick={() => setConfig(c => ({ ...c, paidModeEnabled: !c.paidModeEnabled }))}>
                    <DollarSign className="h-4 w-4 mr-2 text-green-500" />
                    {config.paidModeEnabled ? "Disable" : "Enable"} Paywall
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={loadData}>
                    <RefreshCcw className="h-4 w-4 mr-2 text-blue-500" /> Refresh Data
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => navigate("/dashboard")}>
                    <Zap className="h-4 w-4 mr-2 text-purple-500" /> View App
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border bg-card/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {logs.slice(0, 8).map(log => (
                    <div key={log.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40">
                      <span className="text-muted-foreground">{log.user_email || "Anonymous"}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">{log.event_type}</Badge>
                      <span className={log.status?.includes("success") ? "text-green-500" : "text-red-500"}>{log.status}</span>
                    </div>
                  ))}
                  {logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No activity yet.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── USERS ── */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">User Management</h2>
              <Badge variant="secondary">{users.length} total users</Badge>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Search by name or email..." value={userSearch}
                onChange={e => setUserSearch(e.target.value)} className="max-w-sm" />
              <Button variant="outline" size="sm" onClick={loadData}><RefreshCcw className="h-4 w-4" /></Button>
            </div>
            <Card className="border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Pro Expires</th>
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(user => (
                        <tr key={user.user_id} className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{user.email || "—"}</div>
                            <div className="text-xs text-muted-foreground">{user.full_name || user.user_id.slice(0, 12)}</div>
                          </td>
                          <td className="px-4 py-3">
                            {user.is_pro
                              ? <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Crown className="h-3 w-3 mr-1" />Pro</Badge>
                              : <Badge variant="outline">Free</Badge>}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {user.pro_expires_at ? new Date(user.pro_expires_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="sm" onClick={() => setGrantEmail(user.email || "")} title="Grant premium">
                              <Crown className="h-4 w-4 text-yellow-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No users found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PAYMENTS ── */}
          <TabsContent value="payments" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Payment Requests</h2>
              <div className="flex items-center gap-2">
                {pendingPayments > 0 && (
                  <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                    {pendingPayments} Pending Review
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={loadData}>
                  <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                </Button>
              </div>
            </div>
            <Card className="border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Plan</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Receipt</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(req => (
                        <tr key={req.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium">{req.user_email}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="capitalize">{req.plan_label || req.plan_key}</Badge>
                          </td>
                          <td className="px-4 py-3 font-bold text-primary">PKR {req.amount_pkr?.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            {req.screenshot_url ? (
                              <div className="flex flex-col gap-1">
                                <a href={req.screenshot_url} target="_blank" rel="noopener noreferrer" className="block">
                                  <img 
                                    src={req.screenshot_url} 
                                    alt="Receipt"
                                    className="h-12 w-20 object-cover rounded-md border border-border hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = "https://placehold.co/80x48/1e293b/94a3b8?text=Image+Error";
                                    }}
                                  />
                                </a>
                                <a href={req.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline font-medium">
                                  Open Full View
                                </a>
                              </div>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] opacity-50 italic">No receipt</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(req.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={
                              req.status === "approved" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                              req.status === "rejected" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                              "bg-orange-500/10 text-orange-500 border-orange-500/20"
                            }>
                              {req.status === "approved" ? "✓ Approved" : req.status === "rejected" ? "✗ Rejected" : "⏳ Pending"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {req.status === "pending" && (
                              <div className="flex justify-end gap-2">
                                <Button size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  disabled={approvingId === req.id}
                                  onClick={() => approvePayment(req)}>
                                  {approvingId === req.id
                                    ? <RefreshCcw className="h-3 w-3 animate-spin" />
                                    : <CheckCircle className="h-3 w-3 mr-1" />}
                                  Approve
                                </Button>
                                <Button size="sm" variant="outline"
                                  className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                                  onClick={() => rejectPayment(req.id, req.user_email)}>
                                  Reject
                                </Button>
                              </div>
                            )}
                            {req.status === "approved" && (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline"
                                  className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                                  disabled={revokingId === req.id}
                                  onClick={() => revokePayment(req)}>
                                  {revokingId === req.id
                                    ? <RefreshCcw className="h-3 w-3 animate-spin" />
                                    : <XCircle className="h-3 w-3 mr-1" />}
                                  Revoke
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {payments.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-muted-foreground">
                            <Crown className="h-10 w-10 mx-auto mb-3 opacity-20" />
                            <p className="font-medium">No payment requests yet.</p>
                            <p className="text-xs mt-1">When users submit payment receipts, they will appear here.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BILLING ── */}
          <TabsContent value="billing" className="space-y-6">
            <h2 className="text-xl font-bold">Billing & Subscriptions</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ToggleLeft className="h-5 w-5 text-primary" /> Paywall Control
                  </CardTitle>
                  <CardDescription>Toggle between free and paid model with one click.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20">
                    <div>
                      <p className="font-semibold">Enable Paywall</p>
                      <p className="text-xs text-muted-foreground">Users must subscribe for premium features.</p>
                    </div>
                    <Switch checked={config.paidModeEnabled}
                      onCheckedChange={v => setConfig(c => ({ ...c, paidModeEnabled: v }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Free Transfers Per Day</Label>
                    <Input type="number" value={config.freeTransfersPerDay}
                      onChange={e => setConfig(c => ({ ...c, freeTransfersPerDay: +e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pro Transfers Per Day (Fair-use)</Label>
                    <Input type="number" value={config.proTransfersPerDay || 500}
                      onChange={e => setConfig(c => ({ ...c, proTransfersPerDay: +e.target.value }))} />
                  </div>
                  <Button onClick={saveConfig} className="w-full">
                    <Save className="mr-2 h-4 w-4" /> Save Paywall Settings
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-500" /> Manual Premium Grant
                  </CardTitle>
                  <CardDescription>Instantly give any user pro access without payment.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>User Email</Label>
                    <Input type="email" value={grantEmail}
                      onChange={e => setGrantEmail(e.target.value)} placeholder="user@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {dynamicPlans.map(p => (
                        <button key={p.key} onClick={() => setGrantPlan(p.key)}
                          className={`rounded-lg border p-3 text-center transition-all ${grantPlan === p.key ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
                          <p className="font-semibold text-sm">{p.label}</p>
                          <p className="text-xs text-muted-foreground">PKR {p.price.toLocaleString()}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleGrantPremium} disabled={granting}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                    {granting ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Crown className="mr-2 h-4 w-4" />}
                    Grant Pro Access
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" /> Payment Delivery Info
                  </CardTitle>
                  <CardDescription>Accounts where users should send their manual payments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Account Title / Name</Label>
                    <Input value={config.paymentName}
                      onChange={e => setConfig(c => ({ ...c, paymentName: e.target.value }))}
                      placeholder="e.g. Muhammad Sami" />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input value={config.paymentNumber}
                      onChange={e => setConfig(c => ({ ...c, paymentNumber: e.target.value }))}
                      placeholder="e.g. 0310-7701416" />
                  </div>
                  <div className="space-y-2">
                    <Label>Accepted Platforms (comma separated)</Label>
                    <Input value={config.paymentMethods}
                      onChange={e => setConfig(c => ({ ...c, paymentMethods: e.target.value }))}
                      placeholder="e.g. JazzCash, Easypaisa, NayaPay" />
                  </div>
                  <Button onClick={saveConfig} className="w-full">
                    <Save className="mr-2 h-4 w-4" /> Save Default Payment Details
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border bg-card/50 mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" /> Subscription Plans (PKR)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  {dynamicPlans.map(p => (
                    <div key={p.key} className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-lg">{p.label}</p>
                        <Badge variant="outline">{p.days} days</Badge>
                      </div>
                      <p className="text-2xl font-extrabold text-primary">
                        PKR {p.price.toLocaleString()}
                        <span className="text-sm text-muted-foreground font-normal">/{p.key}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TOOL CONFIG ── */}
          <TabsContent value="toolconfig" className="space-y-6">
            <h2 className="text-xl font-bold">Tool Configuration</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" /> Google API Keys
                  </CardTitle>
                  <CardDescription>Controls Google Drive integration for all users.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Google OAuth Client ID</Label>
                    <Input value={config.googleClientId}
                      onChange={e => setConfig(c => ({ ...c, googleClientId: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Google Public API Key</Label>
                    <Input value={config.googleApiKey}
                      onChange={e => setConfig(c => ({ ...c, googleApiKey: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max File Size (MB)</Label>
                    <Input type="number" value={config.maxFileSizeMB}
                      onChange={e => setConfig(c => ({ ...c, maxFileSizeMB: +e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp Community Link</Label>
                    <Input value={config.channelLink}
                      onChange={e => setConfig(c => ({ ...c, channelLink: e.target.value }))}
                      placeholder="https://chat.whatsapp.com/..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Telegram Channel Link</Label>
                    <Input value={config.telegramLink || ""}
                      onChange={e => setConfig(c => ({ ...c, telegramLink: e.target.value }))}
                      placeholder="https://t.me/..." />
                  </div>
                  <div className="space-y-2">
                    <Label>YouTube Link</Label>
                    <Input value={config.youtubeLink || ""}
                      onChange={e => setConfig(c => ({ ...c, youtubeLink: e.target.value }))}
                      placeholder="https://youtube.com/..." />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-500" /> Pricing Configuration
                  </CardTitle>
                  <CardDescription>Adjust plan prices in PKR.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label>Weekly Price (PKR)</Label>
                      <Input type="number" value={config.weeklyPrice}
                        onChange={e => setConfig(c => ({ ...c, weeklyPrice: +e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Monthly Price (PKR)</Label>
                      <Input type="number" value={config.monthlyPrice}
                        onChange={e => setConfig(c => ({ ...c, monthlyPrice: +e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Yearly Price (PKR)</Label>
                      <Input type="number" value={config.yearlyPrice}
                        onChange={e => setConfig(c => ({ ...c, yearlyPrice: +e.target.value }))} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-500" /> Plan Upload Limits
                  </CardTitle>
                  <CardDescription>Set how many uploads each plan gets (e.g. 50, 200, Unlimited).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label>Weekly Upload Limit</Label>
                      <Input value={config.weeklyLimit || ""}
                        onChange={e => setConfig(c => ({ ...c, weeklyLimit: e.target.value }))}
                        placeholder="e.g. 50" />
                    </div>
                    <div className="space-y-2">
                      <Label>Monthly Upload Limit</Label>
                      <Input value={config.monthlyLimit || ""}
                        onChange={e => setConfig(c => ({ ...c, monthlyLimit: e.target.value }))}
                        placeholder="e.g. 200" />
                    </div>
                    <div className="space-y-2">
                      <Label>Yearly Upload Limit</Label>
                      <Input value={config.yearlyLimit || ""}
                        onChange={e => setConfig(c => ({ ...c, yearlyLimit: e.target.value }))}
                        placeholder="e.g. Unlimited" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" /> Feature Flags
                  </CardTitle>
                  <CardDescription>Turn features on/off for all users instantly.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Maintenance Mode",     key: "maintenanceMode",  desc: "Show maintenance page to all users." },
                    { label: "Announcement Banner",  key: "showBanner",       desc: "Show a notice banner on dashboard." },
                  ].map(({ label, key, desc }) => (
                    <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                      <div>
                        <p className="font-medium text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <Switch
                        checked={(config as any)[key]}
                        onCheckedChange={v => setConfig(c => ({ ...c, [key]: v }))} />
                    </div>
                  ))}
                  {config.showBanner && (
                    <div className="space-y-2">
                      <Label>Banner Message</Label>
                      <Input value={config.announcementBanner}
                        onChange={e => setConfig(c => ({ ...c, announcementBanner: e.target.value }))}
                        placeholder="e.g. New feature coming soon!" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-red-500" /> Admin Access Key
                  </CardTitle>
                  <CardDescription>Change the secret password used to unlock this Admin panel.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Admin Secret Key / Password</Label>
                    <Input 
                      type="password"
                      value={config.adminPassword || "nitro-admin-786"}
                      onChange={e => setConfig(c => ({ ...c, adminPassword: e.target.value }))}
                      placeholder="e.g. your-new-secret-key"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Warning: Make sure to remember this key! You will need to type it next time you enter the Admin panel.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border bg-card/50 mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" /> Coupon Code Management
                </CardTitle>
                <CardDescription>Create and manage coupon codes to grant users trial/premium PRO access.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Create Coupon Form */}
                <div className="grid md:grid-cols-4 gap-4 items-end p-4 rounded-xl border border-border bg-muted/20">
                  <div className="space-y-2">
                    <Label>Coupon Code</Label>
                    <Input 
                      value={couponCode} 
                      onChange={e => setCouponCode(e.target.value)} 
                      placeholder="e.g. TRIAL7" 
                      className="uppercase bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Target Plan</Label>
                    <select 
                      value={couponPlan} 
                      onChange={e => {
                        const val = e.target.value;
                        setCouponPlan(val);
                        if (val === "weekly") setCouponDuration("7");
                        else if (val === "monthly") setCouponDuration("30");
                        else if (val === "yearly") setCouponDuration("365");
                      }}
                      className="w-full bg-background border border-input rounded-md h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="weekly">Weekly Plan</option>
                      <option value="monthly">Monthly Plan</option>
                      <option value="yearly">Yearly Plan</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (Days)</Label>
                    <Input 
                      type="number" 
                      value={couponDuration} 
                      onChange={e => setCouponDuration(e.target.value)} 
                      placeholder="e.g. 7" 
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Uses (Optional)</Label>
                    <Input 
                      type="number" 
                      value={couponMaxUses} 
                      onChange={e => setCouponMaxUses(e.target.value)} 
                      placeholder="Unlimited if empty" 
                      className="bg-background/50"
                    />
                  </div>
                  <div className="md:col-span-4 flex justify-end">
                    <Button onClick={createCoupon} disabled={creatingCoupon} size="sm">
                      {creatingCoupon ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Generate Coupon Code
                    </Button>
                  </div>
                </div>

                {/* Coupon List Table */}
                <div className="border border-border rounded-xl overflow-hidden bg-background/50">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/50 font-semibold text-muted-foreground uppercase tracking-wider">
                          <th className="p-3">Code</th>
                          <th className="p-3">Plan</th>
                          <th className="p-3">Duration</th>
                          <th className="p-3">Usage</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {coupons.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">
                              No coupon codes created yet. Use the form above to generate one.
                            </td>
                          </tr>
                        ) : (
                          coupons.map((coupon) => (
                            <tr key={coupon.id} className="hover:bg-muted/10">
                              <td className="p-3 font-mono font-bold text-primary text-sm">{coupon.code}</td>
                              <td className="p-3 capitalize">{coupon.plan_key}</td>
                              <td className="p-3">{coupon.duration_days} Days</td>
                              <td className="p-3">
                                <span className="font-semibold text-foreground">{coupon.used_count}</span> / {coupon.max_uses ?? "∞"}
                              </td>
                              <td className="p-3">
                                <Switch 
                                  checked={coupon.active} 
                                  onCheckedChange={() => toggleCouponActive(coupon.id, coupon.active)} 
                                />
                              </td>
                              <td className="p-3 text-right">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => deleteCoupon(coupon.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Button onClick={saveConfig} disabled={savingConfig} size="lg">
              {savingConfig ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save All Tool Settings
            </Button>
          </TabsContent>

          {/* ── ACTIVITY LOGS ── */}
          <TabsContent value="logs" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Activity Logs</h2>
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
              </Button>
            </div>
            <Card className="border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Time</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Event</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Resource</th>
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(log => (
                        <tr key={log.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2 text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-xs">{log.user_email || "Anonymous"}</td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className="text-[10px] uppercase">{log.event_type}</Badge>
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[200px]">
                            {log.source_name || "—"}
                            {log.metadata?.clonedLink && (
                              <a href={log.metadata.clonedLink} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-500 hover:underline font-bold" title={log.metadata.clonedLink}>
                                [Link]
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Badge className={log.status?.includes("success")
                              ? "bg-green-500/10 text-green-500 border-green-500/20"
                              : "bg-red-500/10 text-red-500 border-red-500/20"}>
                              {log.status || "unknown"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-muted-foreground">
                            No activity logs yet. They appear after users interact with the tool.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SITE SETTINGS ── */}
          <TabsContent value="settings" className="space-y-6">
            <h2 className="text-xl font-bold">Site Settings</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" /> Branding
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Site Name</Label>
                    <Input value={config.siteName}
                      onChange={e => setConfig(c => ({ ...c, siteName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tagline</Label>
                    <Input value={config.tagline}
                      onChange={e => setConfig(c => ({ ...c, tagline: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Support Email</Label>
                    <Input value={config.supportEmail}
                      onChange={e => setConfig(c => ({ ...c, supportEmail: e.target.value }))} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" /> Alerts & Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                    <div>
                      <p className="font-medium text-sm">Maintenance Mode</p>
                      <p className="text-xs text-muted-foreground">Disable app access during maintenance.</p>
                    </div>
                    <Switch checked={config.maintenanceMode}
                      onCheckedChange={v => setConfig(c => ({ ...c, maintenanceMode: v }))} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                    <div>
                      <p className="font-medium text-sm">Announcement Banner</p>
                      <p className="text-xs text-muted-foreground">Show a notice to all users on dashboard.</p>
                    </div>
                    <Switch checked={config.showBanner}
                      onCheckedChange={v => setConfig(c => ({ ...c, showBanner: v }))} />
                  </div>
                  {config.showBanner && (
                    <Input value={config.announcementBanner}
                      onChange={e => setConfig(c => ({ ...c, announcementBanner: e.target.value }))}
                      placeholder="Your announcement message here..." />
                  )}
                </CardContent>
              </Card>
            </div>
            <Separator />

            {/* Developer Tools */}
            <Card className="border-border bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DownloadCloud className="h-5 w-5 text-primary" /> Source Code Exporter
                </CardTitle>
                <CardDescription>Export your application's source code files completely offline.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                <Button variant="default" onClick={() => setExportModal("full")}>
                  Download Full Source Code
                </Button>
                <Button variant="outline" onClick={() => setExportModal("base")}>
                  Download Base Version (Without Admin)
                </Button>
              </CardContent>
            </Card>

            <Separator />
            <Card className="border-red-500/20 bg-red-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="h-5 w-5" /> Danger Zone
                </CardTitle>
                <CardDescription>These actions are permanent. Use with extreme caution.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button variant="outline" className="border-red-500/30 text-red-500 hover:bg-red-500/10">
                  <Trash2 className="mr-2 h-4 w-4" /> Clear All Logs
                </Button>
              </CardContent>
            </Card>
            <Button onClick={saveConfig} disabled={savingConfig} size="lg">
              {savingConfig ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save All Settings
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      {/* Export Source Code Modal */}
      <Dialog open={exportModal !== "none"} onOpenChange={(open) => !open && setExportModal("none")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Download Source Code</DialogTitle>
            <DialogDescription>
              Due to web browser security limitations, you cannot directly download backend local folders from the UI.
              However, you can instantly zip your local project by running the following command in your terminal:
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-4 rounded-md mt-2 relative border border-border">
            <code className="text-sm font-mono break-all text-primary">
              {exportModal === "full" 
                ? 'npx bestzip LWS_Full_Source.zip * .* -i "node_modules" ".git" ".supabase"' 
                : 'npx bestzip LWS_Base_Source.zip * .* -i "node_modules" ".git" ".supabase" "src/pages/Admin.tsx"'}
            </code>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            * Ensure you run this inside your `lws-drive-uploader-main` folder terminal. It will cleanly zip everything excluding heavy unnecessary folders.
          </p>
          <div className="flex justify-end mt-2">
            <Button onClick={() => setExportModal("none")}>Got it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
