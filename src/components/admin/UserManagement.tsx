import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, UserCog, ShieldAlert, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type UserProfile = {
  user_id: string;
  full_name: string | null;
  is_pro: boolean;
  pro_expires_at: string | null;
  role?: string;
};

type UserManagementProps = {
  users: UserProfile[];
  onRefresh: () => void;
};

export const UserManagement = ({ users, onRefresh }: UserManagementProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const [updating, setUpdating] = useState<string | null>(null);

  const filteredUsers = users.filter(user => 
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.user_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTogglePro = async (userId: string, currentStatus: boolean) => {
    setUpdating(userId);
    try {
      const newExpiry = !currentStatus 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() 
        : null;

      const { error } = await supabase
        .from("profiles")
        .update({ 
          is_pro: !currentStatus,
          pro_expires_at: newExpiry
        })
        .eq("user_id", userId);

      if (error) throw error;

      toast({ 
        title: !currentStatus ? "Pro Access Granted" : "Pro Access Revoked",
        description: !currentStatus ? "30 days added." : "Access removed."
      });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Operation failed", description: e.message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>User Directory</CardTitle>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Information</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.full_name || "Anonymous User"}</span>
                      <span className="text-xs text-muted-foreground font-mono">{user.user_id.slice(0, 8)}...</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_pro ? "secondary" : "outline"} className={user.is_pro ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : ""}>
                      {user.is_pro ? "PRO" : "FREE"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {user.pro_expires_at ? new Date(user.pro_expires_at).toLocaleDateString() : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleTogglePro(user.user_id, user.is_pro)}
                      disabled={updating === user.user_id}
                    >
                      {user.is_pro ? (
                        <>
                          <ShieldAlert className="h-4 w-4 mr-2 text-red-500" />
                          Revoke
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4 mr-2 text-green-500" />
                          Make Pro
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No users found matching your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
