import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, Users, Calendar, X } from "lucide-react";

const WHATSAPP_CHANNEL_URL = "https://www.whatsapp.com/channel/0029Vb688BZ6GcGO9OwJc621";

export const WhatsAppModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const hasSeenModal = localStorage.getItem("hasSeenWhatsAppModal");
      if (!hasSeenModal) {
        setOpen(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem("hasSeenWhatsAppModal", "true");
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-hero shadow-glow-primary">
            <MessageCircle className="h-8 w-8 text-primary-foreground" />
          </div>
          <DialogTitle className="text-2xl font-bold">
            Join Our <span className="text-primary">Community</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground">
            Get exclusive updates, tips, and early access to new features by joining our WhatsApp channel!
          </p>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="flex flex-col items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              <p className="text-sm font-semibold">10K+ Members</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              <p className="text-sm font-semibold">Daily Updates</p>
            </div>
          </div>
          <Button variant="hero" className="w-full" size="lg" asChild>
            <a
              href={WHATSAPP_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClose}
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Join WhatsApp Channel
            </a>
          </Button>
          <button
            onClick={handleClose}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

