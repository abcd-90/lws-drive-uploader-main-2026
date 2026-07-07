import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Zap, Gauge, Upload, FolderSync, Trash2, Crown, Megaphone, CheckCircle2, AlertTriangle, Wrench, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGoogleDriveAuth } from "@/features/drive/useGoogleDriveAuth";
import CloneFolderPanel from "@/components/dashboard/CloneFolderPanel";
import UploadFilesPanel from "@/components/dashboard/UploadFilesPanel";
import ManageFilesPanel from "@/components/dashboard/ManageFilesPanel";
import UpgradeModal from "@/components/dashboard/UpgradeModal";
import { CommunityBanner } from "@/components/CommunityBanner";
import { WhatsAppModal } from "@/components/WhatsAppModal";
import { fetchSiteConfig, type SiteConfig, DEFAULT_CONFIG } from "@/lib/siteConfig";

interface Profile {
  full_name: string;
  is_pro: boolean;
  pro_expires_at: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const drive = useGoogleDriveAuth();

  // Live config from Supabase (not just localStorage)
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_CONFIG);
  const [configReady, setConfigReady] = useState(false);

  useEffect(() => {
    // Fetch live site config from Supabase
    fetchSiteConfig().then(cfg => {
      setSiteConfig(cfg);
      setConfigReady(true);
    }).catch(() => setConfigReady(true));
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth?mode=login"); return; }

      setUserId(session.user.id);
      setUserEmail(session.user.email || "");

      // Initializing core system roles
      try { await (supabase as any).rpc("claim_first_admin"); } catch (_) {}
      try { await (supabase as any).rpc("refresh_expired_premium"); } catch (_) {}

      const { data: profileRes, error } = await (supabase as any)
        .from("profiles")
        .select("full_name, is_pro, pro_expires_at")
        .eq("user_id", session.user.id)
        .single();

      if (!error && profileRes) setProfile(profileRes);

      // Log activity
      try {
        await (supabase as any).from("activity_logs").insert({
          user_id: session.user.id,
          user_email: session.user.email,
          event_type: "login",
          status: "success",
          metadata: { source: "nitro_dashboard" },
        });
      } catch (_) {}
    } catch (e) {
      console.error("Auth check failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const clientId = siteConfig.googleClientId || "414112233584-tbobsjntokcq82fkcm7cajuhb8r1n93p.apps.googleusercontent.com";
    const apiKey = siteConfig.googleApiKey || "AIzaSyC2CeH8R9aUMoVMeMQllc6hv1skCdoKHmE";
    
    // Using simple localStorage to ensure useGoogleDriveAuth sees them
    localStorage.setItem("lws_google_client_id", clientId.trim());
    localStorage.setItem("lws_google_public_api_key", apiKey.trim());
  }, [siteConfig.googleClientId, siteConfig.googleApiKey]);

  useEffect(() => {
    if (drive.error) {
      toast({
        title: "Google Drive Connection Error",
        description: drive.error,
        variant: "destructive",
      });
    }
  }, [drive.error, toast]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || !configReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Zap className="h-10 w-10 animate-nitro-pulse text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nitro Loading...</p>
        </div>
      </div>
    );
  }

  // ── MAINTENANCE MODE BLOCKER ──
  // If admin has turned on maintenance mode, show a maintenance page to all non-admin users
  if (siteConfig.maintenanceMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-lg border-yellow-500/30 bg-card/60 backdrop-blur-md p-8 text-center">
          <div className="flex flex-col items-center gap-6">
            <div className="h-20 w-20 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
              <Wrench className="h-10 w-10 text-yellow-500 animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight mb-2">Under Maintenance</h1>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                {siteConfig.siteName || "NitroDrive"} is currently undergoing scheduled maintenance. 
                We'll be back online shortly. Thank you for your patience!
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span>All services are temporarily paused</span>
            </div>
            {siteConfig.channelLink && (
              <a 
                href={siteConfig.channelLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Join our channel for updates →
              </a>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const isPro = profile?.is_pro;
  // Only show paywall/upgrade when admin has ENABLED paidModeEnabled
  const showPaywall = siteConfig.paidModeEnabled && !isPro;

  return (
    <div className="min-h-screen bg-background">
      <CommunityBanner />
      <WhatsAppModal />
      {/* Announcement Banner */}
      {siteConfig.showBanner && siteConfig.announcementBanner && (
        <div className="bg-primary/90 text-primary-foreground text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 nitro-glow">
          <Megaphone className="h-4 w-4" />
          {siteConfig.announcementBanner}
        </div>
      )}

      <nav className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div 
            onDoubleClick={() => navigate("/admin")}
            className="flex items-center gap-2 sm:gap-3 cursor-default select-none min-w-0"
          >
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-glow-primary shrink-0">
              <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
            </div>
            <div className="min-w-0 leading-tight">
              <h1 className="text-base sm:text-xl font-bold text-primary tracking-tight truncate">{siteConfig.siteName || "NitroDrive"}</h1>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest font-bold -mt-0.5">Control Panel</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {showPaywall && (
              <Button
                size="sm"
                variant="hero"
                className="nitro-glow h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3"
                onClick={() => setShowUpgrade(true)}
              >
                <Crown className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Upgrade Pro</span>
              </Button>
            )}
            <Link to="/">
              <Button variant="outline" size="sm" className="bg-muted/50 hover:bg-muted h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3">
                <Home className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="bg-muted/50 hover:bg-muted h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight mb-2">Welcome, {profile?.full_name || "User"}!</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {isPro ? (
              <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 px-3 py-1 nitro-glow">
                <Crown className="h-3 w-3 mr-1" /> Nitro Pro Member
                {profile?.pro_expires_at && (
                  <span className="ml-1 opacity-70 font-medium">
                    · Expires {new Date(profile.pro_expires_at).toLocaleDateString()}
                  </span>
                )}
              </Badge>
            ) : (
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-hero text-primary-foreground nitro-glow">
                  <Gauge className="h-3 w-3 mr-1" /> Free Nitro - 1000x Speed
                </Badge>
                {showPaywall && (
                  <button
                    onClick={() => setShowUpgrade(true)}
                    className="text-xs text-yellow-500 underline underline-offset-4 hover:text-yellow-400 transition-colors font-medium"
                  >
                    Unlock Unlimited Access →
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {showPaywall && (
          <Card 
            className="mb-8 flex items-center gap-4 p-4 rounded-2xl bg-muted/20 border-border/50 hover:bg-muted/30 transition-all cursor-pointer group glass-card"
            onClick={() => setShowUpgrade(true)}
          >
            <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Crown className="h-6 w-6 text-yellow-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Nitro Pro is waiting for you!</p>
              <p className="text-xs text-muted-foreground">Unlimited selective cloning, advanced previews, and no daily limits.</p>
            </div>
            <Button size="sm" variant="hero" className="shrink-0 nitro-glow">
              Go Pro
            </Button>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
          <h3 className="text-xl font-bold tracking-tight">Workspace Tools</h3>
          {drive.connected ? (
            <Button variant="outline" size="sm" className="border-green-500/30 text-green-500 hover:bg-green-500/10 text-xs sm:text-sm px-3 py-1.5 h-auto" onClick={() => drive.disconnect()}>
              <CheckCircle2 className="mr-2 h-4 w-4 shrink-0" />
              <span>
                <span className="hidden xs:inline">Drive Connected (Disconnect)</span>
                <span className="xs:hidden">Disconnect Drive</span>
              </span>
            </Button>
          ) : (
            <Button variant="hero" size="sm" className="nitro-glow text-xs sm:text-sm px-3 py-1.5 h-auto" onClick={() => drive.connect(userEmail)}>
              <Zap className="mr-2 h-4 w-4 fill-primary-foreground shrink-0" /> Connect Google Drive
            </Button>
          )}
        </div>

        <Card className="p-0 bg-card/60 backdrop-blur-md border-border glass-card overflow-hidden">
          <Tabs defaultValue="clone" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted/30 p-1 rounded-none border-b border-border/50 h-auto">
              <TabsTrigger value="clone" className="gap-1 sm:gap-2 data-[state=active]:bg-background/80 text-xs sm:text-sm py-2">
                <FolderSync className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> Clone
              </TabsTrigger>
              <TabsTrigger value="upload" className="gap-1 sm:gap-2 data-[state=active]:bg-background/80 text-xs sm:text-sm py-2">
                <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> Upload
              </TabsTrigger>
              <TabsTrigger value="manage" className="gap-1 sm:gap-2 data-[state=active]:bg-background/80 text-xs sm:text-sm py-2">
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> Manage
              </TabsTrigger>
            </TabsList>

            <div className="p-4 md:p-6">
              <TabsContent value="clone" className="mt-0 animate-in fade-in duration-500">
                <CloneFolderPanel />
              </TabsContent>

              <TabsContent value="upload" className="mt-0 animate-in fade-in duration-500">
                <UploadFilesPanel />
              </TabsContent>

              <TabsContent value="manage" className="mt-0 animate-in fade-in duration-500">
                <ManageFilesPanel />
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </main>

      {showUpgrade && (
        <UpgradeModal
          userEmail={userEmail}
          userId={userId}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;
