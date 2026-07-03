import { useEffect, useState } from "react";
import { fetchSiteConfig, DEFAULT_CONFIG } from "@/lib/siteConfig";
import { MessageCircle, Send, Youtube, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const CommunityBanner = () => {
  const [whatsappLink, setWhatsappLink] = useState(DEFAULT_CONFIG.channelLink);
  const [telegramLink, setTelegramLink] = useState(DEFAULT_CONFIG.telegramLink);
  const [youtubeLink, setYoutubeLink] = useState(DEFAULT_CONFIG.youtubeLink);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Fetch live community links
    fetchSiteConfig().then(cfg => {
      setWhatsappLink(cfg.channelLink || "");
      setTelegramLink(cfg.telegramLink || "");
      setYoutubeLink(cfg.youtubeLink || "");
    }).catch(() => {});

    // Check if dismissed in this session
    const isDismissed = sessionStorage.getItem("hasDismissedCommunityBanner");
    if (isDismissed) {
      setIsVisible(false);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem("hasDismissedCommunityBanner", "true");
  };

  const hasLinks = whatsappLink || telegramLink || youtubeLink;
  if (!isVisible || !hasLinks) return null;

  return (
    <div className="relative w-full bg-gradient-to-r from-slate-900 via-primary/20 to-slate-900 border-b border-primary/20 px-4 py-2 text-sm font-medium flex items-center justify-between gap-4 z-40 animate-in slide-in-from-top-4 duration-500">
      <div className="flex-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs sm:text-sm">
          <span className="animate-pulse text-primary font-bold">⚡</span> Follow / Join our Official Channels:
        </span>
        
        <div className="flex flex-wrap items-center gap-2">
          {whatsappLink && (
            <a 
              href={whatsappLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] text-xs font-bold transition-all"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          )}

          {telegramLink && (
            <a 
              href={telegramLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border border-[#0088cc]/30 text-[#0088cc] text-xs font-bold transition-all"
            >
              <Send className="h-3.5 w-3.5" />
              Telegram
            </a>
          )}

          {youtubeLink && (
            <a 
              href={youtubeLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#FF0000]/10 hover:bg-[#FF0000]/20 border border-[#FF0000]/30 text-[#FF0000] text-xs font-bold transition-all"
            >
              <Youtube className="h-3.5 w-3.5" />
              YouTube
            </a>
          )}
        </div>
      </div>
      
      <button 
        onClick={handleDismiss} 
        className="p-1 hover:bg-white/5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
