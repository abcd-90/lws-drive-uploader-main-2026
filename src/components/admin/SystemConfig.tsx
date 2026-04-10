import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Globe, ShieldCheck, Mail, Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SystemConfigProps = {
  settings: any;
  onSave: (newSettings: any) => Promise<void>;
};

export const SystemConfig = ({ settings, onSave }: SystemConfigProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings || {
    site_name: "LWS Drive",
    site_tagline: "Ultra Fast Uploader",
    maintenance_mode: false,
    support_email: "sheikhsami3082@gmail.com"
  });

  // Sync local state when external settings load
  useEffect(() => {
    if (settings) {
      setLocalSettings(prev => ({
        ...prev,
        ...settings
      }));
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(localSettings);
      toast({ title: "Configuration Saved", description: "All changes are now live." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              General Branding
            </CardTitle>
            <CardDescription>Update the interface text for all users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="siteName">Site Name</Label>
                <Input 
                  id="siteName" 
                  value={localSettings.site_name} 
                  onChange={(e) => setLocalSettings({...localSettings, site_name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input 
                  id="supportEmail" 
                  type="email"
                  value={localSettings.support_email} 
                  onChange={(e) => setLocalSettings({...localSettings, support_email: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Site Tagline</Label>
              <Input 
                id="tagline" 
                value={localSettings.site_tagline} 
                onChange={(e) => setLocalSettings({...localSettings, site_tagline: e.target.value})}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-500" />
              Service Control
            </CardTitle>
            <CardDescription>Manage global service status and access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30 text-card-foreground">
              <div className="space-y-0.5">
                <div className="text-base font-semibold">Maintenance Mode</div>
                <div className="text-sm text-muted-foreground">Redirect all non-admin users to a maintenance page.</div>
              </div>
              <Switch 
                checked={localSettings.maintenance_mode}
                onCheckedChange={(checked) => setLocalSettings({...localSettings, maintenance_mode: checked})}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div className="space-y-0.5">
                <div className="text-base font-semibold">Public Registration</div>
                <div className="text-sm text-muted-foreground">Allow new users to create accounts via email.</div>
              </div>
              <Switch checked={true} disabled />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              Deployment Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase font-bold">Current Environment</div>
              <Badge variant="secondary">Production</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase font-bold">API Status</div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium">Operational</span>
              </div>
            </div>
            <Separator />
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save All Changes"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
