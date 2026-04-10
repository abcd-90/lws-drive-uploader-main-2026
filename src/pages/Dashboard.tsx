import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Zap, Gauge, Upload, FolderSync, Trash2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CloneFolderPanel from "@/components/dashboard/CloneFolderPanel";
import UploadFilesPanel from "@/components/dashboard/UploadFilesPanel";
import ManageFilesPanel from "@/components/dashboard/ManageFilesPanel";

interface Profile {
  full_name: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?mode=login");
      return;
    }

    await (supabase as any).rpc("claim_first_admin");
    await (supabase as any).rpc("refresh_expired_premium");

    const [profileRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", session.user.id).single(),
      (supabase as any).from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").limit(1),
    ]);

    if (profileRes.data) setProfile(profileRes.data);

    const hasAdminRole = Array.isArray(roleRes.data) && roleRes.data.length > 0;
    setIsAdmin(hasAdminRole);

    await (supabase as any).from("activity_logs").insert({
      user_id: session.user.id,
      user_email: session.user.email,
      event_type: "login",
      status: "success",
      metadata: { source: "dashboard" },
    });

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Zap className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-gradient-hero flex items-center justify-center shadow-glow-primary">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">LWS Drive</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                <Shield className="mr-2 h-4 w-4" />
                Admin Panel
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <header className="mb-6">
          <h2 className="text-3xl font-bold mb-2">Welcome back, {profile?.full_name || "User"}!</h2>
          <div className="flex items-center gap-2">
            <Badge className="bg-gradient-hero text-primary-foreground">
              <Gauge className="h-3 w-3 mr-1" />
              Free - 1000x Speed
            </Badge>
            {isAdmin && <Badge variant="secondary">Admin</Badge>}
          </div>
        </header>

        <Card className="p-4 md:p-5 bg-card border-border mb-6">
          <Tabs defaultValue="clone" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="clone" className="gap-2">
                <FolderSync className="h-4 w-4" /> Clone Folder
              </TabsTrigger>
              <TabsTrigger value="upload" className="gap-2">
                <Upload className="h-4 w-4" /> Upload Files
              </TabsTrigger>
              <TabsTrigger value="manage" className="gap-2">
                <Trash2 className="h-4 w-4" /> Manage Files
              </TabsTrigger>
            </TabsList>

            <TabsContent value="clone" className="mt-6">
              <CloneFolderPanel />
            </TabsContent>

            <TabsContent value="upload" className="mt-6">
              <UploadFilesPanel />
            </TabsContent>

            <TabsContent value="manage" className="mt-6">
              <ManageFilesPanel />
            </TabsContent>
          </Tabs>
        </Card>

        <Button
          variant="outline"
          onClick={() => toast({ title: "Note", description: "Clone workflow added. Upload/Manage tabs will be wired next." })}
        >
          What’s next?
        </Button>
      </main>
    </div>
  );
};

export default Dashboard;
