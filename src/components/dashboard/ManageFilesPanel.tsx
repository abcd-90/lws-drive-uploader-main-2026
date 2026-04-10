import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useGoogleDriveAuth } from "@/features/drive/useGoogleDriveAuth";
import { driveDeleteFile, driveListFiles, type DriveFileItem } from "@/features/drive/driveApi";
import { FileText, Loader2, Trash2, RefreshCcw, CheckCircle2 } from "lucide-react";

export default function ManageFilesPanel() {
  const { toast } = useToast();
  const drive = useGoogleDriveAuth();

  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const loadFiles = async () => {
    if (!drive.connected || !drive.accessToken) {
      toast({ title: "Drive not connected", description: "Pehle 'Connect Drive' karo.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      // Show PDF + TXT only (like screenshot).
      const q = "(mimeType = 'application/pdf' or mimeType = 'text/plain') and trashed = false";
      const res = await driveListFiles({ accessToken: drive.accessToken, q, pageSize: 100 });
      setFiles(res.files ?? []);
      setSelected({});

      toast({ title: "Loaded", description: `${res.files?.length ?? 0} file(s) found.` });
    } catch (e) {
      toast({ title: "Load failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const deleteSelected = async () => {
    if (!drive.accessToken) return;
    if (selectedIds.length === 0) {
      toast({ title: "Nothing selected" });
      return;
    }

    setBusy(true);
    try {
      for (const id of selectedIds) {
        await driveDeleteFile({ accessToken: drive.accessToken, fileId: id });
      }
      toast({ title: "Deleted", description: `${selectedIds.length} file(s) deleted.` });
      await loadFiles();
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      setBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-6 bg-card border-border">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trash2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold">Manage Files</h3>
            <p className="text-sm text-muted-foreground mt-1">View, select and delete files from your Drive</p>
          </div>
          {drive.connected ? (
            <Badge className="bg-gradient-hero text-primary-foreground">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Drive Connected
            </Badge>
          ) : (
            <Badge variant="outline">Connect Drive first</Badge>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={loadFiles} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Load Files
          </Button>
          <Button type="button" variant="destructive" onClick={deleteSelected} disabled={busy || selectedIds.length === 0}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
          </Button>
        </div>

        <Separator className="my-6" />

        {files.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 p-10 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
            <h4 className="mt-4 text-xl font-bold">No PDF or TXT files found</h4>
            <p className="mt-1 text-sm text-muted-foreground">Click "Load Files" to fetch PDF & TXT files from your Google Drive</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3">
                <Checkbox
                  checked={Boolean(selected[f.id])}
                  onCheckedChange={(v) => setSelected((prev) => ({ ...prev, [f.id]: Boolean(v) }))}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{f.mimeType}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6 bg-card border-border">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold">Results</h3>
            <p className="text-sm text-muted-foreground mt-1">View your operation results here</p>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center text-center min-h-[280px]">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
          </div>
          <h4 className="mt-6 text-2xl font-bold">Ready to go!</h4>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">Load/delete files to see results here.</p>
        </div>
      </Card>
    </div>
  );
}
