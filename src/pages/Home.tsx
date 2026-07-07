import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Calendar,
  Check,
  FolderSync,
  Gauge,
  MessageCircle,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import { WhatsAppModal } from "@/components/WhatsAppModal";
import { CommunityBanner } from "@/components/CommunityBanner";
import heroBg from "@/assets/hero-bg.jpg";
import { fetchSiteConfig, DEFAULT_CONFIG } from "@/lib/siteConfig";
import { supabase } from "@/integrations/supabase/client";
import { SEO, buildOrganizationSchema, buildWebSiteSchema, buildWebPageSchema, buildBreadcrumbSchema } from "@/components/SEO";

const Home = () => {
  const navigate = useNavigate();
  const [channelLink, setChannelLink] = useState(DEFAULT_CONFIG.channelLink);

  useEffect(() => {
    // Only redirect to dashboard if returning from a login callback (url contains hash access_token)
    if (window.location.hash.includes("access_token")) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          navigate("/dashboard");
        }
      });
    }

    fetchSiteConfig().then(cfg => {
      if (cfg.channelLink) setChannelLink(cfg.channelLink);
    }).catch(() => {});
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="NitroDrive | Fast Google Drive Toolkit — Upload, Clone & Manage"
        description="NitroDrive is the fastest Google Drive uploader toolkit. Batch upload files, clone public folders, and manage your Drive with high-speed parallel processing."
        jsonLd={[
          buildOrganizationSchema(),
          buildWebSiteSchema(),
          buildWebPageSchema(
            "NitroDrive | Fast Google Drive Toolkit",
            "NitroDrive is the fastest Google Drive uploader toolkit. Batch upload files, clone public folders, and manage your Drive.",
            "https://nitrodrive.site/"
          ),
          buildBreadcrumbSchema([{ name: "Home", url: "https://nitrodrive.site/" }]),
        ]}
      />
      <CommunityBanner />
      <WhatsAppModal />

      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-3 sm:px-4 py-4">
          <div 
            onDoubleClick={() => navigate("/admin")}
            className="group flex items-center gap-2 sm:gap-3 cursor-default select-none min-w-0"
          >
            <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-hero shadow-glow-primary shrink-0">
              <Zap className="h-5 w-5 text-primary-foreground" />
              <span className="pointer-events-none absolute -inset-1 rounded-xl opacity-0 ring-1 ring-ring/50 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="leading-tight min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-base sm:text-lg font-bold tracking-tight truncate">NitroDrive</span>
                <Badge variant="secondary" className="border border-border/60 text-[9px] sm:text-xs px-1.5 py-0 hidden min-[380px]:inline-flex">
                  Pro-grade
                </Badge>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:block">Ultra fast uploader • clone • manage</p>
            </div>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            <Link to="/auth?mode=login">
              <Button variant="outline" size="sm">
                Login
              </Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button variant="hero" size="sm">
                Get Started
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-1.5 md:hidden">
            <Link to="/auth?mode=login">
              <Button variant="outline" size="sm" className="px-2.5 h-8 text-xs">
                Login
              </Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button variant="hero" size="sm" className="px-2.5 h-8 text-xs">
                Start
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url(${heroBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-accent" />
          <div
            aria-hidden="true"
            className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -right-24 bottom-16 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
          />

          <div className="container mx-auto grid gap-10 px-4 pb-16 pt-14 md:grid-cols-2 md:gap-12 md:pb-24 md:pt-20">
            <div className="relative z-10 flex flex-col justify-center">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>
                  Built for speed — <span className="text-foreground">no limits</span>
                </span>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span className="text-primary">1000× boost</span>
              </div>

              <h1 className="text-balance text-4xl font-extrabold tracking-tight md:text-6xl">
                Upload to Drive at{" "}
                <span className="bg-gradient-hero bg-clip-text text-transparent">ridiculous speed</span>
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground md:text-xl">
                Clone folders, batch upload, and clean duplicates — a pro toolkit that feels instant.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link to="/auth?mode=signup" className="sm:w-auto">
                  <Button variant="hero" size="lg" className="w-full sm:w-auto">
                    Start free
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>

                <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto" asChild>
                  <a href={channelLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-5 w-5" />
                    Join channel
                  </a>
                </Button>
              </div>

              <div className="mt-8 grid max-w-xl grid-cols-3 gap-2 sm:gap-3">
                {[
                  { icon: Users, label: "Users", value: "10K+" },
                  { icon: Upload, label: "Uploads", value: "5M+" },
                  { icon: Gauge, label: "Uptime", value: "99.9%" },
                ].map((s) => (
                  <Card key={s.label} className="border-border/70 bg-card/50 p-2 sm:p-4">
                    <div className="flex flex-col xs:flex-row items-center xs:items-start text-center xs:text-left gap-2 sm:gap-3">
                      <div className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-xl bg-secondary/60 shrink-0">
                        <s.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm sm:text-lg font-bold leading-none">{s.value}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{s.label}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="relative z-10">
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute -inset-3 rounded-3xl bg-primary/10 blur-2xl"
                />

                <Card className="relative overflow-hidden rounded-3xl border-border/70 bg-card/60">
                  <div className="border-b border-border/70 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <p className="text-sm font-semibold">Live Queue</p>
                      </div>
                      <Badge variant="outline" className="border-border/70">
                        1000×
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Batch uploads with smart retries and clean progress.
                    </p>
                  </div>

                  <div className="space-y-3 p-5">
                    {[
                      { name: "Product shots.zip", size: "1.2 GB", speed: "Lightning" },
                      { name: "Client docs.pdf", size: "34 MB", speed: "Fast" },
                      { name: "Footage_4k.mov", size: "6.8 GB", speed: "Stable" },
                    ].map((f) => (
                      <div
                        key={f.name}
                        className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/30 p-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{f.name}</p>
                          <p className="text-xs text-muted-foreground">{f.size}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-secondary/60">
                            {f.speed}
                          </Badge>
                          <Check className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    ))}

                    <div className="rounded-2xl border border-border/70 bg-background/30 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Average speed</p>
                        <p className="text-sm text-primary">~1000×</p>
                      </div>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary/60">
                        <div className="h-full w-[82%] bg-gradient-hero" />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Optimized pipeline for large files + folders.
                      </p>
                    </div>
                  </div>

                  <div
                    aria-hidden="true"
                    className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
                  />
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES (BENTO) */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">A toolbox that feels premium</h2>
            <p className="mt-3 text-muted-foreground">
              Everything you need for pro uploads, without the clutter.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Card className="md:col-span-3 border-border/70 bg-card/50 p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-hero shadow-glow-primary">
                  <Upload className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Batch uploads</h3>
                  <p className="text-sm text-muted-foreground">Queue + parallel processing.</p>
                </div>
              </div>
              <p className="mt-4 text-muted-foreground">
                Upload multiple files together with a clean progress experience.
              </p>
            </Card>

            <Card className="md:col-span-3 border-border/70 bg-card/50 p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-hero shadow-glow-primary">
                  <FolderSync className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Folder cloning</h3>
                  <p className="text-sm text-muted-foreground">Copy public folders fast.</p>
                </div>
              </div>
              <p className="mt-4 text-muted-foreground">
                Pull complete structures including subfolders with minimal setup.
              </p>
            </Card>

            <Card className="md:col-span-2 border-border/70 bg-card/50 p-4 sm:p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary/60">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Secure flow</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Your content stays tied to your Drive permissions.
              </p>
            </Card>

            <Card className="md:col-span-2 border-border/70 bg-card/50 p-4 sm:p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary/60">
                <Trash2 className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Bulk delete</h3>
              <p className="mt-2 text-sm text-muted-foreground">Clean duplicates in one go.</p>
            </Card>

            <Card className="md:col-span-2 border-border/70 bg-card/50 p-4 sm:p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary/60">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Daily updates</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Join the channel for tips + new releases.
              </p>
            </Card>
          </div>
        </section>

        {/* STEPS */}
        <section className="border-y border-border/70 bg-gradient-accent">
          <div className="container mx-auto px-4 py-16 md:py-20">
            <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Get started in 60 seconds</h2>
                <p className="mt-3 text-muted-foreground">
                  Simple flow. No confusion. Works beautifully on mobile too.
                </p>
              </div>
              <Link to="/auth?mode=signup" className="md:self-center">
                <Button variant="hero">Create account</Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  title: "Sign up",
                  desc: "Create your account and enter dashboard.",
                  icon: Users,
                },
                {
                  title: "Connect Drive",
                  desc: "One click to authorize in a new tab.",
                  icon: Shield,
                },
                {
                  title: "Upload / Clone",
                  desc: "Batch upload files or clone folders like a pro.",
                  icon: FolderSync,
                },
              ].map((step, idx) => (
                <Card key={step.title} className="border-border/70 bg-card/50 p-4 sm:p-6">
                  <div className="flex items-start justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary/60">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant="outline" className="border-border/70">
                      0{idx + 1}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
                  <p className="mt-2 text-muted-foreground">{step.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <Card className="relative overflow-hidden border-border/70 bg-card/50">
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-hero opacity-[0.08]" />
            <div className="relative p-5 sm:p-8 md:p-12">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Ready to move faster?</h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Start free, then level up your workflow with the fastest uploader experience.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/auth?mode=signup">
                  <Button variant="hero" size="lg" className="w-full sm:w-auto">
                    Get started free
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
                  <a href={channelLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-5 w-5" />
                    Join WhatsApp channel
                  </a>
                </Button>
              </div>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border/40 bg-muted/10 pt-16 pb-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {/* Brand Section */}
            <div className="md:col-span-2 space-y-5">
              <div 
                onDoubleClick={() => navigate("/admin")}
                className="flex items-center gap-3 cursor-default select-none"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-hero shadow-glow-primary">
                  <Zap className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold tracking-tight">NitroDrive</span>
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                The fastest uploader toolkit for Google Drive. Clone, manage, and batch upload with ridiculous speeds.
              </p>
              <div className="flex items-center gap-3">
                <a href={channelLink} target="_blank" rel="noopener noreferrer" 
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-[#facc15] hover:text-neutral-950 transition-all">
                  <MessageCircle className="h-5 w-5" />
                </a>
                <div className="h-4 w-px bg-border" />
                <p className="text-xs font-medium text-muted-foreground">Join our community</p>
              </div>
            </div>

            {/* Navigation Columns */}
            <div>
              <h4 className="mb-5 font-bold text-sm uppercase tracking-widest text-foreground">Product</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to="/auth?mode=login" className="text-muted-foreground hover:text-primary transition-colors">Dashboard</Link></li>
                <li><button onClick={() => window.scrollTo({top: 0, behavior: "smooth"})} className="text-muted-foreground hover:text-primary transition-colors">Features</button></li>
                <li><Link to="/auth?mode=signup" className="text-muted-foreground hover:text-primary transition-colors text-yellow-500 font-medium">Upgrade Pro 💎</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-5 font-bold text-sm uppercase tracking-widest text-foreground">Legal & Support</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">Terms of Service</a></li>
                <li><a href="mailto:nitrodrive.official@gmail.com" className="text-muted-foreground hover:text-primary transition-colors">Contact Support</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-16 flex flex-col items-center justify-between gap-6 border-t border-border/20 pt-8 md:flex-row">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} <span className="font-semibold">NitroDrive Industries</span>. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">System Operational</span>
              </div>
              <Badge variant="outline" className="text-[10px] opacity-60">v3.4.2</Badge>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
