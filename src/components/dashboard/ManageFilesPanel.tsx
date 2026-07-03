import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useGoogleDriveAuth } from "@/features/drive/useGoogleDriveAuth";
import { driveDeleteFile, driveListFiles, type DriveFileItem } from "@/features/drive/driveApi";
import { FileText, Loader2, Trash2, RefreshCcw, CheckCircle2, Eye, ExternalLink, X, Folder, ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ManageFilesPanel() {
  const { toast } = useToast();
  const drive = useGoogleDriveAuth();

  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [previewFile, setPreviewFile] = useState<DriveFileItem | null>(null);

  const [currentFolder, setCurrentFolder] = useState<{id: string, name: string}>({id: "root", name: "My Drive"});
  const [history, setHistory] = useState<{id: string, name: string}[]>([]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const loadFiles = async (folderId = currentFolder.id) => {
    if (!drive.connected || !drive.accessToken) {
      toast({ title: "Drive not connected", description: "Connect Drive first.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const q = `'${folderId}' in parents and trashed = false`;
      const res = await driveListFiles({ accessToken: drive.accessToken, q, pageSize: 1000 });
      
      const sorted = (res.files ?? []).sort((a, b) => {
        const aFolder = a.mimeType === 'application/vnd.google-apps.folder';
        const bFolder = b.mimeType === 'application/vnd.google-apps.folder';
        if (aFolder && !bFolder) return -1;
        if (!aFolder && bFolder) return 1;
        return a.name.localeCompare(b.name);
      });

      setFiles(sorted);
      setSelected({});
    } catch (e: any) {
      toast({ title: "Load failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const openFolder = (folder: DriveFileItem) => {
    setHistory([...history, currentFolder]);
    setCurrentFolder({ id: folder.id, name: folder.name });
    loadFiles(folder.id);
  };

  const goBack = () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const prev = newHistory.pop()!;
    setHistory(newHistory);
    setCurrentFolder(prev);
    loadFiles(prev.id);
  };

  const deleteSelected = async () => {
    if (!drive.accessToken) return;
    setBusy(true);
    try {
      for (const id of selectedIds) {
        await driveDeleteFile({ accessToken: drive.accessToken, fileId: id });
      }
      toast({ title: "Nitro Success", description: "Files deleted." });
      await loadFiles(currentFolder.id);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const getPreviewUrl = (link?: string) => {
    if (!link) return "";
    return link.replace(/\/view.*$/, "/preview");
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-6 bg-card/40 backdrop-blur-md border-border glass-card flex flex-col h-[600px]">
        <div className="flex items-start gap-4 shrink-0">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trash2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold">Manage Nitro Files</h3>
            <p className="text-xs text-muted-foreground mt-1">Navigate, preview, and organize your drive.</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => loadFiles(currentFolder.id)} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            <span className="ml-2">Scan Current Folder</span>
          </Button>
          <Button size="sm" variant="destructive" onClick={deleteSelected} disabled={busy || selectedIds.length === 0}>
            Delete ({selectedIds.length})
          </Button>
        </div>

        <Separator className="my-6 opacity-20 shrink-0" />

        <div className="flex items-center gap-2 mb-4 shrink-0 bg-muted/20 p-2 rounded-lg">
          {history.length > 0 && (
            <Button size="icon" variant="ghost" className="h-6 w-6 mr-1" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <Folder className="h-4 w-4 text-yellow-500 fill-yellow-500/20" />
          <span className="text-sm font-semibold truncate flex-1">{currentFolder.name}</span>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {files.map((f) => {
            const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
            return (
              <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-background/20 hover:bg-background/40 transition-all group">
                <Checkbox
                  checked={!!selected[f.id]}
                  onCheckedChange={(v) => setSelected((prev) => ({ ...prev, [f.id]: !!v }))}
                />
                <div 
                  className={`min-w-0 flex-1 flex items-center gap-2 ${isFolder ? "cursor-pointer hover:text-primary" : ""}`}
                  onClick={() => isFolder ? openFolder(f) : setPreviewFile(f)}
                >
                  {isFolder ? (
                    <Folder className="h-5 w-5 text-yellow-500 fill-yellow-500/20 shrink-0" />
                  ) : (
                    <FileText className="h-5 w-5 text-blue-400 shrink-0" />
                  )}
                  <div className="truncate">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{f.mimeType.split('/').pop()}</p>
                  </div>
                </div>
                {!isFolder && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setPreviewFile(f)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
          {files.length === 0 && !busy && (
            <div className="text-center py-10 opacity-50">
               <Folder className="h-10 w-10 mx-auto mb-2 opacity-50" />
               <p className="text-xs">No items here. Click "Scan Current Folder".</p>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6 bg-card/40 backdrop-blur-md border-border glass-card flex flex-col h-[600px]">
        <div className="text-center flex-1 flex flex-col items-center justify-center">
          {previewFile ? (
             <div className="w-full h-full flex flex-col space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="flex-1 w-full rounded-xl overflow-hidden bg-black flex items-center justify-center border border-border/50">
                   {previewFile.webViewLink ? (
                      <iframe 
                        src={getPreviewUrl(previewFile.webViewLink)} 
                        className="w-full h-full border-0" 
                        allow="autoplay" 
                        allowFullScreen 
                      />
                   ) : <FileText className="h-16 w-16 opacity-20" />}
                </div>
                <div className="text-left shrink-0">
                   <p className="text-sm font-bold truncate">{previewFile.name}</p>
                   <p className="text-[10px] text-muted-foreground">{previewFile.mimeType}</p>
                </div>
                <Button className="w-full shrink-0" variant="outline" onClick={() => setPreviewFile(null)}>Close Preview</Button>
             </div>
          ) : (
            <>
               <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4 opacity-50">
                 <Eye className="h-8 w-8 text-muted-foreground" />
               </div>
               <h4 className="font-bold">Preview Area</h4>
               <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Click a file to see its preview and play videos here.</p>
            </>
          )}
        </div>
      </Card>

      <Dialog open={!!previewFile} onOpenChange={(o) => !o && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col bg-background/95 backdrop-blur-xl border-border/50">
          <DialogHeader className="shrink-0">
            <DialogTitle className="truncate">{previewFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full rounded-lg overflow-hidden bg-black flex items-center justify-center relative">
            {previewFile?.webViewLink ? (
               <iframe 
                 src={getPreviewUrl(previewFile.webViewLink)} 
                 className="absolute inset-0 w-full h-full border-0" 
                 allow="autoplay" 
                 allowFullScreen 
               />
            ) : (
               <FileText className="h-16 w-16 opacity-20" />
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4 shrink-0">
            <Button variant="outline" onClick={() => setPreviewFile(null)}>Close</Button>
            <Button variant="hero" asChild>
               <a href={previewFile?.webViewLink} target="_blank" rel="noopener noreferrer">Open in Google Drive</a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
