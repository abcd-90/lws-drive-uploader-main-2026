import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  try {
    // Supabase Jab Database Webhook call karega toh user ka data JSON form mein aayega
    const payload = await req.json()
    console.log("Received webhook:", payload)

    // Webhook payload ki "record" body se hum email lenge
    // Ye tab chalega jab "auth.users" ya koi custom profiles table mein user add hoga
    const record = payload.record || payload
    const userEmail = record.email

    if (!userEmail) {
      throw new Error(`Email not found in payload data`)
    }

    // Email send karne ke liye Resend API ka HTTP request
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        // NOTE: Free tier par sirf wohi email par message jayega jo Resend verify ki hoi. 
        // Jab apna domain verify karlen, toh "from" mein apna email de den jaise "support@lwsdrive.com"
        from: "Nitro Drive <onboarding@resend.dev>",
        to: [userEmail],
        subject: "Welcome to Nitro Drive! ⚡",
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 40px 20px;">
    
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); border: 1px solid #334155;">
        
        <!-- Header -->
        <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 50px 30px; text-align: center; border-bottom: 1px solid #334155;">
                <div style="display: inline-block; padding: 12px 24px; border-radius: 12px; background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.2); margin-bottom: 20px;">
                    <h1 style="color: #eab308; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -1px; text-transform: uppercase;">⚡ NITRO DRIVE</h1>
                </div>
                <p style="color: #94a3b8; font-size: 18px; margin: 0; font-weight: 400;">The Ultimate Google Drive Toolkit</p>
            </td>
        </tr>

        <!-- Body -->
        <tr>
            <td style="padding: 40px 30px; color: #cbd5e1; font-size: 16px; line-height: 1.7;">
                <p style="margin-top: 0; font-size: 18px;">Hi there, 👋</p>
                <p style="color: #f8fafc; font-weight: 600; font-size: 20px; margin-bottom: 24px;">Welcome to the fastest way to manage your cloud storage.</p>
                <p>Your account is ready! <strong>Nitro Drive</strong> is built for speed, allowing you to upload, clone, and manage your Google Drive files with unprecedented efficiency.</p>
                
                <!-- Feature Box -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0; background-color: #0f172a; border-radius: 12px; padding: 25px; border: 1px solid #334155;">
                    <tr>
                        <td>
                            <h3 style="margin: 0 0 15px 0; color: #eab308; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">🚀 Getting Started:</h3>
                            <ul style="margin: 0; padding-left: 20px; color: #94a3b8;">
                                <li style="margin-bottom: 12px;"><strong style="color: #f8fafc;">Instant Upload:</strong> High-speed multi-threaded uploads.</li>
                                <li style="margin-bottom: 12px;"><strong style="color: #f8fafc;">Smart Cloning:</strong> Copy folders across drives instantly.</li>
                                <li style="margin-bottom: 0;"><strong style="color: #f8fafc;">Batch Actions:</strong> Manage thousands of files at once.</li>
                            </ul>
                        </td>
                    </tr>
                </table>

                <!-- Call to Action Button -->
                <div style="text-align: center; margin: 40px 0 20px 0;">
                    <a href="https://nitrodrive.site/dashboard" style="background-color: #eab308; color: #0f172a; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(234, 179, 8, 0.3);">Launch Dashboard</a>
                </div>
                
                <p style="margin: 40px 0 0 0; padding-top: 25px; border-top: 1px solid #334155; color: #64748b; font-size: 14px;">
                    Ready for takeoff?<br>
                    <strong style="color: #f8fafc; font-size: 16px;">The Nitro Drive Team</strong>
                </p>
            </td>
        </tr>
        
        <!-- Footer -->
        <tr>
            <td style="background-color: #0f172a; padding: 30px; text-align: center; border-top: 1px solid #334155;">
                <p style="margin: 0; color: #64748b; font-size: 12px;">&copy; 2026 Nitro Drive. All rights reserved.</p>
                <p style="margin: 8px 0 0 0; color: #475569; font-size: 11px;">You received this because you signed up for Nitro Drive. If this wasn't you, please ignore this email.</p>
            </td>
        </tr>
    </table>
    
</body>
</html>
        `
      })
    })

    const data = await resendRes.json()

    // Successful response waapas Supabase Webhook ko
    return new Response(JSON.stringify({ message: "Email Sent Successfully!", data }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
