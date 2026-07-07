import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Crown, Upload, CheckCircle, Phone, Copy, X, Loader2 } from "lucide-react";
import { fetchSiteConfig, type SiteConfig, DEFAULT_CONFIG } from "@/lib/siteConfig";

// Default plans as fallback
const DEFAULT_PLANS = [
  { key: "weekly", label: "Weekly", price: 299, days: 7, popular: false },
  { key: "monthly", label: "Monthly", price: 799, days: 30, popular: true },
  { key: "yearly", label: "Yearly", price: 4999, days: 365, popular: false },
];



type Props = {
  userEmail: string;
  userId: string;
  onClose: () => void;
};

export default function UpgradeModal({ userEmail, userId, onClose }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [step, setStep] = useState<"plan" | "payment" | "upload" | "done">("plan");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    fetchSiteConfig().then(cfg => setSiteConfig(cfg)).catch(() => {});
  }, []);

  const [couponCode, setCouponCode] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast({ title: "Please enter a coupon code.", variant: "destructive" });
      return;
    }
    setApplyingCoupon(true);
    try {
      const { data, error } = await (supabase as any).rpc("apply_coupon", {
        _code: couponCode.trim()
      });

      if (error) throw error;

      if (data && data.success) {
        toast({ title: "Coupon Applied! 🎉", description: data.message });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast({ title: "Failed", description: data?.message || "Invalid coupon code.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setApplyingCoupon(false);
    }
  };

  const paymentInfo = {
    number: siteConfig.paymentNumber || DEFAULT_CONFIG.paymentNumber,
    name: siteConfig.paymentName || DEFAULT_CONFIG.paymentName,
    methods: (siteConfig.paymentMethods || DEFAULT_CONFIG.paymentMethods).split(",").map((s: string) => s.trim()),
  };

  const PLANS = [
    { key: "weekly", label: "Weekly", price: siteConfig.weeklyPrice || 299, days: 7, popular: false },
    { key: "monthly", label: "Monthly", price: siteConfig.monthlyPrice || 799, days: 30, popular: true },
    { key: "yearly", label: "Yearly", price: siteConfig.yearlyPrice || 4999, days: 365, popular: false },
  ];

  const plan = PLANS.find(p => p.key === selectedPlan)!;

  const copyNumber = () => {
    navigator.clipboard.writeText(paymentInfo.number);
    toast({ title: "✅ Number Copied!" });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!file) { toast({ title: "Please upload your payment receipt.", variant: "destructive" }); return; }
    setSubmitting(true);

    try {
      // Get fresh user ID to avoid stale state issues
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to submit a request.");

      // Upload receipt to Supabase Storage
      const ext = file.name.split(".").pop();
      const path = `receipts/${user.id}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-receipts")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("payment-receipts")
        .getPublicUrl(path);
      
      const publicUrl = data?.publicUrl;

      if (!publicUrl) throw new Error("Failed to generate public URL for receipt");

      // Save payment request with fresh user ID
      const { error: insertError } = await (supabase as any).from("payment_requests").insert({
        user_id: user.id,
        user_email: user.email,
        plan_key: plan.key,
        plan_label: plan.label,
        amount_pkr: plan.price,
        screenshot_url: publicUrl,
        status: "pending",
      });

      if (insertError) throw insertError;

      setStep("done");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/20 to-yellow-500/10 p-4 sm:p-6 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Crown className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Upgrade to Pro</h2>
                <p className="text-xs text-muted-foreground">{siteConfig.siteName || "NitroDrive"} Premium Access</p>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* STEP 1: Plan Selection */}
          {step === "plan" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select a plan to continue:</p>
              <div className="space-y-2">
                {PLANS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setSelectedPlan(p.key)}
                    className={`w-full flex flex-col xs:flex-row xs:items-center justify-between p-3 sm:p-4 rounded-xl border gap-2 transition-all ${selectedPlan === p.key ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selectedPlan === p.key ? "border-primary" : "border-border"}`}>
                        {selectedPlan === p.key && <div className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm sm:text-base">{p.label}</span>
                          {p.popular && <Badge className="text-[9px] bg-yellow-500 text-black px-1.5 py-0.5 leading-none">Most Popular</Badge>}
                        </div>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">{p.days} days access</span>
                      </div>
                    </div>
                    <span className="font-bold text-primary text-base sm:text-lg self-end xs:self-center">PKR {p.price.toLocaleString()}</span>
                  </button>
                ))}
              </div>
              <Button onClick={() => setStep("payment")} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                Continue →
              </Button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink mx-4 text-muted-foreground text-xs uppercase tracking-wider">Or</span>
                <div className="flex-grow border-t border-border"></div>
              </div>

              <div className="space-y-2 p-3 sm:p-4 rounded-xl border border-border bg-muted/20">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Have a Coupon Code?</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="e.g. TRIAL7"
                    className="flex-1 bg-background border border-input rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary uppercase min-w-0"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleApplyCoupon} 
                    disabled={applyingCoupon}
                    className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 shrink-0"
                  >
                    {applyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Payment Details */}
          {step === "payment" && (
            <div className="space-y-4">
              <div className="text-center p-1">
                <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 px-3 py-1">
                  <Crown className="h-3 w-3 mr-1" /> {plan.label} — PKR {plan.price.toLocaleString()}
                </Badge>
              </div>

              <div className="bg-muted/30 rounded-xl p-4 border border-border space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Payment Methods:</p>
                <div className="flex flex-wrap gap-2">
                  {paymentInfo.methods.map(m => (
                    <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                  ))}
                </div>
                <div className="bg-background rounded-lg p-3 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Send payment to:</p>
                  <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-lg sm:text-xl tracking-wider text-primary">{paymentInfo.number}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">👤 {paymentInfo.name}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={copyNumber} className="w-full xs:w-auto shrink-0">
                      <Copy className="h-4 w-4 mr-1" /> Copy
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] sm:text-xs text-yellow-500 font-medium">
                  ⚠️ Send exactly PKR {plan.price.toLocaleString()}. Take a screenshot before closing!
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep("plan")} className="flex-1">← Back</Button>
                <Button onClick={() => setStep("upload")} className="flex-1 bg-primary text-primary-foreground">
                  I've Paid ✓
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Upload Receipt */}
          {step === "upload" && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="font-semibold text-sm sm:text-base">Upload Payment Screenshot</p>
                <p className="text-xs text-muted-foreground mt-1">Upload your JazzCash / Easypaisa / NayaPay receipt screenshot</p>
              </div>

              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-primary/40 rounded-xl p-4 sm:p-6 text-center cursor-pointer hover:border-primary/70 hover:bg-primary/5 transition-all"
              >
                {preview ? (
                  <img src={preview} alt="Receipt" className="max-h-40 sm:max-h-48 mx-auto rounded-lg object-contain" />
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-muted-foreground" />
                    <p className="text-xs sm:text-sm text-muted-foreground">Click to select your payment screenshot</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">JPG, PNG supported</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFileSelect} />

              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                📋 Plan: <b>{plan.label}</b> | Amount: <b>PKR {plan.price.toLocaleString()}</b>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep("payment")} className="flex-1">← Back</Button>
                <Button onClick={handleSubmit} disabled={submitting || !file} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Submit Receipt
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Done */}
          {step === "done" && (
            <div className="text-center space-y-4 py-4">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Payment Submitted! 🎉</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                  Your payment proof has been received. Admin will verify and activate your
                  premium access within <b>24 hours</b>.
                </p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 text-xs text-muted-foreground">
                📧 A confirmation will be sent to <b>{userEmail}</b>
              </div>
              <Button onClick={onClose} className="w-full">Done, Go to Dashboard</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
