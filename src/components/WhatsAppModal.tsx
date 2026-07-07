import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, Users, Send, Youtube, ExternalLink, Crown, Clock } from "lucide-react";
import { fetchSiteConfig, DEFAULT_CONFIG } from "@/lib/siteConfig";

export const WhatsAppModal = () => {
  const [open, setOpen] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState(DEFAULT_CONFIG.channelLink);
  const [telegramLink, setTelegramLink] = useState(DEFAULT_CONFIG.telegramLink);
  const [youtubeLink, setYoutubeLink] = useState(DEFAULT_CONFIG.youtubeLink);

  useEffect(() => {
    // Fetch live channel link from Supabase config
    fetchSiteConfig().then(cfg => {
      setWhatsappLink(cfg.channelLink || "");
      setTelegramLink(cfg.telegramLink || "");
      setYoutubeLink(cfg.youtubeLink || "");
    }).catch(() => {});

    // Show popup every time the user loads/visits the site (no blockers)
    const timer = setTimeout(() => {
      setOpen(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setOpen(false);
  };

  const hasLinks = whatsappLink || telegramLink || youtubeLink;
  if (!hasLinks) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[420px] mx-auto p-0 overflow-hidden bg-[#0d0e12] border border-white/5 rounded-[24px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] max-h-[90vh] overflow-y-auto [&>button]:text-neutral-400 [&>button]:hover:text-white [&>button]:bg-transparent [&>button]:border-none [&>button]:right-6 [&>button]:top-6 [&>button]:transition-colors">
        
        {/* VIP ACCESS badge */}
        <div className="absolute top-6 left-6 flex items-center gap-1.5 bg-[#facc15]/10 border border-[#facc15]/20 text-[#facc15] px-3 py-1 rounded-[8px] text-[10px] font-extrabold tracking-wider uppercase">
          <Crown className="h-3 w-3 fill-[#facc15]" />
          <span>VIP ACCESS</span>
        </div>

        {/* Confetti Sparks (Left) */}
        <div className="absolute top-16 left-10 w-2 h-2 bg-yellow-400 rotate-12 rounded-sm opacity-85 pointer-events-none" />
        <div className="absolute top-26 left-6 w-3 h-1.5 bg-blue-400 rotate-45 rounded-sm opacity-85 pointer-events-none" />
        <div className="absolute top-36 left-12 w-2 h-2 bg-purple-500 -rotate-12 rounded-sm opacity-85 pointer-events-none" />
        <div className="absolute top-44 left-8 w-2 h-2 bg-emerald-400 rotate-45 opacity-85 pointer-events-none" />

        {/* Confetti Sparks (Right) */}
        <div className="absolute top-14 right-10 w-3 h-1.5 bg-emerald-400 -rotate-12 rounded-sm opacity-85 pointer-events-none" />
        <div className="absolute top-22 right-6 w-1.5 h-1.5 bg-blue-500 rounded-full opacity-85 pointer-events-none" />
        <div className="absolute top-30 right-12 w-2 h-2 bg-yellow-400 rotate-45 opacity-85 pointer-events-none" />
        <div className="absolute top-38 right-8 w-2.5 h-1.5 bg-yellow-500 -rotate-12 rounded-sm opacity-85 pointer-events-none" />
        <div className="absolute top-46 right-12 w-2 h-2 bg-purple-500 rotate-12 opacity-85 pointer-events-none" />

        <div className="p-4 sm:p-6 pt-10 space-y-4 text-center">
          <DialogHeader className="text-center sm:text-center flex flex-col items-center justify-center">
            {/* Circular Glowing Icon Container */}
            <div className="relative mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#facc15] bg-[#0d0e12] shadow-[0_0_30px_rgba(250,204,21,0.15)]">
              <Users className="h-9 w-9 text-[#facc15]" />
            </div>
            
            <DialogTitle className="text-xl sm:text-2xl font-extrabold text-white tracking-tight text-center w-full">
              Join Our <span className="text-[#facc15]">Community</span>
            </DialogTitle>
          </DialogHeader>

          <p className="text-neutral-400 text-xs leading-relaxed max-w-[300px] mx-auto text-center">
            Get exclusive updates, tips, and early access to new features by joining our official channels!
          </p>

          {/* Social Stats container */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center bg-[#171821] border border-white/5 rounded-2xl py-2 px-3 max-w-[320px] mx-auto w-full">
            <div className="flex items-center justify-center gap-2">
              <Users className="h-4 w-4 text-[#facc15]" />
              <div className="text-left leading-none">
                <span className="block text-xs font-extrabold text-white">10K+</span>
                <span className="text-[9px] text-neutral-400 font-medium">Members</span>
              </div>
            </div>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center justify-center gap-2">
              <MessageCircle className="h-4 w-4 text-emerald-500" />
              <div className="text-left leading-none">
                <span className="block text-xs font-extrabold text-white">Daily</span>
                <span className="text-[9px] text-neutral-400 font-medium">Updates</span>
              </div>
            </div>
          </div>
          
          {/* Action buttons stack */}
          <div className="flex flex-col gap-2.5 pt-1 max-w-[360px] mx-auto w-full">
            {whatsappLink && (
              <Button 
                variant="hero" 
                className="w-full bg-[#facc15] hover:bg-[#e2b007] text-black font-extrabold h-[48px] rounded-[12px] border-none shadow-[0_4px_15px_rgba(250,204,21,0.2)] transition-all active:scale-[0.98] p-0" 
                asChild
              >
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleClose}
                  className="w-full h-full flex items-center justify-between px-3 sm:px-5 text-xs sm:text-sm font-extrabold"
                >
                  <div className="w-5 flex items-center justify-start">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <span>Join WhatsApp Channel</span>
                  <div className="w-5 flex items-center justify-end">
                    <ExternalLink className="h-4 w-4 opacity-85" />
                  </div>
                </a>
              </Button>
            )}

            {telegramLink && (
              <Button 
                variant="hero" 
                className="w-full bg-[#0088cc] hover:bg-[#0077b3] text-white font-extrabold h-[48px] rounded-[12px] border-none shadow-[0_4px_15px_rgba(0,136,204,0.2)] transition-all active:scale-[0.98] p-0" 
                asChild
              >
                <a
                  href={telegramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleClose}
                  className="w-full h-full flex items-center justify-between px-3 sm:px-5 text-xs sm:text-sm font-extrabold"
                >
                  <div className="w-5 flex items-center justify-start">
                    <Send className="h-5 w-5" />
                  </div>
                  <span>Join Telegram Channel</span>
                  <div className="w-5 flex items-center justify-end">
                    <ExternalLink className="h-4 w-4 opacity-85" />
                  </div>
                </a>
              </Button>
            )}

            {youtubeLink && (
              <Button 
                variant="hero" 
                className="w-full bg-[#FF0000] hover:bg-[#cc0000] text-white font-extrabold h-[48px] rounded-[12px] border-none shadow-[0_4px_15px_rgba(255,0,0,0.2)] transition-all active:scale-[0.98] p-0" 
                asChild
              >
                <a
                  href={youtubeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleClose}
                  className="w-full h-full flex items-center justify-between px-3 sm:px-5 text-xs sm:text-sm font-extrabold"
                >
                  <div className="w-5 flex items-center justify-start">
                    <Youtube className="h-5 w-5" />
                  </div>
                  <span>Subscribe on YouTube</span>
                  <div className="w-5 flex items-center justify-end">
                    <ExternalLink className="h-4 w-4 opacity-85" />
                  </div>
                </a>
              </Button>
            )}
          </div>

          <div className="pt-1 flex justify-center">
            <button
              onClick={handleClose}
              className="flex items-center gap-2 border border-white/10 bg-[#171821] hover:bg-[#20222f] hover:border-white/20 text-neutral-400 hover:text-white transition-all px-5 py-2 rounded-full text-xs font-semibold"
            >
              <Clock className="h-3.5 w-3.5" />
              Maybe Later
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


