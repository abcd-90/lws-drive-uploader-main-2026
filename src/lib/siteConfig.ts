/**
 * Centralized Site Config helper
 * Fetches admin settings from Supabase so ALL users see the same config.
 * Falls back to localStorage if Supabase fetch fails (e.g., migration not yet run).
 */
import { supabase } from "@/integrations/supabase/client";

export interface SiteConfig {
  siteName: string;
  tagline: string;
  maintenanceMode: boolean;
  paidModeEnabled: boolean;
  freeTransfersPerDay: number;
  proTransfersPerDay: number;
  maxFileSizeMB: number;
  googleApiKey: string;
  googleClientId: string;
  supportEmail: string;
  announcementBanner: string;
  showBanner: boolean;
  paymentNumber: string;
  paymentName: string;
  paymentMethods: string;
  weeklyPrice: number;
  monthlyPrice: number;
  yearlyPrice: number;
  weeklyLimit: string;
  monthlyLimit: string;
  yearlyLimit: string;
  channelLink: string;
  telegramLink: string;
  youtubeLink: string;
  adminPassword?: string;
}

export const DEFAULT_CONFIG: SiteConfig = {
  siteName: "NitroDrive",
  tagline: "High Speed Drive Toolkit",
  maintenanceMode: false,
  paidModeEnabled: false,
  freeTransfersPerDay: 10,
  proTransfersPerDay: 500,
  maxFileSizeMB: 500,
  googleApiKey: "AIzaSyC2CeH8R9aUMoVMeMQllc6hv1skCdoKHmE",
  googleClientId: "414112233584-tbobsjntokcq82fkcm7cajuhb8r1n93p.apps.googleusercontent.com",
  supportEmail: "support@lwsdrive.com",
  announcementBanner: "",
  showBanner: false,
  paymentNumber: "0310-7701416",
  paymentName: "Muhammad Sami",
  paymentMethods: "JazzCash, Easypaisa, NayaPay",
  weeklyPrice: 299,
  monthlyPrice: 799,
  yearlyPrice: 4999,
  weeklyLimit: "50",
  monthlyLimit: "200",
  yearlyLimit: "Unlimited",
  channelLink: "",
  telegramLink: "",
  youtubeLink: "",
  adminPassword: "nitro-admin-786",
};

/**
 * Fetch live site config from Supabase (admin_settings.config_json).
 * Falls back to localStorage → defaults if Supabase fails.
 */
export async function fetchSiteConfig(): Promise<SiteConfig> {
  try {
    const { data, error } = await (supabase as any)
      .from("admin_settings")
      .select("config_json, paid_mode_enabled")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!error && data) {
      const dbConfig = data.config_json || {};
      // Merge: DB config_json takes priority, then fill missing with defaults
      const merged: SiteConfig = { ...DEFAULT_CONFIG, ...dbConfig };
      // Sync paid_mode_enabled from the dedicated column as source of truth
      if (typeof data.paid_mode_enabled === "boolean") {
        merged.paidModeEnabled = data.paid_mode_enabled;
      }
      // Also update localStorage for offline/fallback usage
      localStorage.setItem("lws_admin_config", JSON.stringify(merged));
      return merged;
    }
  } catch (_) {
    // Supabase fetch failed — fall through to localStorage
  }

  // Fallback to localStorage
  try {
    const saved = JSON.parse(localStorage.getItem("lws_admin_config") || "null");
    if (saved) return { ...DEFAULT_CONFIG, ...saved };
  } catch (_) {}

  return { ...DEFAULT_CONFIG };
}

/**
 * Save site config to Supabase (via RPC) + localStorage.
 * Only admins can call this (enforced by RPC).
 */
export async function saveSiteConfig(config: SiteConfig): Promise<{ success: boolean; error?: string }> {
  // Always save to localStorage as backup
  localStorage.setItem("lws_admin_config", JSON.stringify(config));
  localStorage.setItem("gapi_key", config.googleApiKey);
  localStorage.setItem("gdrive_client_id", config.googleClientId);

  try {
    // Try saving via the new RPC function
    const { error } = await (supabase as any).rpc("save_site_config", {
      _config: config,
    });

    if (error) {
      // Fallback: Check if a row exists in admin_settings
      const { data: existingRows } = await (supabase as any)
        .from("admin_settings")
        .select("id")
        .limit(1);

      if (existingRows && existingRows.length > 0) {
        // Update the existing row
        const { error: updateError } = await (supabase as any)
          .from("admin_settings")
          .update({
            config_json: config,
            paid_mode_enabled: config.paidModeEnabled,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRows[0].id);

        if (updateError) {
          console.warn("Could not update settings in Supabase:", updateError.message);
          return { success: true, error: "Saved locally only. Run the migration SQL in Supabase to enable cloud sync." };
        }
      } else {
        // Table is empty, insert a new row
        const { error: insertError } = await (supabase as any)
          .from("admin_settings")
          .insert({
            config_json: config,
            paid_mode_enabled: config.paidModeEnabled,
          });

        if (insertError) {
          console.warn("Could not insert settings in Supabase:", insertError.message);
          return { success: true, error: "Saved locally only. Run the migration SQL in Supabase to enable cloud sync." };
        }
      }
    }

    return { success: true };
  } catch (e: any) {
    console.warn("saveSiteConfig Supabase error:", e.message);
    return { success: true, error: "Saved locally. Supabase sync pending migration." };
  }
}
