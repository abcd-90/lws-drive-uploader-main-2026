import React from "react";
import { Link } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";
import { SEO, buildWebPageSchema, buildBreadcrumbSchema } from "@/components/SEO";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between py-12 px-6 sm:px-12 md:px-24">
      <SEO
        title="Privacy Policy — NitroDrive"
        description="Read the NitroDrive privacy policy. Learn how we handle your data, Google API access, and account security."
        jsonLd={[
          buildWebPageSchema(
            "Privacy Policy",
            "Read the NitroDrive privacy policy. Learn how we handle your data, Google API access, and account security.",
            "https://nitrodrive.site/privacy"
          ),
          buildBreadcrumbSchema([
            { name: "Home", url: "https://nitrodrive.site/" },
            { name: "Privacy Policy", url: "https://nitrodrive.site/privacy" },
          ]),
        ]}
      />
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        {/* Content */}
        <div className="space-y-6 text-muted-foreground leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">1. Introduction</h2>
            <p>
              Welcome to <strong>NitroDrive</strong> ("we", "our", or "us"). We are committed to protecting your privacy and security. This Privacy Policy explains how we collect, use, and safeguard your personal information when you use our website hosted at <span className="text-primary font-mono text-sm">https://nitrodrive.site</span> (the "Service").
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">2. Google API Services & User Data Policy Disclosure</h2>
            <p>
              NitroDrive accesses and uses your Google Account data via Google API Services (specifically Google Drive API scopes) to perform requested actions such as uploading, cloning, and managing files inside your Google Drive account.
            </p>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 my-2 text-sm text-slate-300">
              <strong>Google Limited Use Policy:</strong> NitroDrive's use and transfer to any other app of information received from Google APIs will adhere to the{" "}
              <a 
                href="https://developers.google.com/terms/api-services-user-data-policy" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline hover:text-primary/80"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </div>
            <p>
              We do not copy, store, transfer, or share your Google user data to any external servers, third-party databases, or marketing partners. All file transfers occur securely and directly between Google's servers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">3. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Authentication Details:</strong> We collect your email address and profile name during signup to identify your user account.
              </li>
              <li>
                <strong className="text-foreground">OAuth Tokens:</strong> When you connect your Google Drive, we obtain a temporary Google OAuth access token. This token is stored securely in your browser session or in our database purely to authorize file operations on your behalf, and is never shared.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">4. Sharing Your Information</h2>
            <p>
              We do not sell, trade, or rent your personal information to third parties. We do not use your Google Drive file contents or metadata for marketing or advertising purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">5. Data Deletion</h2>
            <p>
              You can disconnect your Google Drive at any time through the NitroDrive Control Panel dashboard. If you wish to delete your entire NitroDrive account and associated data, please contact us at <span className="text-foreground">sheikhsami3082@gmail.com</span>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">6. Security of Your Data</h2>
            <p>
              We implement a variety of security measures to maintain the safety of your personal information when you log in or initiate Google Drive operations.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-slate-800">
            <p className="text-sm">
              Last Updated: July 5, 2026. For any privacy-related questions, please contact us at <span className="text-foreground">sheikhsami3082@gmail.com</span>.
            </p>
          </section>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto w-full text-center mt-12 pt-6 border-t border-slate-900 text-xs text-muted-foreground">
        &copy; 2026 NitroDrive. All rights reserved.
      </div>
    </div>
  );
};

export default Privacy;
