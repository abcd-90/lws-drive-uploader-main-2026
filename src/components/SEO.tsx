import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface SEOProps {
  title: string;
  description: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_URL = "https://nitrodrive.site";
const OG_IMAGE = `${SITE_URL}/og-image.png`;

/**
 * Generates a clean canonical URL.
 * - Forces https://
 * - Forces non-www
 * - Strips trailing slashes
 * - Strips query parameters
 */
const getCanonicalUrl = (pathname: string): string => {
  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  return `${SITE_URL}${cleanPath}`;
};

/**
 * Upserts a <meta> tag in <head>.
 * Creates it if it doesn't exist, updates if it does.
 */
const setMeta = (attr: "name" | "property", key: string, content: string) => {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
};

/**
 * Upserts a <link> tag in <head>.
 */
const setLink = (rel: string, href: string, extra?: Record<string, string>) => {
  const selector = extra
    ? `link[rel="${rel}"][${Object.entries(extra).map(([k, v]) => `${k}="${v}"`).join("][")}]`
    : `link[rel="${rel}"]`;
  let el = document.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    if (extra) Object.entries(extra).forEach(([k, v]) => el!.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
};

/**
 * Manages a single JSON-LD <script> block.
 */
const SEO_JSONLD_ID = "seo-jsonld";

const setJsonLd = (data: Record<string, unknown> | Record<string, unknown>[] | undefined) => {
  let el = document.getElementById(SEO_JSONLD_ID) as HTMLScriptElement | null;
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.id = SEO_JSONLD_ID;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
};

/**
 * SEO Component
 *
 * Dynamically manages document head tags per route:
 * - <title>
 * - <meta name="description">
 * - <meta name="robots">
 * - <link rel="canonical">
 * - <link rel="alternate" hreflang="en">
 * - <link rel="alternate" hreflang="x-default">
 * - Open Graph tags (og:title, og:description, og:url, og:image, og:image:width, og:image:height)
 * - Twitter Card tags (twitter:title, twitter:description, twitter:image)
 * - JSON-LD structured data
 */
export const SEO = ({ title, description, noindex = false, jsonLd }: SEOProps) => {
  const { pathname } = useLocation();
  const canonicalUrl = getCanonicalUrl(pathname);

  useEffect(() => {
    // Title
    document.title = title;

    // Meta description
    setMeta("name", "description", description);

    // Robots
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");

    // Canonical
    setLink("canonical", canonicalUrl);

    // Hreflang (English only + x-default)
    setLink("alternate", canonicalUrl, { hreflang: "en" });
    setLink("alternate", canonicalUrl, { hreflang: "x-default" });

    // Open Graph
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:image", OG_IMAGE);
    setMeta("property", "og:image:width", "1200");
    setMeta("property", "og:image:height", "630");

    // Twitter Card
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", OG_IMAGE);

    // JSON-LD
    setJsonLd(jsonLd);

    // Cleanup JSON-LD on unmount
    return () => {
      const el = document.getElementById(SEO_JSONLD_ID);
      el?.remove();
    };
  }, [title, description, noindex, canonicalUrl, jsonLd]);

  return null;
};

// ────────────────────────────────────────────────
// Pre-built JSON-LD Schema Constructors
// ────────────────────────────────────────────────

export const buildOrganizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "NitroDrive",
  url: SITE_URL,
  logo: OG_IMAGE,
});

export const buildWebSiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "NitroDrive",
  url: SITE_URL,
});

export const buildWebPageSchema = (name: string, description: string, url: string) => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name,
  description,
  url,
});

export const buildBreadcrumbSchema = (items: { name: string; url: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});

/**
 * Builds SoftwareApplication schema with dynamic pricing from siteConfig.
 * If a price is undefined/null/0, that offer is omitted entirely.
 */
export const buildSoftwareAppSchema = (prices: {
  weekly?: number;
  monthly?: number;
  yearly?: number;
}) => {
  const offers: Record<string, unknown>[] = [];

  if (prices.weekly && prices.weekly > 0) {
    offers.push({
      "@type": "Offer",
      name: "Weekly Plan",
      price: prices.weekly,
      priceCurrency: "PKR",
    });
  }
  if (prices.monthly && prices.monthly > 0) {
    offers.push({
      "@type": "Offer",
      name: "Monthly Plan",
      price: prices.monthly,
      priceCurrency: "PKR",
    });
  }
  if (prices.yearly && prices.yearly > 0) {
    offers.push({
      "@type": "Offer",
      name: "Yearly Plan",
      price: prices.yearly,
      priceCurrency: "PKR",
    });
  }

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "NitroDrive",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    url: SITE_URL,
  };

  if (offers.length > 0) {
    schema.offers = offers;
  }

  return schema;
};

export default SEO;
