// Lovable Cloud Function: drive-config
// Returns Google Drive configuration for the frontend (Client ID + Public API Key)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type DriveConfigResponse = {
  googleClientId: string;
  googleApiKey: string;
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const googleClientId = (Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "").trim();
    const googleApiKey = (Deno.env.get("GOOGLE_PUBLIC_API_KEY") ?? "").trim();

    const body: DriveConfigResponse = {
      googleClientId,
      googleApiKey,
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
