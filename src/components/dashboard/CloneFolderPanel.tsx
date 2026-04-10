import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Link as LinkIcon, Loader2, PlugZap, Unplug, FolderSync } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { saveGoogleApiKey } from "@/features/drive/googlePublicApiKey";
import { getSavedGoogleClientId, saveGoogleClientId, useGoogleDriveAuth } from "@/features/drive/useGoogleDriveAuth";
import { clonePublicFolderToMyDrive, parseDriveFolderId, type CloneProgress } from "@/features/drive/clonePublicFolder";

export default function CloneFolderPanel() {
  const { toast } = useToast();
  const drive = useGoogleDriveAuth();

  const [loginEmail, setLoginEmail] = useState<string>("");
  const [autoTried, setAutoTried] = useState(false);

  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [googleApiKey, setGoogleApiKey] = useState<string>("");
  const [googleClientId, setGoogleClientId] = useState(() => getSavedGoogleClientId());

  useEffect(() => {
    // Pull the email from the currently logged-in app session (and keep it updated)
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email || "";
      setLoginEmail(email);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setLoginEmail(session?.user?.email || "");
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Auto-load owner-configured Google keys from backend so end-users don't need to paste anything.
    let cancelled = false;

    async function loadConfig() {
      setConfigLoading(true);
      setConfigError(null);

      const { data, error } = await supabase.functions.invoke("drive-config");
      if (cancelled) return;

      if (error) {
        setConfigError(error.message);
        setConfigLoading(false);
        return;
      }

      const clientId = String((data as any)?.googleClientId ?? "").trim();
      const apiKey = String((data as any)?.googleApiKey ?? "").trim();

      if (!clientId || !apiKey) {
        setConfigError(
          "Drive configuration missing. Owner ko backend me GOOGLE_OAUTH_CLIENT_ID aur GOOGLE_PUBLIC_API_KEY set karne honge.",
        );
        setConfigLoading(false);
        return;
      }

      setGoogleClientId(clientId);
      setGoogleApiKey(apiKey);

      // Keep compatibility with existing localStorage-based helpers.
      saveGoogleClientId(clientId);
      saveGoogleApiKey(apiKey);

      setConfigLoading(false);
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Auto-connect after login if user already granted access before
    // (first-time users still need 1 click due to Google security)
    if (autoTried) return;
    if (drive.connected) return;
    if (!googleClientId) return;
    if (drive.isInIframe) return;

    setAutoTried(true);
    void drive.connectSilently(loginEmail || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTried, drive.connected, drive.isInIframe, googleClientId, loginEmail]);

  const [folderLink, setFolderLink] = useState("");
  const [removeWord, setRemoveWord] = useState("");
  const [creditText, setCreditText] = useState("");
  const [destFolderName, setDestFolderName] = useState("");

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<CloneProgress | null>(null);

  const folderId = useMemo(() => parseDriveFolderId(folderLink), [folderLink]);

  const canStart = Boolean(drive.connected && drive.accessToken && googleApiKey && folderId && !busy);

  const handleConnect = async () => {
    try {
      saveGoogleClientId(googleClientId);
      await drive.connect(loginEmail || undefined);
      if (!drive.error) {
        toast({ title: "Drive connected" });
      }
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const handleDisconnect = () => {
    drive.disconnect();
    toast({ title: "Disconnected" });
  };

  const handleStart = async () => {
    if (!drive.accessToken) return;
    if (!folderId) {
      toast({ title: "Invalid link", description: "Folder/File link ya ID sahi nahi hai.", variant: "destructive" });
      return;
    }
    if (!googleApiKey) {
      toast({ title: "Missing API key", description: "Owner configuration missing.", variant: "destructive" });
      return;
    }

    setBusy(true);
    setProgress({ phase: "listing", message: "Starting...", done: 0, total: 0 });

    try {
      const result = await clonePublicFolderToMyDrive({
        apiKey: googleApiKey,
        accessToken: drive.accessToken,
        rootFolderId: folderId,
        destFolderName: destFolderName.trim() || undefined,
        removeWord: removeWord.trim() || undefined,
        creditText: creditText.trim() || undefined,
        onProgress: setProgress,
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id) {
        await (supabase as any).from("activity_logs").insert({
          user_id: session.user.id,
          user_email: session.user.email,
          event_type: "transfer",
          source_name: destFolderName.trim() || "Drive Clone",
          source_id: folderId,
          status: "success",
          metadata: {
            totalFiles: result.totalFiles,
            destinationFolderId: result.destinationFolderId,
            destinationFolderName: result.destinationFolderName,
          },
        });
      }

      toast({
        title: "Clone complete",
        description: `Uploaded ${result.totalFiles} file(s) to your Drive.`,
      });
    } catch (e) {
      toast({
        title: "Clone failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const pct = useMemo(() => {
    if (!progress) return 0;
    if (progress.total <= 0) return 10;
    return Math.min(100, Math.round((progress.done / progress.total) * 100));
  }, [progress]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-6 bg-card border-border">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderSync className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold">Clone Drive Folder / File</h3>
            <p className="text-sm text-muted-foreground mt-1">Public Google Drive folder ya single file ko aapki connected Drive me copy karega.</p>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {configLoading ? (
              <Badge variant="secondary">Config loading…</Badge>
            ) : configError ? (
              <Badge variant="destructive">Config missing</Badge>
            ) : (
              <Badge className="bg-gradient-hero text-primary-foreground">Configured</Badge>
            )}

            {drive.connected ? (
              <Button type="button" variant="outline" onClick={handleDisconnect} disabled={busy}>
                <Unplug className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            ) : (
              <Button type="button" variant="hero" onClick={handleConnect} disabled={busy || !googleClientId || !!configError || configLoading}>
                <PlugZap className="mr-2 h-4 w-4" />
                Connect Drive
              </Button>
            )}

            {drive.connected && (
              <Badge className="bg-gradient-hero text-primary-foreground">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Drive Connected
              </Badge>
            )}
          </div>

          {drive.isInIframe && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Preview (iframe) me Google Connect block ho jata hai. Is page ko <b>new tab</b> me open karke Connect Drive karein.
              <div className="mt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => window.open(window.location.href, "_blank", "noopener,noreferrer")}>
                  Open in new tab
                </Button>
              </div>
            </div>
          )}

          {configError && <p className="text-sm text-destructive">{configError}</p>}

          {drive.error && !drive.connected && !drive.isInIframe && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="text-destructive">{drive.error}</p>
              {(String(drive.error).toLowerCase().includes("redirect_uri_mismatch") ||
                String(drive.error).toLowerCase().includes("invalid_request")) && (
                <p className="mt-2 text-muted-foreground">
                  Is site ka origin: <b>{window.location.origin}</b>
                  <br />
                  Owner: Google Cloud Console → Credentials → OAuth Client → Authorized JavaScript origins me ye origin add karein.
                </p>
              )}
            </div>
          )}

          <Separator className="my-2" />

          <div>
            <Label htmlFor="folderLink">Google Drive Folder/File Link</Label>
            <div className="relative mt-1">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="folderLink"
                value={folderLink}
                onChange={(e) => setFolderLink(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/... ya https://drive.google.com/file/d/..."
                className="pl-10"
              />
            </div>
            {folderLink && !folderId && <p className="mt-1 text-xs text-destructive">Folder/File link ya ID detect nahi hua.</p>}
          </div>

          <div>
            <Label htmlFor="destFolderName">Rename clone folder name (Optional)</Label>
            <Input
              id="destFolderName"
              value={destFolderName}
              onChange={(e) => setDestFolderName(e.target.value)}
              placeholder="e.g. My Cloned Folder"
            />
            <p className="mt-1 text-xs text-muted-foreground">Agar blank chhor dain to source folder ka original name hi use hoga.</p>
          </div>

          <div>
            <Label htmlFor="removeWord">Remove Word (Optional)</Label>
            <Input id="removeWord" value={removeWord} onChange={(e) => setRemoveWord(e.target.value)} placeholder="Word to remove from file names" />
          </div>

          <div>
            <Label htmlFor="creditText">Credit Text (Optional)</Label>
            <Input id="creditText" value={creditText} onChange={(e) => setCreditText(e.target.value)} placeholder="Add credit text to file names" />
          </div>

          <Button type="button" variant="hero" size="lg" className="w-full" onClick={handleStart} disabled={!canStart || !!configError || configLoading}>
            {busy ? (
              <span className="inline-flex items-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Working...
              </span>
            ) : (
              <span className="inline-flex items-center">
                <FolderSync className="mr-2 h-5 w-5" />
                Start Cloning
              </span>
            )}
          </Button>

          {progress && (
            <div className="space-y-2 pt-2">
              <Progress value={pct} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {progress.message} {progress.total > 0 ? `(${progress.done}/${progress.total})` : ""}
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6 bg-card border-border">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold">Results</h3>
            <p className="text-sm text-muted-foreground mt-1">Operation results yahan show honge.</p>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center text-center min-h-[280px]">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
          </div>
          <h4 className="mt-6 text-2xl font-bold">Ready to go!</h4>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">Start a clone to see results here. (Public folder must be shared as “Anyone with the link can view”.)</p>
        </div>
      </Card>
    </div>
  );
}
