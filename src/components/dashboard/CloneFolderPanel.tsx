import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CheckCircle2, 
  Link as LinkIcon, 
  Loader2, 
  PlugZap, 
  FolderSync, 
  Search, 
  File, 
  Folder, 
  ChevronRight,
  ChevronDown,
  Filter,
  Zap,
  Plus,
  Trash2,
  PackagePlus,
  ShieldCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { saveGoogleApiKey } from "@/features/drive/googlePublicApiKey";
import { getSavedGoogleClientId, saveGoogleClientId, useGoogleDriveAuth } from "@/features/drive/useGoogleDriveAuth";
import { 
  clonePublicFolderToMyDrive, 
  parseDriveFolderId, 
  buildPublicFolderTree,
  normalizeForMatch,
  type CloneProgress,
  type TreeNode
} from "@/features/drive/clonePublicFolder";
import { fetchSiteConfig, type SiteConfig, DEFAULT_CONFIG } from "@/lib/siteConfig";

function TreeItem({ node, selected, onToggle, depth = 0 }: { node: TreeNode; selected: Record<string, boolean>; onToggle: (id: string, val: boolean) => void; depth?: number; }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isFolder = node.kind === "folder";
  return (
    <div className="select-none min-w-0 w-full overflow-hidden">
      <div className="flex items-center gap-1.5 py-1 px-1 rounded-md hover:bg-primary/5 transition-colors group min-w-0">
        <div style={{ width: `${depth * 8}px` }} />
        {isFolder ? (
          <button 
            onClick={() => setExpanded(!expanded)} 
            className="h-4 w-4 flex items-center justify-center hover:bg-muted rounded text-muted-foreground shrink-0"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : <div className="w-4 shrink-0" />}
        <Checkbox checked={selected[node.id]} onCheckedChange={(v) => onToggle(node.id, !!v)} className="scale-90" />
        {isFolder ? <Folder className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500/20 shrink-0" /> : <File className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
        <span className="text-[11px] sm:text-xs font-medium truncate flex-1">{node.name}</span>
      </div>
      {isFolder && expanded && node.children?.map(child => <TreeItem key={child.id} node={child} selected={selected} onToggle={onToggle} depth={depth + 1} />)}
    </div>
  );
}

export default function CloneFolderPanel() {
  const { toast } = useToast();
  const drive = useGoogleDriveAuth();
  const injectInputRef = useRef<HTMLInputElement>(null);

  // Live config from Supabase (not just localStorage)
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_CONFIG);

  const [loginEmail, setLoginEmail] = useState<string>("");
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");

  const [folderLink, setFolderLink] = useState("");
  const [scannedTree, setScannedTree] = useState<TreeNode | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [injectedFiles, setInjectedFiles] = useState<File[]>([]);
  const [filterKeywords, setFilterKeywords] = useState("promo, link, ads"); // Default keywords
  const [exactFilterNames, setExactFilterNames] = useState(""); // Exact file names to deselect & replace
  
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<CloneProgress | null>(null);
  const [transfersToday, setTransfersToday] = useState(0);
  const [isPro, setIsPro] = useState(false);

  const folderId = useMemo(() => parseDriveFolderId(folderLink), [folderLink]);

  useEffect(() => {
    // Fetch live config from Supabase
    fetchSiteConfig().then(cfg => {
      setSiteConfig(cfg);
      const clientId = cfg.googleClientId || DEFAULT_CONFIG.googleClientId;
      const apiKey = cfg.googleApiKey || DEFAULT_CONFIG.googleApiKey;
      saveGoogleClientId(clientId);
      saveGoogleApiKey(apiKey);
      setGoogleClientId(clientId);
      setGoogleApiKey(apiKey);
    }).catch(() => {
      // Fallback to defaults
      setGoogleClientId(DEFAULT_CONFIG.googleClientId);
      setGoogleApiKey(DEFAULT_CONFIG.googleApiKey);
    });

    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      setLoginEmail(user?.email || "");
      if (user) {
        checkLimits(user.id);
        checkProStatus(user.id);
      }
    });
  }, []);

  const checkProStatus = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("is_pro").eq("user_id", uid).single();
    if (data) setIsPro(!!data.is_pro);
  };

  const checkLimits = async (uid: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count } = await supabase
      .from("activity_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("event_type", "clone_start")
      .gte("created_at", today.toISOString());
    
    setTransfersToday(count || 0);
  };

  const handleScan = async () => {
    if (!folderId) return;
    setScanning(true);
    setScannedTree(null);
    try {
      const tree = await buildPublicFolderTree({
        apiKey: googleApiKey,
        accessToken: drive.accessToken || undefined,
        rootFolderId: folderId,
        onProgress: (p) => setProgress(p),
        filterKeywords: filterKeywords.split(",")
      });
      setScannedTree(tree);
      const initial: Record<string, boolean> = {};
      const selectAll = (n: TreeNode) => {
        initial[n.id] = true;
        if (n.kind === "folder") n.children.forEach(selectAll);
      };
      selectAll(tree);

      // Auto-deselect files matching exact filter names
      const exactNames = exactFilterNames.split(",").map(n => normalizeForMatch(n)).filter(Boolean);
      if (exactNames.length > 0) {
        const deselectExact = (n: TreeNode) => {
          if (n.kind === "file") {
            const norm = normalizeForMatch(n.name);
            if (exactNames.some(exact => norm.includes(exact))) {
              initial[n.id] = false;
            }
          }
          if (n.kind === "folder") n.children.forEach(deselectExact);
        };
        deselectExact(tree);
      }

      setSelectedItems(initial);
      toast({ title: "Nitro Scan Ready" });
    } catch (e: any) {
      const msg = e.message || String(e);
      if (msg.includes("401") || msg.includes("Invalid Credentials") || msg.includes("unauthorized")) {
        drive.disconnect();
        toast({
          title: "Session Expired",
          description: "Your Google Drive session has expired. Please click 'Connect Google Drive' to authorize again.",
          variant: "destructive"
        });
      } else {
        toast({ title: "Scan Failed", description: msg, variant: "destructive" });
      }
    } finally {
      setScanning(false);
      setProgress(null);
    }
  };

  const handleToggle = (id: string, val: boolean) => {
    setSelectedItems(prev => {
      const next = { ...prev, [id]: val };
      const node = findNode(scannedTree, id);
      if (node?.kind === "folder") {
        const toggleAll = (n: TreeNode) => {
          next[n.id] = val;
          if (n.kind === "folder") n.children.forEach(toggleAll);
        };
        node.children.forEach(toggleAll);
      }
      return next;
    });
  };

  const findNode = (node: TreeNode | null, id: string): TreeNode | null => {
    if (!node) return null;
    if (node.id === id) return node;
    if (node.kind === "folder") {
      for (const child of node.children) {
        const res = findNode(child, id);
        if (res) return res;
      }
    }
    return null;
  };

  const limitReached = useMemo(() => {
    if (isPro) return transfersToday >= (siteConfig.proTransfersPerDay || 500);
    return transfersToday >= (siteConfig.freeTransfersPerDay || 10);
  }, [transfersToday, isPro, siteConfig]);

  const handleStart = async () => {
    if (!drive.accessToken || !folderId) return;
    setBusy(true);
    try {
      const selectedSet = scannedTree ? new Set(Object.keys(selectedItems).filter(id => selectedItems[id])) : undefined;
      await clonePublicFolderToMyDrive({
        apiKey: googleApiKey,
        accessToken: drive.accessToken,
        rootFolderId: folderId,
        onProgress: setProgress,
        selectedIds: selectedSet,
        injectedFiles: injectedFiles,
        filterKeywords: filterKeywords.split(","),
        exactFilterNames: exactFilterNames.split(",").map(n => n.trim()).filter(Boolean)
      });
      
      // Log clone event for limit tracking + resource info for admin
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          user_email: user.email,
          event_type: "clone_start",
          source_name: scannedTree?.name || folderId,
          status: "success",
          metadata: { 
            folderId,
            clonedLink: folderLink,
            folderName: scannedTree?.name || null,
            filesSelected: scannedTree ? Object.values(selectedItems).filter(Boolean).length : null,
          }
        });
        checkLimits(user.id);
      }

      toast({ title: "Nitro Transfer Complete! 🚀" });
      setScannedTree(null);
      setInjectedFiles([]);
    } catch (e: any) {
      const msg = e.message || String(e);
      if (msg.includes("401") || msg.includes("Invalid Credentials") || msg.includes("unauthorized")) {
        drive.disconnect();
        toast({
          title: "Session Expired",
          description: "Your Google Drive session has expired. Please click 'Connect Google Drive' to authorize again.",
          variant: "destructive"
        });
      } else {
        toast({ title: "Transfer Failed", description: msg, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  const pct = useMemo(() => {
    if (!progress || progress.total === 0) return 0;
    return Math.min(100, Math.round((progress.done / progress.total) * 100));
  }, [progress]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-3 sm:p-6 bg-card/60 backdrop-blur-md border-border glass-card min-w-0">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-glow-primary">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold">Nitro Smart Clone</h3>
            <p className="text-sm text-muted-foreground mt-1">Automatic folder naming & smart promo filtering.</p>
          </div>
        </div>

        <Separator className="my-6 opacity-20" />

        <div className="space-y-4">
          <div className="space-y-3">
            <Label>Google Drive Link</Label>
            <div className="flex gap-2">
              <Input
                value={folderLink}
                onChange={(e) => setFolderLink(e.target.value)}
                placeholder="Paste link here..."
                className="bg-background/50"
              />
              <Button variant="outline" onClick={handleScan} disabled={scanning || busy || !folderId}>
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2">Scan</span>
              </Button>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
            <div className="flex items-center gap-2">
               <ShieldCheck className="h-4 w-4 text-green-500" />
               <Label className="text-xs font-bold uppercase tracking-widest">Nitro Cleaner (Auto-Filter)</Label>
            </div>
            <Input 
              value={filterKeywords}
              onChange={(e) => setFilterKeywords(e.target.value)}
              placeholder="promo, ads, links, txt"
              className="h-8 text-xs bg-background/50"
            />
            <p className="text-[10px] text-muted-foreground">NitroDrive will auto-skip any file/folder containing these words.</p>
            <Separator className="my-2 opacity-10" />
            <div className="flex items-center gap-2">
               <Filter className="h-4 w-4 text-orange-500" />
               <Label className="text-xs font-bold uppercase tracking-widest">Exact File Names (Auto-Replace)</Label>
            </div>
            <Input 
              value={exactFilterNames}
              onChange={(e) => setExactFilterNames(e.target.value)}
              placeholder="500$ bonus.pdf, More Courses.pdf"
              className="h-8 text-xs bg-background/50"
            />
            <p className="text-[10px] text-muted-foreground">Enter full file names — these files will be automatically deselected and replaced by your injected files.</p>
          </div>

          {scannedTree && (
            <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
              <div className="rounded-xl border border-border/50 bg-background/30 p-2 sm:p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-widest">Selected Content</span>
                  </div>
                </div>
                <div className="max-h-[250px] overflow-y-auto overflow-x-hidden custom-scrollbar pr-2 w-full min-w-0">
                  <TreeItem node={scannedTree} selected={selectedItems} onToggle={handleToggle} />
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PackagePlus className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-widest">Injection Queue</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => injectInputRef.current?.click()}>
                    <Plus className="h-4 w-4 mr-1" /> Add Files
                  </Button>
                </div>
                <input type="file" multiple hidden ref={injectInputRef} onChange={(e) => setInjectedFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />
                <div className="flex flex-wrap gap-2">
                   {injectedFiles.map((f, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] pr-1">
                        {f.name} <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setInjectedFiles(p => p.filter((_, idx) => idx !== i))} />
                      </Badge>
                   ))}
                </div>
              </div>
            </div>
          )}

          {!drive.connected ? (
            <Button 
              variant="hero" 
              size="lg" 
              className="w-full nitro-glow h-14" 
              onClick={() => drive.connect(loginEmail)}
              disabled={busy}
            >
              <Zap className="mr-2 h-6 w-6 fill-primary" /> Start Nitro Transfer
            </Button>
          ) : limitReached ? (
            <Button 
              variant="hero" 
              size="lg" 
              className="w-full nitro-glow h-14 bg-red-600/20 border-red-500/50 text-red-500 cursor-not-allowed" 
              disabled
            >
              <ShieldCheck className="mr-2 h-6 w-6" /> Daily Limit Reached ({transfersToday})
            </Button>
          ) : (
            <Button 
              variant="hero" 
              size="lg" 
              className="w-full nitro-glow h-14" 
              onClick={handleStart} 
              disabled={busy || !folderId}
            >
              {busy ? (
                <span className="inline-flex items-center">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Nitro Transferring...
                </span>
              ) : (
                <span className="inline-flex items-center text-lg">
                  <Zap className="mr-2 h-6 w-6 fill-primary" /> Start Nitro Transfer
                </span>
              )}
            </Button>
          )}

          {progress && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-[10px] font-bold uppercase text-primary">
                <span>{progress.message}</span>
                <span>{pct}%</span>
              </div>
              <Progress value={pct} className="h-1.5 shadow-glow-primary" />
              {progress.errors && progress.errors.length > 0 && (
                <div className="mt-4 p-3 bg-red-950/40 border border-red-500/30 rounded-xl space-y-1.5 text-left max-h-[150px] overflow-y-auto custom-scrollbar">
                  <div className="text-[10px] font-bold uppercase text-red-400 mb-1">Failed Files Error Log:</div>
                  {progress.errors.map((err, idx) => (
                    <div key={idx} className="text-[10px] font-mono text-red-300/90 break-all leading-normal">
                      • {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6 bg-card/60 backdrop-blur-md border-border glass-card flex flex-col items-center justify-center text-center">
        {!busy ? (
          <div className="animate-in zoom-in duration-700">
             <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 shadow-glow-primary mx-auto">
                <Zap className="h-12 w-12 text-primary" />
             </div>
             <h4 className="text-2xl font-bold">Nitro Control</h4>
             <p className="text-sm text-muted-foreground mt-2 max-w-[250px]">
                {scannedTree ? "Content is filtered and ready for high-speed injection." : "Ready to launch. Click Start Transfer or Scan to customize content."}
             </p>
          </div>
        ) : (
          <div className="w-full space-y-8 animate-in fade-in duration-500">
             <div className="relative h-40 w-40 mx-auto">
                <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <Zap className="h-16 w-16 text-primary animate-bounce" />
                </div>
             </div>
             <div className="space-y-2">
                <Badge className="bg-primary/20 text-primary border-primary/30 uppercase tracking-widest text-[10px]">Processing Stage: {progress?.phase}</Badge>
                <h4 className="text-xl font-bold">Transferring Data</h4>
                <p className="text-xs text-muted-foreground">Original folder names and smart filters are active.</p>
             </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function X({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <svg onClick={onClick} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  )
}
