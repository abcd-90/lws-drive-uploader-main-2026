import { Link } from "react-router-dom";
import { SEO, buildSoftwareAppSchema, buildWebPageSchema, buildBreadcrumbSchema } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Check, 
  X,
  Crown,
  MessageCircle,
  Upload,
  FolderSync,
  Gauge,
  Users,
  Headphones,
  XCircle
} from "lucide-react";

const Pricing = () => {
  const siteConfig = (() => {
    try { return JSON.parse(localStorage.getItem("lws_admin_config") || "{}"); } catch { return {}; }
  })();

  const prices = {
    weekly: siteConfig.weeklyPrice || 299,
    monthly: siteConfig.monthlyPrice || 799,
    yearly: siteConfig.yearlyPrice || 4999,
  };

  const whatsappNumber = siteConfig.paymentNumber || "+923107701416";
  const whatsappLink = (plan: string, amount: string | number) => 
    `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=I%20want%20to%20buy%20${plan}%20(${amount}%20PKR)`;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="NitroDrive Pricing — Weekly, Monthly & Yearly Pro Plans"
        description="Choose a NitroDrive Pro plan for unlimited batch uploads, folder cloning, and priority support. Flexible weekly, monthly, and yearly plans available."
        jsonLd={[
          buildWebPageSchema(
            "NitroDrive Pricing",
            "Choose a NitroDrive Pro plan for unlimited batch uploads, folder cloning, and priority support.",
            "https://nitrodrive.site/pricing"
          ),
          buildBreadcrumbSchema([
            { name: "Home", url: "https://nitrodrive.site/" },
            { name: "Pricing", url: "https://nitrodrive.site/pricing" },
          ]),
          buildSoftwareAppSchema(prices),
        ]}
      />
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-gradient-hero flex items-center justify-center shadow-glow-primary shrink-0">
              <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
            </div>
            <div className="min-w-0 leading-tight">
              <h1 className="text-base sm:text-xl font-bold text-primary truncate">{siteConfig.siteName || "NitroDrive"}</h1>
              <p className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-wide truncate hidden min-[380px]:block">Ultra Fast Uploader</p>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
            <Link to="/" className="hidden sm:inline-block">
              <Button variant="ghost" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3">
                Home
              </Button>
            </Link>
            <Link to="/auth?mode=login">
              <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3">
                Login
              </Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button variant="hero" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3">
                <span className="hidden xs:inline">Get Started</span>
                <span className="xs:hidden">Start</span>
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-32 pb-12 px-4">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-4 bg-gradient-hero text-primary-foreground">
            Pricing
          </Badge>
          <h1 className="text-5xl font-bold mb-4">
            Upgrade to <span className="text-primary">Pro</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get 1000x faster uploads, unlimited transfers, and premium features. No trial available - Pro is worth every rupee!
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <Card className="p-4 sm:p-8 bg-card border-border relative">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Free Plan</h3>
                <p className="text-muted-foreground">Basic features for casual users</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">0</span>
                  <span className="text-muted-foreground">PKR</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  { icon: Check, text: "100x Upload Speed", available: true },
                  { icon: X, text: "Limited Daily Uploads", available: false },
                  { icon: Check, text: "Basic File Clone", available: true },
                  { icon: Check, text: "Standard Processing", available: true },
                  { icon: X, text: "Ads Displayed", available: false },
                  { icon: X, text: "Email Support Only", available: false },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <item.icon className={`h-4 w-4 ${item.available ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={item.available ? '' : 'text-muted-foreground'}>{item.text}</span>
                  </li>
                ))}
              </ul>
              <div className="text-center py-4 bg-secondary rounded-lg">
                <Gauge className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-semibold">Speed: <span className="text-xl">1x</span></p>
                <p className="text-xs text-muted-foreground">(Very Slow)</p>
              </div>
            </Card>

            {/* Pro Weekly */}
            <Card className="p-4 sm:p-8 bg-card border-primary relative">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <h3 className="text-2xl font-bold">Pro Weekly</h3>
                </div>
                <p className="text-muted-foreground">Try Pro for a week</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-primary">{prices.weekly}</span>
                  <span className="text-muted-foreground">PKR / week</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  { icon: Zap, text: "1000x Upload Speed" },
                  { icon: Upload, text: "Unlimited Uploads" },
                  { icon: Check, text: "7 Days Access" },
                  { icon: Check, text: "All Pro Features" },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-primary" />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
              <a href={whatsappLink("Pro Weekly", prices.weekly)} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full border-primary hover:bg-primary hover:text-primary-foreground">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Buy on WhatsApp
                </Button>
              </a>
            </Card>

            {/* Pro Monthly */}
            <Card className="p-4 sm:p-8 bg-gradient-accent border-2 border-primary relative shadow-lg">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-hero text-primary-foreground">
                <Crown className="h-3 w-3 mr-1" />
                Best Value
              </Badge>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <h3 className="text-2xl font-bold">Pro Monthly</h3>
                </div>
                <p className="text-muted-foreground">Full month of premium power</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-primary">{prices.monthly}</span>
                  <span className="text-muted-foreground">PKR / month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  { icon: Zap, text: "1000x Upload Speed" },
                  { icon: Upload, text: "Unlimited Uploads" },
                  { icon: Check, text: "30 Days Access" },
                  { icon: Check, text: "All Pro Features" },
                  { icon: Headphones, text: "Priority Support" },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-primary" />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
              <a href={whatsappLink("Pro Monthly", prices.monthly)} target="_blank" rel="noopener noreferrer">
                <Button variant="hero" className="w-full" size="lg">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Buy on WhatsApp
                </Button>
              </a>

              {/* Speed Comparison */}
              <div className="mt-6 p-4 bg-card rounded-lg border border-border">
                <p className="text-sm font-semibold mb-3 text-center">Upload Speed Comparison</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Free</span>
                    <div className="flex-1 mx-2 h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-muted-foreground w-[10%]" />
                    </div>
                    <span className="text-xs font-semibold">100x</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">⚡ Pro</span>
                    <div className="flex-1 mx-2 h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-hero w-full" />
                    </div>
                    <span className="text-xs font-semibold text-primary">1000x</span>
                  </div>
                </div>
                <p className="text-xs text-center mt-3 text-primary">
                  Upgrade to Pro for 1000x more speed! 🚀
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-gradient-accent border-y border-border">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">What You Get with Pro</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Zap, title: "1000x Upload Speed", description: "Lightning-fast file transfers" },
              { icon: Upload, title: "Unlimited Uploads", description: "No daily or monthly limits" },
              { icon: FolderSync, title: "Bulk Folder Clone", description: "Clone entire folders at once" },
              { icon: Gauge, title: "Priority Processing", description: "Your files are processed first" },
              { icon: XCircle, title: "No Ads", description: "Clean, ad-free experience" },
              { icon: Headphones, title: "Premium Support", description: "24/7 WhatsApp support" },
            ].map((feature, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-hero flex items-center justify-center flex-shrink-0 shadow-glow-primary">
                  <feature.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl font-bold mb-4">Ready to Upgrade?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Contact us on WhatsApp to purchase your Pro subscription
          </p>
          <a 
            href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
          >
            <Button variant="outline" size="lg" className="mb-6 border-primary hover:bg-primary hover:text-primary-foreground">
              <MessageCircle className="mr-2 h-5 w-5" />
              {whatsappNumber}
            </Button>
          </a>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6 w-full max-w-md mx-auto sm:max-w-none">
            <a href={whatsappLink("Pro Monthly", prices.monthly)} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button variant="hero" size="lg" className="w-full">
                Get Pro Monthly - {prices.monthly} PKR
              </Button>
            </a>
            <a href={whatsappLink("Pro Weekly", prices.weekly)} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full border-primary hover:bg-primary hover:text-primary-foreground">
                Get Pro Weekly - {prices.weekly} PKR
              </Button>
            </a>
          </div>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            ⚠️ No free trial available. Pro subscription is manually activated after payment confirmation.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
