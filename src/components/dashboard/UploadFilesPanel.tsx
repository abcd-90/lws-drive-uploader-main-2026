import { useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGoogleDriveAuth } from "@/features/drive/useGoogleDriveAuth";
import { driveUploadFile } from "@/features/drive/driveApi";

type UploadRow = {
  name: string;
  status: "queued" | "uploading" | "done" | "error";
  message?: string;
};

export default function UploadFilesPanel() {
  const { toast } = useToast();
  const drive = useGoogleDriveAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [busy, setBusy] = useState(false);

  const doneCount = useMemo(() => rows.filter((r) => r.status === "done").length, [rows]);
  const totalCount = rows.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const pickFiles = () => inputRef.current?.click();

  const enqueue = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setRows((prev) => [
      ...prev,
      ...list.map((f) => ({ name: f.name, status: "queued" as const })),
    ]);

    void startUpload(list);
  };

  const startUpload = async (files: File[]) => {
    if (!drive.connected || !drive.accessToken) {
      toast({ title: "Drive not connected", description: "Pehle 'Connect Drive' karo.", variant: "destructive" });
      return;
    }

    setBusy(true);

    for (const file of files) {
      setRows((prev) =>
        prev.map((r) => (r.name === file.name && r.status === "queued" ? { ...r, status: "uploading" } : r)),
      );

      try {
        await driveUploadFile({ accessToken: drive.accessToken, file });
        setRows((prev) => prev.map((r) => (r.name === file.name ? { ...r, status: "done" } : r)));
      } catch (e) {
        setRows((prev) =>
          prev.map((r) =>
            r.name === file.name
              ? { ...r, status: "error", message: e instanceof Error ? e.message : String(e) }
              : r,
          ),
        );
      }
    }

    setBusy(false);
    toast({ title: "Upload complete", description: "Files aapki Google Drive me upload ho gaye." });
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) enqueue(e.dataTransfer.files);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-6 bg-card border-border">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <UploadCloud className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold">Upload Files</h3>
            <p className="text-sm text-muted-foreground mt-1">Upload files directly to your Google Drive</p>
          </div>
          {drive.connected ? (
            <Badge className="bg-gradient-hero text-primary-foreground">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Drive Connected
            </Badge>
          ) : (
            <Badge variant="outline">Connect Drive first</Badge>
          )}
        </div>

        <div
          className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center cursor-pointer"
          onClick={pickFiles}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
        >
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <UploadCloud className="h-8 w-8 text-primary" />
          </div>
          <h4 className="mt-4 text-xl font-bold">Drop files here</h4>
          <p className="mt-1 text-sm text-muted-foreground">or click to browse from your computer</p>

          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) enqueue(e.target.files);
              e.currentTarget.value = "";
            }}
          />
        </div>

        {totalCount > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Progress</p>
              <p className="text-sm font-medium">{doneCount}/{totalCount}</p>
            </div>
            <Progress value={pct} className="h-2" />

            <div className="space-y-2">
              {rows.slice(-6).reverse().map((r) => (
                <div key={`${r.name}-${r.status}`} className="flex items-center justify-between gap-3">
                  <p className="text-sm truncate">{r.name}</p>
                  {r.status === "uploading" && (
                    <span className="inline-flex items-center text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading
                    </span>
                  )}
                  {r.status === "done" && (
                    <span className="inline-flex items-center text-sm text-primary">
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Done
                    </span>
                  )}
                  {r.status === "error" && (
                    <span className="inline-flex items-center text-sm text-destructive" title={r.message}>
                      <AlertTriangle className="mr-2 h-4 w-4" /> Error
                    </span>
                  )}
                  {r.status === "queued" && <span className="text-sm text-muted-foreground">Queued</span>}
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setRows([])}>
                Clear
              </Button>
            </div>
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
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">Upload files to see results here.</p>
        </div>
      </Card>
    </div>
  );
}
