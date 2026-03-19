

const STATE = {
  plan: "free",
  latestReport: null,
  productRows: 0,
  progress: null
};

const PRO_PAYMENT_LINK = "REPLACE_WITH_YOUR_STRIPE_PAYMENT_LINK";
const PRO_UNLOCK_STORAGE_KEY = "croProAccessUnlocked";
const FETCH_TIMEOUT_MS = 12000;
const SPEED_TIMEOUT_MS = 12000;
const LINKED_RESOURCE_TIMEOUT_MS = 9000;
const MAX_LINKED_STYLESHEETS = 5;
const MAX_LINKED_SCRIPTS = 5;
const MAX_LINKED_RESOURCE_CHARS = 80000;
const MAX_INLINE_TEXT_CHARS = 60000;
const MAX_DISCOVERY_TEXT_URLS = 120;
const MAX_AUTO_DISCOVERED_CATEGORIES = 5;
const MAX_AUTO_DISCOVERED_PRODUCTS = 8;
const MAX_DISCOVERY_SITEMAPS = 6;
const MAX_DISCOVERY_URLS_FROM_SITEMAP = 400;
const MAX_DISCOVERY_CANDIDATE_PAGES = 14;
const RESOURCE_FETCH_CONCURRENCY = 4;
const ANALYSIS_MAX_RUNTIME_MS = 10 * 60 * 1000;
const PAGE_FETCH_CACHE = new Map();
const TEXT_FETCH_CACHE = new Map();


const FREE_PLAN_USAGE_KEY = "croFreePlanUsageLedger";
const FREE_PLAN_USAGE_COOKIE = "croFreePlanUsageLedger";
const MULTI_PART_TLDS = [
  "co.uk", "org.uk", "gov.uk", "ac.uk",
  "com.au", "net.au", "org.au",
  "co.nz", "com.br", "com.mx",
  "co.jp", "co.kr", "com.tr"
];

const PAGE_TYPES = ["home", "category", "product", "cart"];
const FREE_PLAN_MAX_RECOMMENDATIONS = 10;
const PAGE_LABELS = {
  general: "General",
  home: "Home page",
  category: "Category page",
  product: "Product page",
  cart: "Cart page",
  checkout: "Checkout page",
  thankyou: "Thank you page"
};

const DEFAULT_AD_CONFIG = {
  slots: {
    hero: {
      enabled: true,
      label: "Advertisement",
      note: "Monetization space",
      title: "Promote your CRO service, affiliate offer, or featured partner here.",
      text: "This wide banner is ideal for your best monetization slot: a premium partner, your own service, an affiliate tool, or a lead-generation offer.",
      ctaLabel: "Learn more",
      url: "https://example.com/featured-offer"
    },
    sidebar: {
      enabled: true,
      label: "Advertisement",
      note: "Monetization space",
      title: "This sidebar slot works well for affiliate tools, CRO templates, or your own consultation offer.",
      text: "Keep this one short and focused so it feels native to the audit workflow.",
      ctaLabel: "View offer",
      url: "https://example.com/sidebar-offer"
    },
    inline: {
      enabled: true,
      label: "Advertisement",
      note: "Partner recommendation",
      title: "Offer a related CRO resource right before the recommendations list.",
      text: "Good examples: an audit service, heatmap tool, Shopify app, email platform, or your own premium analysis package.",
      ctaLabel: "Open sponsor",
      url: "https://example.com/recommended-tool"
    },
    footer: {
      enabled: true,
      label: "Advertisement",
      note: "End-of-report promotion",
      title: "Reserve this footer space for a final CTA, affiliate partner, or your own premium offer.",
      text: "This slot stays visible near the end of the experience, which makes it useful for soft-conversion offers after the user has consumed the report.",
      ctaLabel: "Explore",
      url: "https://example.com/premium-offer"
    }
  }
};

let AD_CONFIG = JSON.parse(JSON.stringify(DEFAULT_AD_CONFIG));

const AUTOMATED_CHECKS = {
  general: [
    rule("general-title-present", "A clear page title exists", 3, "basic", ({ doc }) => hasTitle(doc)),
    rule("general-meta-description", "A meta description exists", 2, "basic", ({ doc, context }) => !!doc.querySelector('meta[name="description"]') || !!context?.metaDescription),
    rule("general-contact-links", "Contact or support access is visible", 3, "basic", ({ text }) => hasAny(text, ["contact", "support", "help center", "email us", "call us", "phone"])),
    rule("general-policy-links", "Returns / privacy / shipping policies are visible", 2, "basic", ({ text }) => hasAny(text, ["returns", "refund", "privacy", "shipping policy", "delivery policy"])),
    rule("general-search", "Search is available for users", 2, "basic", ({ doc, text }) => !!doc.querySelector('input[type="search"], [role="search"]') || hasAny(text, ["search"]))
  ],
  home: [
    rule("home-h1", "Home page has a single main heading", 3, "basic", ({ doc }) => doc.querySelectorAll("h1").length >= 1),
    rule("home-cta", "Home page contains a primary CTA", 3, "basic", ({ doc, text }) => hasPrimaryCTA(doc, text)),
    rule("home-value-prop", "Home page states a value proposition", 3, "basic", ({ text }) => hasAny(text, ["why choose", "free shipping", "handcrafted", "since", "best seller", "shop now", "discover", "our story"])),
    rule("home-social-proof", "Home page includes trust / review signals", 2, "basic", ({ text, context }) => hasAny(text, ["reviews", "rated", "trustpilot", "verified", "testimonial", "stars"]) || hasStructuredDataType(context, "AggregateRating", "Review")),
    rule("home-footer-benefits", "Home page/footer mentions shopping benefits", 2, "pro", ({ text }) => hasAny(text, ["free shipping", "easy returns", "money-back", "guarantee"]))
  ],
  category: [
    rule("category-product-grid", "Category page shows product cards", 3, "basic", ({ doc }) => doc.querySelectorAll('img').length >= 4 || doc.querySelectorAll('[class*="product"], [data-product]').length >= 3),
    rule("category-filter", "Category page has filters or sorting", 2, "basic", ({ text, doc }) => hasAny(text, ["filter", "sort", "price", "size", "color"]) || !!doc.querySelector('select')),
    rule("category-price", "Category page shows prices", 3, "basic", ({ text }) => hasCurrency(text)),
    rule("category-breadcrumbs", "Category page shows breadcrumbs", 1, "pro", ({ text, doc }) => hasAny(text, ["home /", "breadcrumb"]) || !!doc.querySelector('nav[aria-label*="breadcrumb" i]'))
  ],
  product: [
    rule("product-title", "Product page has a product title", 3, "basic", ({ doc }) => doc.querySelectorAll("h1").length >= 1),
    rule("product-title-length", "Product title stays concise", 2, "basic", ({ doc }) => {
      const h1 = doc.querySelector("h1");
      return !!h1 && h1.textContent.trim().length <= 65;
    }),
    rule("product-price", "Product price is visible", 3, "basic", ({ text, context }) => hasCurrency(text) || hasStructuredDataType(context, "Offer")),
    rule("product-atc", "Add to cart CTA is visible", 3, "basic", ({ text, doc }) => hasAny(text, ["add to cart", "buy now", "pre-order"]) || !!doc.querySelector('button[name="add"], [data-add-to-cart]')),
    rule("product-gallery", "Product page contains multiple visuals", 2, "basic", ({ doc }) => doc.querySelectorAll("img").length >= 3),
    rule("product-reviews", "Reviews or ratings are visible", 3, "basic", ({ text, context }) => hasAny(text, ["reviews", "rated", "stars", "customer review", "read review"]) || hasStructuredDataType(context, "AggregateRating", "Review")),
    rule("product-benefits", "Benefits or bullets near the title are present", 2, "basic", ({ text }) => hasAny(text, ["benefits", "features", "why you'll love", "why you will love", "key features"])),
    rule("product-shipping", "Shipping / returns info is visible on the page", 2, "basic", ({ text }) => hasAny(text, ["free shipping", "ships", "delivery", "returns", "refund"])),
    rule("product-faq", "Product page includes FAQ content", 2, "pro", ({ text, context }) => hasAny(text, ["faq", "frequently asked questions"]) || hasStructuredDataType(context, "FAQPage", "Question")),
    rule("product-urgency", "Urgency or scarcity cues exist", 1, "pro", ({ text }) => hasAny(text, ["only", "left in stock", "selling fast", "limited edition", "order today"])),
    rule("product-alt-text", "A portion of images have alt text", 1, "pro", ({ doc }) => {
      const imgs = [...doc.querySelectorAll("img")];
      if (!imgs.length) return false;
      const altCount = imgs.filter((img) => (img.getAttribute("alt") || "").trim().length > 3).length;
      return (altCount / imgs.length) >= 0.5;
    })
  ],
  cart: [
    rule("cart-checkout", "Cart includes a visible checkout CTA", 3, "basic", ({ text }) => hasAny(text, ["checkout", "continue to checkout"])),
    rule("cart-quantity", "Cart lets users change quantity", 2, "basic", ({ text, doc }) => hasAny(text, ["quantity"]) || !!doc.querySelector('input[type="number"], select[name*="quantity" i]')),
    rule("cart-remove", "Cart lets users remove an item", 2, "basic", ({ text }) => hasAny(text, ["remove", "delete"])),
    rule("cart-shipping-threshold", "Cart mentions shipping threshold or shipping savings", 3, "basic", ({ text }) => hasAny(text, ["free shipping", "away from free shipping", "you are only", "shipping threshold"])),
    rule("cart-support", "Cart offers quick support/contact access", 2, "basic", ({ text }) => hasAny(text, ["live chat", "contact", "support", "phone", "email"])),
    rule("cart-trust", "Cart displays trust or returns reassurance", 2, "pro", ({ text }) => hasAny(text, ["secure checkout", "money-back", "returns", "guarantee", "shop with confidence"]))
  ],
  checkout: [
    rule("checkout-summary", "Checkout shows an order summary", 3, "basic", ({ text, context }) => hasAny(text, ["order summary", "summary", "subtotal", "total"]) || hasStructuredDataType(context, "Order")),
    rule("checkout-guest", "Checkout allows or mentions guest checkout", 3, "basic", ({ text }) => hasAny(text, ["guest checkout", "continue as guest"])),
    rule("checkout-help", "Checkout gives users support access", 2, "basic", ({ text }) => hasAny(text, ["contact", "support", "help", "live chat", "phone"])),
    rule("checkout-trust", "Checkout contains trust language", 2, "basic", ({ text }) => hasAny(text, ["secure", "encrypted", "confidence", "trusted"])),
    rule("checkout-no-distractions", "Checkout avoids obvious navigational distractions", 1, "pro", ({ doc, text }) => {
      const navLinks = doc.querySelectorAll("header nav a, nav a").length;
      return navLinks <= 8 || hasAny(text, ["checkout"]);
    })
  ],
  thankyou: [
    rule("thankyou-confirmation", "Thank you page confirms the purchase", 3, "basic", ({ text }) => hasAny(text, ["thank you", "order confirmed", "successfully placed"])),
    rule("thankyou-summary", "Thank you page includes order summary or next-step info", 3, "basic", ({ text }) => hasAny(text, ["order summary", "tracking", "delivery", "what happens next"])),
    rule("thankyou-support", "Thank you page offers support access", 2, "basic", ({ text }) => hasAny(text, ["contact", "support", "email", "phone"])),
    rule("thankyou-upsell", "Thank you page contains a post-purchase offer", 1, "pro", ({ text }) => hasAny(text, ["special offer", "add to your order", "complete your order", "coupon"]))
  ]
};



AUTOMATED_CHECKS.general.push(
  rule("general-announcement-bar", "Announcement or promo bar is visible", 2, "pro", ({ doc, text }) => !!doc.querySelector('[class*="announce" i], [class*="promo" i], [class*="top-bar" i]') || hasAny(text, ["free shipping", "today only", "sale ends"])),
  rule("general-logo-home", "Logo links back to the home page", 2, "pro", ({ doc }) => !!doc.querySelector('a[href="/"] img, a[href="/"] svg, a[aria-label*="home" i], a[aria-label*="logo" i]')),
  rule("general-social-links", "Social links are easy to find", 1, "pro", ({ doc }) => !!doc.querySelector('a[href*="instagram"], a[href*="facebook"], a[href*="tiktok"], a[href*="youtube"]')),
  rule("general-newsletter", "Email capture is present", 1, "pro", ({ doc, text }) => !!doc.querySelector('input[type="email"]') || hasAny(text, ["subscribe", "newsletter"]))
);
AUTOMATED_CHECKS.home.push(
  rule("home-category-links", "Home page highlights category or collection links", 2, "pro", ({ doc, text }) => [...doc.querySelectorAll('a[href]')].some((a) => /\/(collections|category|shop)/i.test(a.getAttribute('href') || '')) || hasAny(text, ["shop by category", "collections"])),
  rule("home-usp-icons", "Home page highlights shopping benefits with supporting icons or short bullets", 2, "pro", ({ doc, text }) => doc.querySelectorAll('svg, [class*="icon" i]').length >= 3 && hasAny(text, ["free shipping", "easy returns", "guarantee"])),
  rule("home-newsletter", "Home page offers newsletter capture", 1, "pro", ({ doc }) => !!doc.querySelector('input[type="email"]'))
);
AUTOMATED_CHECKS.category.push(
  rule("category-result-count", "Category page communicates product or result count", 2, "pro", ({ text }) => /\d+\s+(products|items|results)/i.test(text)),
  rule("category-quick-add", "Category page offers quick add or quick view actions", 1, "pro", ({ text }) => hasAny(text, ["quick add", "quick view", "add to cart"])),
  rule("category-sale-badge", "Category page surfaces promotions or sale badges", 1, "pro", ({ doc, text }) => !!doc.querySelector('[class*="sale" i], [class*="badge" i]') || hasAny(text, ["sale", "% off", "save "]))
);
AUTOMATED_CHECKS.product.push(
  rule("product-variants", "Product page shows size, color, or variant selectors", 2, "pro", ({ doc, text }) => !!doc.querySelector('select, input[type="radio"], [class*="variant" i], [class*="swatch" i]') || hasAny(text, ["size", "color", "variant"])),
  rule("product-description", "Product page contains a meaningful description section", 2, "pro", ({ doc, text }) => (doc.querySelector('[class*="description" i], #description, .rte')?.textContent || text).length > 220),
  rule("product-related-products", "Product page suggests related or recommended products", 1, "pro", ({ text }) => hasAny(text, ["you may also like", "related products", "frequently bought together"])),
  rule("product-discount", "Product page communicates sale or compare-at pricing when relevant", 1, "pro", ({ text, doc }) => hasAny(text, ["save", "% off", "sale"]) || !!doc.querySelector('[class*="compare" i], s, del')),
  rule("product-size-guide", "Product page offers a size guide or fit help when relevant", 1, "pro", ({ text }) => hasAny(text, ["size guide", "fit guide", "sizing"]))
);
AUTOMATED_CHECKS.cart.push(
  rule("cart-payment-icons", "Cart shows payment or trust badges", 1, "pro", ({ doc, text }) => !!doc.querySelector('img[alt*="visa" i], img[alt*="mastercard" i]') || hasAny(text, ["visa", "mastercard", "paypal"])),
  rule("cart-continue-shopping", "Cart offers a continue shopping path", 1, "pro", ({ text }) => hasAny(text, ["continue shopping", "keep browsing"])),
  rule("cart-discounts", "Cart makes discount or coupon entry easy to find", 1, "pro", ({ text }) => hasAny(text, ["coupon", "discount code", "promo code"]))
);


function isRealAdUrl(url) {
  return typeof url === "string"
    && /^https?:\/\//i.test(url)
    && !/example\.com/i.test(url)
    && !url.includes("your-domain")
    && url.trim() !== "#";
}

async function loadAdsConfig() {
  try {
    const response = await fetch(`ads-config.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = await response.json();
    if (parsed && parsed.slots && typeof parsed.slots === "object") {
      AD_CONFIG = { slots: { ...DEFAULT_AD_CONFIG.slots, ...parsed.slots } };
    }
  } catch (error) {
    console.warn("Using default ad config because ads-config.json could not be loaded.", error);
    AD_CONFIG = JSON.parse(JSON.stringify(DEFAULT_AD_CONFIG));
  }
}

function setAdText(slot, selector, value) {
  const element = slot.querySelector(selector);
  if (!element) return;
  element.textContent = typeof value === "string" ? value : "";
}

function initAdSlots() {
  document.querySelectorAll("[data-ad-slot]").forEach((slot) => {
    const slotName = slot.dataset.adSlot;
    const config = AD_CONFIG?.slots?.[slotName] || DEFAULT_AD_CONFIG.slots[slotName];
    if (!config) return;

    const isEnabled = config.enabled !== false;
    slot.closest('[aria-label]')?.classList.toggle('hidden', !isEnabled);
    slot.classList.toggle('hidden', !isEnabled);
    if (!isEnabled) return;

    setAdText(slot, '[data-ad-part="label"]', config.label || 'Advertisement');
    setAdText(slot, '[data-ad-part="note"]', config.note || 'Sponsored');
    setAdText(slot, '[data-ad-part="title"]', config.title || 'Featured offer');
    setAdText(slot, '[data-ad-part="text"]', config.text || '');

    const hasRealUrl = isRealAdUrl(config.url);

    slot.querySelectorAll('[data-ad-part="cta"]').forEach((link) => {
      link.setAttribute('href', hasRealUrl ? config.url : '#');
      link.setAttribute('rel', 'noopener noreferrer sponsored nofollow');
      link.setAttribute('target', '_blank');
      link.textContent = config.ctaLabel || 'Learn more';

      const disabledHandler = (event) => {
        event.preventDefault();
        alert(`This ad button is not active yet. Replace the placeholder URL for the "${slotName}" ad slot in ads-config.json.`);
      };

      if (!hasRealUrl) {
        link.classList.add('is-disabled');
        link.setAttribute('aria-disabled', 'true');
        link.setAttribute('title', 'Add your real ad URL in ads-config.json to activate this button.');
        if (!link.dataset.adDisabledBound) {
          link.addEventListener('click', disabledHandler);
          link.dataset.adDisabledBound = 'true';
        }
      } else {
        link.classList.remove('is-disabled');
        link.removeAttribute('aria-disabled');
        link.removeAttribute('title');
      }
    });
  });
}

function ensureDynamicUrlLists() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  if (!document.getElementById("productUrlList")) {
    const productHeader = [...sidebar.querySelectorAll(".product-header h3")]
      .find((el) => el.textContent.trim().toLowerCase() === "product urls")
      ?.closest(".product-header");

    if (productHeader) {
      const list = document.createElement("div");
      list.id = "productUrlList";
      list.className = "product-url-list";
      productHeader.insertAdjacentElement("afterend", list);
    }
  }

  if (!document.getElementById("categoryUrlList")) {
    const categoryHeader = [...sidebar.querySelectorAll(".product-header h3")]
      .find((el) => el.textContent.trim().toLowerCase().includes("category"))
      ?.closest(".product-header");

    if (categoryHeader) {
      const list = document.createElement("div");
      list.id = "categoryUrlList";
      list.className = "product-url-list";
      categoryHeader.insertAdjacentElement("afterend", list);
    }
  }
}

function ensureInitialUrlInputs() {
  ensureDynamicUrlLists();

  if (document.getElementById("productUrlList") && getProductInputs().length === 0) {
    addProductRow();
  }

  if (STATE.plan === "pro" && document.getElementById("productUrlList") && getProductInputs().length < 2) {
    addProductRow();
  }

  if (document.getElementById("categoryUrlList") && getCategoryInputs().length === 0) {
    addCategoryRow();
  }
}


document.addEventListener("DOMContentLoaded", async () => {
  bindUI();
  await loadAdsConfig();
  initAdSlots();
  setPlan("free");
  ensureInitialUrlInputs();
  renderSavedReports();
  renderTrendChart();
});

function bindUI() {
  ensureDynamicUrlLists();
  document.querySelectorAll(".plan-button").forEach((button) => {
    button.addEventListener("click", () => {
      const selectedPlan = button.dataset.plan;
      if (selectedPlan === "pro" && !isProUnlocked()) {
        startProPayment();
        return;
      }
      setPlan(selectedPlan);
      document.querySelector(".workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("projectName")?.focus();
    });
  });

  document.getElementById("addCategoryUrl")?.addEventListener("click", addCategoryRow);
  document.getElementById("addProductUrl")?.addEventListener("click", addProductRow);
  document.getElementById("analyzeButton")?.addEventListener("click", runAnalysis);
  document.getElementById("exportButton")?.addEventListener("click", exportLatestReport);
  document.getElementById("exportPdfButton")?.addEventListener("click", exportLatestReportPdf);
  document.getElementById("discoverButton")?.addEventListener("click", discoverUrlsOnly);
}

function setPlan(plan) {
  STATE.plan = plan;
  document.getElementById("freePlanCard")?.classList.toggle("featured", plan === "free");
  document.getElementById("proPlanCard")?.classList.toggle("featured", plan === "pro");
  enforceProductLimit();
  enforceCategoryLimit();
  renderProPaymentState();
  ensureInitialUrlInputs();
}


function isProUnlocked() {
  try {
    return localStorage.getItem(PRO_UNLOCK_STORAGE_KEY) === "true";
  } catch (error) {
    return false;
  }
}

function unlockPro() {
  try {
    localStorage.setItem(PRO_UNLOCK_STORAGE_KEY, "true");
  } catch (error) {}
}

function handlePaymentReturn() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success" && params.get("plan") === "pro") {
      unlockPro();
      const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash || ""}`;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  } catch (error) {}
}

function renderProPaymentState() {
  const proButton = document.querySelector('.plan-button[data-plan="pro"]');
  if (proButton) {
    proButton.textContent = isProUnlocked() ? "Use Pro" : "Unlock Pro";
  }
}


function startProPayment() {
  if (isProUnlocked()) {
    setPlan("pro");
    return;
  }

  STATE.plan = "free";
  document.getElementById("freePlanCard")?.classList.add("featured");
  document.getElementById("proPlanCard")?.classList.remove("featured");
  renderProPaymentState();

  if (!PRO_PAYMENT_LINK || PRO_PAYMENT_LINK.includes("REPLACE_WITH_YOUR_STRIPE_PAYMENT_LINK")) {
    alert("Add your real Stripe payment link in app.js before using the Pro payment flow. Until payment is completed, only the Free version stays available.");
    return;
  }

  const paymentWindow = window.open(PRO_PAYMENT_LINK, "_blank", "noopener,noreferrer,width=980,height=820");
  if (!paymentWindow) {
    window.location.href = PRO_PAYMENT_LINK;
  }
}

function addCategoryRow(value = "") {
  const list = document.getElementById("categoryUrlList");
  if (!list) return;
  const row = document.createElement("div");
  row.className = "product-url-row";
  row.innerHTML = `
    <input type="url" class="category-url-input" placeholder="https://example.com/collections/all" value="${escapeHtml(value)}" />
    <button type="button" class="secondary-button remove-category-button">Remove</button>
  `;
  row.querySelector(".remove-category-button").addEventListener("click", () => {
    row.remove();
    enforceCategoryLimit();
  });
  list.appendChild(row);
  enforceCategoryLimit();
}

function getCategoryInputs() {
  return [...document.querySelectorAll(".category-url-input")];
}

function enforceCategoryLimit() {
  const addButton = document.getElementById("addCategoryUrl");
  if (!addButton) return;
  addButton.disabled = false;
}

function addProductRow(value = "") {
  ensureDynamicUrlLists();
  const list = document.getElementById("productUrlList");
  if (!list) return;
  const row = document.createElement("div");
  row.className = "product-url-row";
  row.innerHTML = `
    <input type="url" class="product-url-input" placeholder="https://example.com/products/your-product" value="${escapeHtml(value)}" />
    <button type="button" class="secondary-button remove-product-button">Remove</button>
  `;
  row.querySelector(".remove-product-button").addEventListener("click", () => {
    row.remove();
    enforceProductLimit();
  });
  list.appendChild(row);
  enforceProductLimit();
  enforceCategoryLimit();
}

function enforceProductLimit() {
  const addButton = document.getElementById("addProductUrl");
  if (!addButton) return;
  addButton.disabled = false;
}

function getProductInputs() {
  return [...document.querySelectorAll(".product-url-input")];
}

function waitForNextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function formatDuration(ms) {
  const safe = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.ceil(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${hours}h ${String(remMinutes).padStart(2, "0")}m`;
  }
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

function buildProgressStatusText(baseStatus) {
  const meta = STATE.progress;
  const status = String(baseStatus || "").trim();
  if (!meta?.startedAt || meta?.done || meta?.failed) return status;

  const elapsed = Date.now() - meta.startedAt;
  const currentUnits = Math.max(0, Number(meta.currentUnits) || 0);
  const totalUnits = Math.max(1, Number(meta.totalUnits) || 1);
  const remainingByCap = Math.max(0, (meta.maxRuntimeMs || ANALYSIS_MAX_RUNTIME_MS) - elapsed);
  let etaText = "Calculating...";

  if (currentUnits >= 0.5 && elapsed >= 3000) {
    const unitsPerMs = currentUnits / elapsed;
    if (unitsPerMs > 0) {
      const predicted = ((totalUnits - currentUnits) / unitsPerMs);
      const bounded = Math.max(0, Math.min(predicted, remainingByCap || predicted));
      etaText = formatDuration(bounded);
    }
  }

  const elapsedText = formatDuration(elapsed);
  const parts = [status];
  if (meta.phaseLabel) parts.push(`Phase: ${meta.phaseLabel}`);
  parts.push(`Elapsed: ${elapsedText}`);
  parts.push(`Estimated time left: ${etaText}`);
  parts.push(`Max runtime: ${formatDuration(meta.maxRuntimeMs || ANALYSIS_MAX_RUNTIME_MS)}`);
  return parts.filter(Boolean).join(" • ");
}

function updateProgressTimerDisplay() {
  const statusNode = document.getElementById("progressStatus");
  if (!statusNode) return;
  const meta = STATE.progress;
  if (!meta?.baseStatus || meta.done || meta.failed) return;
  statusNode.textContent = buildProgressStatusText(meta.baseStatus);
}

function setProgressPhase(phaseLabel) {
  if (!STATE.progress) return;
  STATE.progress.phaseLabel = phaseLabel || "";
  updateProgressTimerDisplay();
}

function checkAnalysisDeadline(startedAt, maxRuntimeMs = ANALYSIS_MAX_RUNTIME_MS) {
  if ((Date.now() - startedAt) > maxRuntimeMs) {
    throw new Error(`Analysis exceeded the maximum runtime of ${formatDuration(maxRuntimeMs)}.`);
  }
}

async function runAnalysis() {
  const analyzeButton = document.getElementById("analyzeButton");
  const discoverButton = document.getElementById("discoverButton");
  const plan = STATE.plan;
  setPlan(plan);

  if (plan === "pro" && !isProUnlocked()) {
    alert("Please complete the Pro payment first. Until payment is completed, only the Free version is available.");
    return;
  }

  const projectName = document.getElementById("projectName").value.trim() || "Untitled CRO audit";
  let configuredPages = buildPageTargets();
  const notes = document.getElementById("manualNotes").value.trim();
  const competitorUrl = document.getElementById("competitorUrl")?.value.trim() || "";
  const homeSeedUrl = document.getElementById("homeUrl")?.value.trim() || configuredPages.find((page) => page.type === "home")?.url || "";
  const shouldRunDiscovery = !!homeSeedUrl;
  const estimatedDiscoveryUnits = shouldRunDiscovery ? 12 : 0;
  const estimatedPageUnits = Math.max(configuredPages.length, 1) * 3.2;
  const estimatedPostUnits = 4 + (competitorUrl ? 2 : 0);
  const estimatedTotalUnits = Math.max(estimatedDiscoveryUnits + estimatedPageUnits + estimatedPostUnits, 8);
  const startedAt = Date.now();

  const freePlanGuard = validateFreePlanScope(plan, configuredPages);
  if (!freePlanGuard.allowed) {
    alert(freePlanGuard.message);
    return;
  }

  analyzeButton.disabled = true;
  if (discoverButton) discoverButton.disabled = true;
  startProgress(estimatedTotalUnits, { maxRuntimeMs: ANALYSIS_MAX_RUNTIME_MS });
  setProgressPhase(shouldRunDiscovery ? "Discovery" : "Analysis");
  updateProgress(0.3, estimatedTotalUnits, shouldRunDiscovery
    ? "Starting URL discovery and preparing the CRO analysis..."
    : "Preparing your audit and checking the provided URLs...");
  await waitForNextPaint();

  try {
    if (shouldRunDiscovery) {
      renderDiscoveredUrls({
        categories: STATE.discovered?.categories || [],
        products: STATE.discovered?.products || [],
        status: "Starting URL discovery...",
        notes: ["The app is discovering URLs first, then it will continue automatically into the CRO analysis."]
      });
      const discoveryBase = 0.6;
      const discoverySpan = estimatedDiscoveryUnits;
      const discovered = await discoverUrlsAdvanced(homeSeedUrl, (payload) => {
        const info = typeof payload === "string" ? { message: payload } : (payload || {});
        const step = Number(info.step) || 0;
        const totalSteps = Math.max(Number(info.totalSteps) || 1, 1);
        const message = info.message || "Discovering URLs...";
        setProgressPhase("Discovery");
        updateProgress(discoveryBase + ((step / totalSteps) * discoverySpan), estimatedTotalUnits, message);
        if (info.notes || info.preview) {
          renderDiscoveredUrls({
            categories: info.preview?.categories || STATE.discovered?.categories || [],
            products: info.preview?.products || STATE.discovered?.products || [],
            status: message,
            notes: info.notes || ["The app is still scanning the store structure."]
          });
        }
      });
      checkAnalysisDeadline(startedAt);
      STATE.discovered = discovered;
      renderDiscoveredUrls(discovered);
      autoFillDiscoveredUrls(discovered, plan);
      configuredPages = buildPageTargets();
      updateProgress(discoveryBase + discoverySpan, estimatedTotalUnits, "URL discovery finished. Preparing the full CRO analysis...");
      await waitForNextPaint();
    }

    const relevantChecklist = window.CRO_CHECKLIST.filter((item) => plan === "pro" || item.tier === "basic");
    const pageResults = [];
    const recommendations = [];
    let totalChecks = 0;
    let totalPassedWeight = 0;
    let totalAvailableWeight = 0;
    let criticalIssues = 0;
    let stackSummary = null;
    let homePageSpeed = null;
    let competitorReport = null;
    let progressUnits = shouldRunDiscovery ? estimatedDiscoveryUnits + 1 : 1;
    const analysisTotalUnits = Math.max(estimatedTotalUnits, progressUnits + (Math.max(configuredPages.length, 1) * 3.2) + estimatedPostUnits);

    if (!configuredPages.length) {
      setProgressPhase("Analysis");
      updateProgress(progressUnits, analysisTotalUnits, "No page URLs were provided. Building a manual CRO review report...");
      await wait(350);
      progressUnits += 0.5;
    }

    for (let index = 0; index < configuredPages.length; index += 1) {
      checkAnalysisDeadline(startedAt);
      const target = configuredPages[index];
      setProgressPhase(`Analysis • ${target.label}`);
      updateProgress(progressUnits, analysisTotalUnits, `Fetching ${target.label}...`);
      const fetchResult = await fetchPageHtml(target.url);
      fetchResult.url = target.url;

      progressUnits += 1.1;
      updateProgress(progressUnits, analysisTotalUnits, `Scoring ${target.label}...`);
      const pageAnalysis = await analyzePage(target.type, fetchResult, plan);

      pageResults.push({
        ...target,
        ...pageAnalysis
      });

      if (target.type === "home" && pageAnalysis.stack) {
        stackSummary = pageAnalysis.stack;
        progressUnits += 0.45;
        updateProgress(progressUnits, analysisTotalUnits, "Checking homepage performance signals...");
        homePageSpeed = await fetchPageSpeedScore(target.url);
      }

      totalChecks += pageAnalysis.appliedChecks.length;
      totalPassedWeight += pageAnalysis.scoreWeight;
      totalAvailableWeight += pageAnalysis.totalWeight;
      criticalIssues += pageAnalysis.criticalIssues;

      pageAnalysis.recommendations.forEach((rec) => {
        recommendations.push({
          ...rec,
          url: rec.url || target.url,
          page: rec.page || target.type,
          pageLabel: rec.pageLabel || PAGE_LABELS[rec.page || target.type] || target.label
        });
      });

      progressUnits += 1.35;
      updateProgress(progressUnits, analysisTotalUnits, `${target.label} analyzed.`);
      await wait(120);
    }

    checkAnalysisDeadline(startedAt);
    setProgressPhase("Recommendations");
    progressUnits += 0.6;
    updateProgress(progressUnits, analysisTotalUnits, "Compiling CRO recommendations...");
    const manualChecklist = relevantChecklist.filter((item) => {
      if (item.page === "general") return true;
      if (item.page === "product") return configuredPages.some((p) => p.type === "product");
      return configuredPages.some((p) => p.type === item.page);
    });

    recommendations.push(...buildManualRecommendations(manualChecklist, pageResults, plan));

    const cleanedRecommendations = dedupeRecommendations(recommendations);
    cleanedRecommendations.sort((a, b) => {
      const impactDelta = impactRank(b.impactLabel) - impactRank(a.impactLabel);
      if (impactDelta !== 0) return impactDelta;
      return (b.priority || 0) - (a.priority || 0);
    });
    const recommendationLimit = plan === "pro" ? 20 : FREE_PLAN_MAX_RECOMMENDATIONS;
    const topRecommendations = cleanedRecommendations.slice(0, recommendationLimit);

    if (competitorUrl) {
      checkAnalysisDeadline(startedAt);
      setProgressPhase("Competitor benchmark");
      progressUnits += 0.8;
      updateProgress(progressUnits, analysisTotalUnits, "Benchmarking competitor signals...");
      competitorReport = await analyzeCompetitor(competitorUrl, plan);
      progressUnits += 1.2;
    }

    if (plan === "free") {
      persistFreePlanScope(configuredPages);
    }

    const overallScore = totalAvailableWeight ? Math.round((totalPassedWeight / totalAvailableWeight) * 100) : 0;
    const report = {
      id: `report-${Date.now()}`,
      createdAt: new Date().toISOString(),
      projectName,
      plan,
      notes,
      overallScore,
      checksUsed: totalChecks,
      pagesAnalyzed: configuredPages.length,
      criticalIssues,
      pageResults,
      recommendations: topRecommendations,
      manualChecklistCount: manualChecklist.length,
      recommendationLimit,
      stackSummary,
      homePageSpeed,
      competitorReport,
      discovered: STATE.discovered,
      revenueOpportunity: estimateRevenueOpportunity(overallScore, criticalIssues, configuredPages.length),
      inspectionSummary: buildInspectionSummary(pageResults)
    };

    setProgressPhase("Finalizing report");
    progressUnits = Math.min(analysisTotalUnits - 0.25, progressUnits + 0.8);
    updateProgress(progressUnits, analysisTotalUnits, "Finalizing the CRO report and saving it locally...");

    hydrateReportLinks(report);
    STATE.latestReport = report;
    saveReport(report);
    renderReport(report);
    renderSavedReports();
    completeProgress(`Analysis complete. ${report.pagesAnalyzed} page${report.pagesAnalyzed === 1 ? "" : "s"} processed.`);
  } catch (error) {
    const timeoutHit = String(error?.message || "").includes("maximum runtime") || String(error?.message || "").includes("exceeded the maximum runtime");
    failProgress(timeoutHit
      ? `The analysis reached the ${formatDuration(ANALYSIS_MAX_RUNTIME_MS)} time limit before finishing. Try fewer pages or rerun the audit.`
      : "The analysis stopped unexpectedly. Please try again.");
    console.error(error);
  } finally {
    analyzeButton.disabled = false;
    if (discoverButton) discoverButton.disabled = false;
  }
}




function revealAnalysisProgress() {
  const panel = document.getElementById("analysisProgress");
  if (!panel) return;

  const sidebar = document.querySelector(".sidebar.scroll-area");
  if (sidebar) {
    const panelTop = panel.offsetTop - 12;
    sidebar.scrollTo({
      top: Math.max(0, panelTop),
      behavior: "smooth"
    });
    return;
  }

  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function startProgress(totalSteps, options = {}) {
  const panel = document.getElementById("analysisProgress");
  panel.classList.remove("hidden");
  STATE.progress = {
    startedAt: Date.now(),
    totalUnits: Math.max(Number(totalSteps) || 1, 1),
    currentUnits: 0,
    baseStatus: "The app is getting your audit ready.",
    phaseLabel: "Preparing",
    maxRuntimeMs: options.maxRuntimeMs || ANALYSIS_MAX_RUNTIME_MS,
    timerId: null,
    done: false,
    failed: false
  };
  setProgressValue(3, "Preparing analysis...", "The app is getting your audit ready.");
  panel.dataset.totalSteps = String(Math.max(totalSteps, 1));
  if (STATE.progress.timerId) clearInterval(STATE.progress.timerId);
  STATE.progress.timerId = setInterval(updateProgressTimerDisplay, 1000);
  revealAnalysisProgress();
}

function updateProgress(completedSteps, totalSteps, statusText) {
  const safeTotal = Math.max(totalSteps, 1);
  const ratio = Math.max(0.08, Math.min(completedSteps / safeTotal, 0.94));
  if (STATE.progress) {
    STATE.progress.totalUnits = safeTotal;
    STATE.progress.currentUnits = Math.max(0, completedSteps);
    STATE.progress.baseStatus = statusText;
  }
  setProgressValue(Math.round(ratio * 100), "Running analysis...", statusText);
}

function completeProgress(statusText) {
  if (STATE.progress?.timerId) clearInterval(STATE.progress.timerId);
  if (STATE.progress) {
    STATE.progress.done = true;
    STATE.progress.currentUnits = STATE.progress.totalUnits;
    STATE.progress.baseStatus = statusText;
  }
  setProgressValue(100, "Analysis complete", statusText);
  revealAnalysisProgress();
}

function failProgress(statusText) {
  const title = document.getElementById("progressTitle");
  title.textContent = "Analysis failed";
  title.classList.add("progress-error");
  if (STATE.progress?.timerId) clearInterval(STATE.progress.timerId);
  if (STATE.progress) {
    STATE.progress.failed = true;
    STATE.progress.baseStatus = statusText;
  }
  setProgressValue(100, "Analysis failed", statusText);
  revealAnalysisProgress();
}

function setProgressValue(percent, titleText, statusText) {
  const clamped = Math.max(0, Math.min(100, percent));
  const fill = document.getElementById("progressFill");
  const percentLabel = document.getElementById("progressPercent");
  const title = document.getElementById("progressTitle");
  const status = document.getElementById("progressStatus");
  const track = document.querySelector(".progress-track");

  title.textContent = titleText;
  title.classList.remove("progress-error");
  percentLabel.textContent = `${clamped}%`;
  status.textContent = buildProgressStatusText(statusText);
  fill.style.width = `${clamped}%`;
  track.setAttribute("aria-valuenow", String(clamped));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPageTargets() {
  const targets = [];
  const homeValue = document.getElementById("homeUrl")?.value.trim() || "";
  const cartValue = document.getElementById("cartUrl")?.value.trim() || "";

  if (homeValue) targets.push({ type: "home", label: PAGE_LABELS.home, url: homeValue });

  const categoryValues = getCategoryInputs().map((input) => input.value.trim()).filter(Boolean);
  categoryValues.forEach((url, index) => {
    targets.push({
      type: "category",
      label: categoryValues.length > 1 ? `Category page ${index + 1}` : PAGE_LABELS.category,
      url
    });
  });

  if (cartValue) targets.push({ type: "cart", label: PAGE_LABELS.cart, url: cartValue });

  getProductInputs()
    .map((input) => input.value.trim())
    .filter(Boolean)
    .forEach((url, index) => {
      targets.push({ type: "product", label: `Product page ${index + 1}`, url });
    });

  return targets;
}


async function fetchPageHtml(url) {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) {
    return {
      ok: false,
      html: "",
      rawText: "",
      source: "blocked",
      mode: "none",
      contentType: "",
      url: ""
    };
  }

  if (PAGE_FETCH_CACHE.has(normalizedUrl)) {
    return PAGE_FETCH_CACHE.get(normalizedUrl);
  }

  const request = (async () => {
    const attempts = buildFetchAttempts(normalizedUrl, { mode: "html" });

    for (const attempt of attempts) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(attempt.url, { method: "GET", signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) continue;
        const text = await response.text();
        const normalized = normalizeFetchedPageMarkup(text, attempt.type, normalizedUrl, response.headers.get("content-type") || "");
        if (normalized.html && normalized.html.length > 120) {
          return {
            ok: true,
            source: attempt.type,
            html: normalized.html,
            rawText: normalized.rawText,
            mode: normalized.mode,
            contentType: response.headers.get("content-type") || "",
            url: normalizedUrl,
            finalUrl: response.url || normalizedUrl
          };
        }
      } catch (error) {
        clearTimeout(timeoutId);
      }
    }

    return {
      ok: false,
      html: "",
      rawText: "",
      source: "blocked",
      mode: "none",
      contentType: "",
      url: normalizedUrl,
      finalUrl: normalizedUrl
    };
  })();

  PAGE_FETCH_CACHE.set(normalizedUrl, request);
  return request;
}

function buildFetchAttempts(url, options = {}) {
  const normalized = String(url || "").trim();
  if (!normalized) return [];
  const noScheme = normalized.replace(/^https?:\/\//i, "");
  const protocol = /^http:\/\//i.test(normalized) ? "http" : "https";
  const attempts = [
    { type: "direct", url: normalized },
    { type: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(normalized)}` },
    { type: "codetabs", url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(normalized)}` }
  ];

  if (options.mode === "html" || options.mode === "text") {
    attempts.push({ type: "jina", url: `https://r.jina.ai/http://${noScheme}` });
    attempts.push({ type: "jina-protocol", url: `https://r.jina.ai/http://${protocol}://${noScheme}` });
  }

  return attempts;
}

function normalizeFetchedPageMarkup(text, source, pageUrl, contentType = "") {
  const raw = String(text || "");
  if (!raw.trim()) return { html: "", rawText: "", mode: "empty" };

  const looksLikeHtml = /<html[\s>]|<body[\s>]|<head[\s>]|<title[\s>]|<!doctype html/i.test(raw) || /text\/html/i.test(contentType);
  if (looksLikeHtml) {
    return { html: raw, rawText: stripHtmlToText(raw), mode: "html" };
  }

  if (source === "jina") {
    const cleaned = raw
      .replace(/^Title:\s*/im, "")
      .replace(/^URL Source:\s*/im, "")
      .replace(/^Markdown Content:\s*/im, "")
      .trim();
    const extractedLinks = [...new Set((cleaned.match(/https?:\/\/[^\s)\]>"']+/g) || []).slice(0, 40))];
    const html = `<!doctype html><html><head><title>${escapeHtml(pageUrl)}</title></head><body><main><pre>${escapeHtml(cleaned.slice(0, MAX_LINKED_RESOURCE_CHARS))}</pre>${extractedLinks.map((link) => `<a href="${escapeAttribute(link)}">${escapeHtml(link)}</a>`).join("")}</main></body></html>`;
    return { html, rawText: cleaned, mode: "text-proxy" };
  }

  const html = `<!doctype html><html><head><title>${escapeHtml(pageUrl)}</title></head><body><pre>${escapeHtml(raw.slice(0, MAX_LINKED_RESOURCE_CHARS))}</pre></body></html>`;
  return { html, rawText: raw, mode: "text" };
}

function stripHtmlToText(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPageSpeedScore(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SPEED_TIMEOUT_MS);
    const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?strategy=mobile&url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;

    const data = await response.json();
    const score = data?.lighthouseResult?.categories?.performance?.score;
    if (typeof score !== "number") return null;

    return {
      score: Math.round(score * 100),
      source: "Google PageSpeed"
    };
  } catch (error) {
    return null;
  }
}

function getScreenshotUrl(url, provider = "primary") {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) return "";
  if (provider === "fallback") {
    return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(normalizedUrl)}?w=1400`;
  }
  return `https://image.thum.io/get/width/1400/noanimate/${normalizedUrl}`;
}

function detectStoreStack(doc, text, html, url, context = null) {
  const lowerHtml = `${String(html || "").toLowerCase()} ${(context?.assetText || "").toLowerCase()} ${(context?.inlineText || "").toLowerCase()} ${(context?.resourceHints || "").toLowerCase()}`;
  const hostname = safeHostname(url);
  const signals = { platform: "Unknown", theme: "Unknown", apps: [], badges: [], signals: [] };

  if (/cdn\.shopify\.com|shopify\.theme|x-shopify-stage|shopify-payment-button/i.test(html)) signals.platform = "Shopify";
  else if (/woocommerce|wp-content\/plugins\/woocommerce/i.test(lowerHtml)) signals.platform = "WooCommerce";
  else if (/bigcommerce/i.test(lowerHtml)) signals.platform = "BigCommerce";
  else if (/myshopify\.com/i.test(lowerHtml) || /shopify/i.test(hostname)) signals.platform = "Shopify";

  const appTests = [
    ["judge.me", /judge\.me/i],
    ["Klaviyo", /klaviyo/i],
    ["Loox", /loox/i],
    ["Yotpo", /yotpo/i],
    ["Recharge", /recharge/i],
    ["Stamped", /stamped/i],
    ["Afterpay / Clearpay", /afterpay|clearpay/i],
    ["Klarna", /klarna/i],
    ["Shop Pay", /shop pay/i],
    ["Okendo", /okendo/i],
    ["Attentive", /attentive/i],
    ["Gorgias", /gorgias/i],
    ["Searchanise", /searchanise/i],
    ["Nosto", /nosto/i]
  ];
  appTests.forEach(([name, regex]) => { if (regex.test(lowerHtml)) signals.apps.push(name); });

  const themePatterns = [
    ["Dawn", /theme_store_id.*?887|"name"\s*:\s*"dawn"/i],
    ["Impulse", /impulse/i],
    ["Prestige", /prestige/i],
    ["Refresh", /refresh/i],
    ["Turbo", /turbo/i]
  ];
  for (const [name, regex] of themePatterns) {
    if (regex.test(lowerHtml)) { signals.theme = name; break; }
  }

  if (hasAny(text, ["free shipping", "free delivery"])) signals.badges.push("Free shipping");
  if (hasAny(text, ["money-back", "money back", "guarantee"])) signals.badges.push("Guarantee");
  if (hasAny(text, ["secure checkout", "secure payment", "ssl secure"])) signals.badges.push("Secure checkout");
  if (doc.querySelector('input[type="email"]')) signals.signals.push("Email capture");
  if (doc.querySelector('a[href*="instagram"], a[href*="facebook"], a[href*="tiktok"]')) signals.signals.push("Social links");
  if (doc.querySelector('img[alt*="visa" i], img[alt*="mastercard" i], img[src*="payment" i]')) signals.signals.push("Payment badges");
  if (doc.querySelector('header a[href="/"], header a[href*="home" i], a[aria-label*="logo" i]')) signals.signals.push("Logo linked home");

  signals.apps = [...new Set(signals.apps)];
  signals.badges = [...new Set(signals.badges)];
  signals.signals = [...new Set(signals.signals)];
  return signals;
}

function normalizeDiscoveredUrl(value, baseUrl) {
  if (!value) return null;
  const cleaned = String(value).trim();
  if (!cleaned || cleaned.startsWith("#") || /^javascript:|^mailto:|^tel:/i.test(cleaned)) return null;
  try {
    const url = new URL(cleaned, baseUrl);
    url.hash = "";
    const pathname = url.pathname.replace(/\/{2,}/g, "/");
    url.pathname = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
    return url.toString();
  } catch (error) {
    return null;
  }
}


function classifyDiscoveredUrl(url, labelText = "") {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname.toLowerCase()}/`;
    const label = String(labelText || "").toLowerCase();
    const combined = `${path} ${label}`;

    const excluded = [
      "/cart/", "/checkout/", "/account/", "/login/", "/register/", "/search/",
      "/policies/", "/policy/", "/privacy/", "/terms/", "/refund/", "/returns/",
      "/contact/", "/pages/", "/blogs/", "/blog/", "/articles/", "/collections/vendors",
      "/collections/types", "/apps/", "/tools/", "/cdn/", "/service/", "/help/"
    ];
    if (excluded.some((fragment) => path.includes(fragment))) return null;

    if (/(^|\/)(products?|product-detail|item|items|p|pdp)(\/|$)/i.test(path)) return "product";
    if (/(^|\/)(collections?|category|categories|catalog|catalogue|shop|store|c)(\/|$)/i.test(path)) return "category";
    if (/\b(add to cart|buy now|choose options?|quick add|shop now|view product|select options?)\b/i.test(combined)) return "product";
    if (/\b(shop all|view all|collection|category|catalog|browse|explore range|all products?)\b/i.test(combined)) return "category";

    if (parsed.search && /variant=|sku=|product/i.test(parsed.search)) return "product";
    return null;
  } catch (error) {
    return null;
  }
}

function createEmptyDiscoveryResult(baseUrl = "") {
  return {
    baseUrl,
    categories: [],
    products: [],
    debug: {
      sameDomainLinks: 0,
      homepageLinksParsed: 0,
      sitemapUrlsParsed: 0,
      sitemapsTried: 0,
      candidatePagesInspected: 0
    },
    notes: [],
    source: "none",
    status: "No URLs discovered yet."
  };
}

function mergeDiscoveryResults(target, incoming) {
  const categorySet = new Set(target.categories || []);
  const productSet = new Set(target.products || []);
  (incoming.categories || []).forEach((url) => {
    if (categorySet.size < MAX_AUTO_DISCOVERED_CATEGORIES) categorySet.add(url);
  });
  (incoming.products || []).forEach((url) => {
    if (productSet.size < MAX_AUTO_DISCOVERED_PRODUCTS) productSet.add(url);
  });
  target.categories = [...categorySet].slice(0, MAX_AUTO_DISCOVERED_CATEGORIES);
  target.products = [...productSet].slice(0, MAX_AUTO_DISCOVERED_PRODUCTS);
  return target;
}


function discoverUrlsFromHtml(html, baseUrl) {
  const discovered = createEmptyDiscoveryResult(baseUrl);
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const base = new URL(baseUrl);
    const linkMap = new Map();

    const rememberUrl = (candidate, label = "") => {
      const normalized = normalizeDiscoveredUrl(candidate, base);
      if (!normalized || safeHostname(normalized) !== safeHostname(baseUrl)) return;
      const existing = linkMap.get(normalized);
      const mergedLabel = [existing?.label || "", label].filter(Boolean).join(" ").trim();
      if (!existing || mergedLabel.length > (existing?.label || "").length) {
        linkMap.set(normalized, { label: mergedLabel });
      }
    };

    [...doc.querySelectorAll('a[href]')].forEach((anchor) => {
      const label = `${anchor.textContent || ""} ${anchor.getAttribute("aria-label") || ""} ${anchor.getAttribute("title") || ""}`.trim();
      rememberUrl(anchor.getAttribute("href"), label);
    });

    [...doc.querySelectorAll('link[rel="canonical"], link[rel="alternate"], meta[property="og:url"], meta[name="twitter:url"]')].forEach((node) => {
      rememberUrl(node.getAttribute("href") || node.getAttribute("content") || "", "");
    });

    const textSources = [
      html,
      ...[...doc.querySelectorAll('script[type="application/json"], script[type="application/ld+json"], script:not([src])')]
        .slice(0, 12)
        .map((node) => (node.textContent || "").slice(0, MAX_INLINE_TEXT_CHARS))
    ].join(" ");

    const urlMatches = textSources.match(/https?:\/\/[^\s"'<>]+/g) || [];
    urlMatches.slice(0, MAX_DISCOVERY_TEXT_URLS).forEach((value) => rememberUrl(value, "embedded-url"));

    const categories = [];
    const products = [];

    [...linkMap.entries()].forEach(([url, meta]) => {
      const type = classifyDiscoveredUrl(url, meta.label);
      if (type === "category" && categories.length < MAX_AUTO_DISCOVERED_CATEGORIES) categories.push(url);
      if (type === "product" && products.length < MAX_AUTO_DISCOVERED_PRODUCTS) products.push(url);
    });

    discovered.debug.homepageLinksParsed = linkMap.size;
    discovered.debug.sameDomainLinks = linkMap.size;
    discovered.categories = [...new Set(categories)];
    discovered.products = [...new Set(products)];
    if (!discovered.categories.length && !discovered.products.length) {
      discovered.notes.push("The current site structure did not expose obvious product or category URLs in the fetched markup.");
    }
    return discovered;
  } catch (error) {
    discovered.notes.push("The home page HTML could not be parsed for links.");
    return discovered;
  }
}

function extractSitemapsFromRobots(text, baseUrl) {
  const found = [];
  String(text || "").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*Sitemap:\s*(.+)\s*$/i);
    if (!match) return;
    const normalized = normalizeDiscoveredUrl(match[1], baseUrl);
    if (normalized) found.push(normalized);
  });
  return [...new Set(found)];
}

function extractUrlsFromXml(text, baseUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(text || ""), "application/xml");
  if (doc.querySelector("parsererror")) return { urls: [], sitemaps: [] };
  const urls = [...doc.querySelectorAll("url > loc")].map((node) => normalizeDiscoveredUrl(node.textContent, baseUrl)).filter(Boolean);
  const sitemaps = [...doc.querySelectorAll("sitemap > loc")].map((node) => normalizeDiscoveredUrl(node.textContent, baseUrl)).filter(Boolean);
  return { urls, sitemaps };
}


async function fetchTextResource(url) {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) return { ok: false, source: "blocked", text: "", url: "" };

  if (TEXT_FETCH_CACHE.has(normalizedUrl)) {
    return TEXT_FETCH_CACHE.get(normalizedUrl);
  }

  const request = (async () => {
    const attempts = buildFetchAttempts(normalizedUrl, { mode: "text" });

    for (const attempt of attempts) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(attempt.url, { method: "GET", signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) continue;
        const text = await response.text();
        if (text && text.length > 20) return { ok: true, source: attempt.type, text, url: normalizedUrl };
      } catch (error) {
        clearTimeout(timeoutId);
      }
    }

    return { ok: false, source: "blocked", text: "", url: normalizedUrl };
  })();

  TEXT_FETCH_CACHE.set(normalizedUrl, request);
  return request;
}

async function inspectCandidateUrl(url) {
  const result = await fetchPageHtml(url);
  if (!result.ok) return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(result.html, "text/html");
    const context = await buildAnalysisContext(doc, result.html, url);
    const bodyText = String(context.signalText || "").toLowerCase();
    const hasProductSchema = hasStructuredDataType(context, "Product", "Offer");
    const hasCategorySignals = hasAny(bodyText, ["filter", "sort", "shop all", "view all", "collections", "category", "browse", "results"]) || !!doc.querySelector('select, [class*="filter" i], [data-filter], [data-sort], [class*="collection" i]');
    const hasProductSignals = hasProductSchema
      || hasAny(bodyText, ["add to cart", "buy now", "product details", "quantity", "variant", "size guide", "add to bag", "in stock"])
      || !!doc.querySelector('button[name="add"], [data-add-to-cart], form[action*="/cart"], [data-product], [itemtype*="Product"], [itemprop="price"]');

    const productScore = (hasProductSignals ? 3 : 0) + (context.commerceSignals?.priceSignals ? 2 : 0) + (context.commerceSignals?.variantSignals ? 2 : 0) + (context.domStats?.productForms ? 2 : 0);
    const categoryScore = (hasCategorySignals ? 3 : 0) + (context.domStats?.images >= 6 ? 1 : 0) + (context.domStats?.priceNodes >= 3 ? 2 : 0);

    if (productScore >= categoryScore + 2) return "product";
    if (categoryScore >= productScore + 2) return "category";
    if (hasProductSignals) return "product";
    if (hasCategorySignals) return "category";
    return classifyDiscoveredUrl(url, bodyText);
  } catch (error) {
    return null;
  }
}

async function discoverUrlsAdvanced(homeUrl, setStatus = () => {}) {
  const discovered = createEmptyDiscoveryResult(homeUrl);
  const notes = discovered.notes;
  const totalSteps = 5;
  const setStep = (step, message, extra = {}) => {
    discovered.status = message;
    setStatus({
      step,
      totalSteps,
      message,
      notes: extra.notes,
      preview: extra.preview
    });
  };

  setStep(1, "Fetching the home page to discover internal URLs...");
  const homeFetch = await fetchPageHtml(homeUrl);
  if (!homeFetch.ok) {
    notes.push("The home page could not be fetched automatically. This usually happens because the site blocks browser fetch requests or uses heavy client-side rendering.");
    discovered.source = "blocked";
    discovered.status = "Automatic discovery could not access the home page.";
    setStep(5, discovered.status, {
      notes: discovered.notes,
      preview: {
        categories: discovered.categories,
        products: discovered.products
      }
    });
    return discovered;
  }

  discovered.source = homeFetch.source;
  mergeDiscoveryResults(discovered, discoverUrlsFromHtml(homeFetch.html, homeUrl));
  const parser = new DOMParser();
  const homeDoc = parser.parseFromString(homeFetch.html, "text/html");
  const homeStructuredData = extractStructuredData(homeDoc);
  const platformApiSignals = await inspectPlatformApiSignals(homeUrl, homeFetch.html, homeStructuredData);
  mergeDiscoveryResults(discovered, {
    categories: platformApiSignals.urlHints.filter((url) => classifyDiscoveredUrl(url) === "category"),
    products: platformApiSignals.urlHints.filter((url) => classifyDiscoveredUrl(url) === "product")
  });
  if (platformApiSignals.badges.length) notes.push(`Storefront APIs contributed additional discovery signals (${platformApiSignals.badges.join(", ")}).`);
  if (discovered.categories.length || discovered.products.length) {
    notes.push(`Home page scan found ${discovered.debug.homepageLinksParsed} same-domain links.`);
  } else {
    notes.push(`Home page scan found ${discovered.debug.homepageLinksParsed} same-domain links, but none matched the current product/category rules.`);
  }

  setStep(2, "Checking robots.txt and sitemap files for more URLs...");
  let sitemapQueue = [normalizeDiscoveredUrl("/sitemap.xml", homeUrl), normalizeDiscoveredUrl("/sitemap_index.xml", homeUrl)].filter(Boolean);
  const robotsUrl = normalizeDiscoveredUrl("/robots.txt", homeUrl);
  if (robotsUrl) {
    const robotsResult = await fetchTextResource(robotsUrl);
    if (robotsResult.ok) sitemapQueue = [...new Set([...extractSitemapsFromRobots(robotsResult.text, homeUrl), ...sitemapQueue])];
  }

  const discoveredFromSitemaps = createEmptyDiscoveryResult(homeUrl);
  const nestedSitemaps = [];
  for (const sitemapUrl of sitemapQueue.slice(0, MAX_DISCOVERY_SITEMAPS)) {
    const sitemapResult = await fetchTextResource(sitemapUrl);
    discovered.debug.sitemapsTried += 1;
    if (!sitemapResult.ok) continue;
    const xml = extractUrlsFromXml(sitemapResult.text, homeUrl);
    discovered.debug.sitemapUrlsParsed += xml.urls.length;
    nestedSitemaps.push(...xml.sitemaps);
    xml.urls.slice(0, MAX_DISCOVERY_URLS_FROM_SITEMAP).forEach((url) => {
      const type = classifyDiscoveredUrl(url);
      if (type === "category") discoveredFromSitemaps.categories.push(url);
      if (type === "product") discoveredFromSitemaps.products.push(url);
    });
  }

  for (const sitemapUrl of [...new Set(nestedSitemaps)].slice(0, Math.max(0, MAX_DISCOVERY_SITEMAPS - discovered.debug.sitemapsTried))) {
    const sitemapResult = await fetchTextResource(sitemapUrl);
    discovered.debug.sitemapsTried += 1;
    if (!sitemapResult.ok) continue;
    const xml = extractUrlsFromXml(sitemapResult.text, homeUrl);
    discovered.debug.sitemapUrlsParsed += xml.urls.length;
    xml.urls.slice(0, MAX_DISCOVERY_URLS_FROM_SITEMAP).forEach((url) => {
      const type = classifyDiscoveredUrl(url);
      if (type === "category") discoveredFromSitemaps.categories.push(url);
      if (type === "product") discoveredFromSitemaps.products.push(url);
    });
  }

  mergeDiscoveryResults(discovered, {
    categories: [...new Set(discoveredFromSitemaps.categories)],
    products: [...new Set(discoveredFromSitemaps.products)]
  });

  setStep(3, "Classifying discovered URLs and validating likely page types...", {
    preview: {
      categories: discovered.categories,
      products: discovered.products
    }
  });

  if (discovered.debug.sitemapUrlsParsed) notes.push(`Sitemaps contributed ${discovered.debug.sitemapUrlsParsed} URLs for classification.`);
  else notes.push("No usable sitemap URLs were available.");

  if ((!discovered.categories.length || !discovered.products.length) && discovered.debug.homepageLinksParsed) {
    setStep(4, "Inspecting likely internal pages to confirm product and category patterns...");
    const candidateUrls = [...new Set(
      [...homeDoc.querySelectorAll('a[href]')]
        .map((a) => normalizeDiscoveredUrl(a.getAttribute("href"), homeUrl))
        .filter(Boolean)
        .filter((url) => safeHostname(url) === safeHostname(homeUrl))
    )].slice(0, MAX_DISCOVERY_CANDIDATE_PAGES);

    const inspectionResults = await mapWithConcurrency(
      candidateUrls.filter((url) => !discovered.categories.includes(url) && !discovered.products.includes(url)),
      3,
      async (url) => ({ url, type: await inspectCandidateUrl(url) })
    );
    inspectionResults.forEach((entry) => {
      if (!entry?.type) return;
      discovered.debug.candidatePagesInspected += 1;
      if (entry.type === "category" && discovered.categories.length < MAX_AUTO_DISCOVERED_CATEGORIES) discovered.categories.push(entry.url);
      if (entry.type === "product" && discovered.products.length < MAX_AUTO_DISCOVERED_PRODUCTS) discovered.products.push(entry.url);
    });

    if (discovered.debug.candidatePagesInspected) notes.push(`Confirmed ${discovered.debug.candidatePagesInspected} candidate internal pages by inspecting their content.`);
  }

  discovered.categories = [...new Set(discovered.categories)].slice(0, MAX_AUTO_DISCOVERED_CATEGORIES);
  discovered.products = [...new Set(discovered.products)].slice(0, MAX_AUTO_DISCOVERED_PRODUCTS);

  if (discovered.categories.length || discovered.products.length) {
    discovered.status = `Discovery complete: ${discovered.categories.length} category URL${discovered.categories.length === 1 ? "" : "s"} and ${discovered.products.length} product URL${discovered.products.length === 1 ? "" : "s"} found.`;
  } else {
    discovered.status = "Discovery completed, but no category or product URLs could be confirmed automatically.";
    notes.push("Some stores hide important links behind JavaScript menus or use custom URL structures, so manual URLs may still be needed.");
  }

  setStep(5, discovered.status, {
    notes: discovered.notes,
    preview: {
      categories: discovered.categories,
      products: discovered.products
    }
  });

  return discovered;
}

function autoFillDiscoveredUrls(discovered, plan) {
  const categoryInputs = getCategoryInputs();
  if (!categoryInputs.some((input) => input.value.trim()) && discovered.categories.length) {
    discovered.categories.slice(0, plan === "pro" ? MAX_AUTO_DISCOVERED_CATEGORIES : 1).forEach((url, index) => {
      if (index === 0 && categoryInputs[0]) categoryInputs[0].value = url;
      else addCategoryRow(url);
    });
  }

  const productInputs = getProductInputs();
  if (!productInputs.some((input) => input.value.trim()) && discovered.products.length) {
    discovered.products.slice(0, plan === "pro" ? MAX_AUTO_DISCOVERED_PRODUCTS : Math.min(3, discovered.products.length)).forEach((url, index) => {
      if (index < productInputs.length) productInputs[index].value = url;
      else addProductRow(url);
    });
  }
}

async function analyzeCompetitor(url, plan) {
  const fetchResult = await fetchPageHtml(url);
  fetchResult.url = url;
  const home = await analyzePage("home", fetchResult, plan);
  const general = await analyzePage("general", fetchResult, plan);
  const totalWeight = home.totalWeight + general.totalWeight;
  const scoreWeight = home.scoreWeight + general.scoreWeight;
  const speed = await fetchPageSpeedScore(url);
  return {
    url,
    fetched: fetchResult.ok,
    score: totalWeight ? Math.round((scoreWeight / totalWeight) * 100) : 0,
    speed: speed?.score ?? null,
    stack: home.stack || general.stack || null,
    reliability: home.reliability || general.reliability || null
  };
}

function dedupeRecommendations(recommendations) {
  const seen = new Set();
  return recommendations.filter((item) => {
    const key = slugify(`${item.pageLabel}-${item.title}-${item.impactLabel}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function estimateRevenueOpportunity(score, criticalIssues, pageCount) {
  const raw = Math.max(6, Math.min(35, Math.round(((100 - score) * 0.22) + (criticalIssues * 1.8) + Math.max(0, pageCount - 2))));
  return raw;
}

function safeHostname(value) {
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch (error) { return ''; }
}

async function discoverUrlsOnly() {
  const homeUrl = document.getElementById("homeUrl")?.value.trim();
  if (!homeUrl) {
    alert("Add a home page URL first.");
    return;
  }

  const discoverButton = document.getElementById("discoverButton");
  if (discoverButton) {
    discoverButton.disabled = true;
    discoverButton.dataset.originalLabel = discoverButton.dataset.originalLabel || discoverButton.textContent;
    discoverButton.textContent = "Discovering...";
  }

  renderDiscoveredUrls({
    categories: [],
    products: [],
    status: "Starting URL discovery...",
    notes: ["The app is scanning the home page, robots.txt, sitemap files, and likely internal links."]
  });

  try {
    const discovered = await discoverUrlsAdvanced(homeUrl, (payload) => {
      const info = typeof payload === "string" ? { message: payload } : (payload || {});
      renderDiscoveredUrls({
        categories: info.preview?.categories || [],
        products: info.preview?.products || [],
        status: info.message || "Discovering URLs...",
        notes: info.notes || ["The app is still working. This can take a little longer on larger stores."]
      });
    });
    STATE.discovered = discovered;
    renderDiscoveredUrls(discovered);
    autoFillDiscoveredUrls(discovered, STATE.plan);
  } finally {
    if (discoverButton) {
      discoverButton.disabled = false;
      discoverButton.textContent = discoverButton.dataset.originalLabel || "Discover URLs";
    }
  }
}

async function analyzePage(pageType, fetchResult, plan) {
  const parser = new DOMParser();
  const fallbackHtml = "<html><body></body></html>";
  const doc = parser.parseFromString(fetchResult.ok ? fetchResult.html : fallbackHtml, "text/html");
  const context = fetchResult.ok
    ? await buildAnalysisContext(doc, fetchResult.html, fetchResult.url || "")
    : buildFallbackAnalysisContext(doc, fetchResult.url || "");

  const stack = fetchResult.ok ? detectStoreStack(doc, context.signalText, fetchResult.html, fetchResult.url || "", context) : null;
  context.stack = stack;
  const rules = (AUTOMATED_CHECKS[pageType] || []).filter((item) => plan === "pro" || item.tier === "basic");

  const appliedChecks = [];
  const recommendations = [];
  let scoreWeight = 0;
  let totalWeight = 0;
  let criticalIssues = 0;

  rules.forEach((ruleDef) => {
    let passed = false;
    if (fetchResult.ok) {
      try {
        passed = !!ruleDef.test({
          doc,
          text: context.signalText,
          html: fetchResult.html,
          stack,
          context,
          structuredData: context.structuredData,
          resources: context.resources
        });
      } catch (error) {
        passed = false;
      }
    }

    totalWeight += ruleDef.weight;
    if (passed) scoreWeight += ruleDef.weight;

    const evidence = describeRuleEvidence(ruleDef, context, pageType, passed, fetchResult.ok);
    appliedChecks.push({
      id: ruleDef.id,
      label: ruleDef.label,
      passed,
      weight: ruleDef.weight,
      tier: ruleDef.tier,
      evidence
    });

    if (!passed) {
      const priority = ruleDef.weight * (plan === "pro" ? 2 : 1.6);
      if (ruleDef.weight >= 3) criticalIssues += 1;
      recommendations.push({
        title: ruleDef.label,
        detail: fetchResult.ok
          ? explainRuleFailure(ruleDef, pageType, context)
          : `The page could not be fetched automatically, so this important check should be reviewed manually.`,
        priority,
        impactLabel: ruleDef.weight >= 3 ? "High" : ruleDef.weight === 2 ? "Medium" : "Low",
        pageLabel: PAGE_LABELS[pageType],
        type: fetchResult.ok ? "automatic" : "manual",
        sourceLabel: fetchResult.ok ? "Automatic inspection" : "Manual review",
        confidence: fetchResult.ok ? context.reliability.label : "Low",
        evidence: fetchResult.ok ? evidence : "Automatic page access was blocked.",
        evidenceBadges: context.evidenceBadges || []
      });
    }
  });

  return {
    fetchStatus: fetchResult.ok ? `Fetched via ${fetchResult.source}` : "Fetch blocked or unavailable",
    appliedChecks,
    scoreWeight,
    totalWeight,
    criticalIssues,
    recommendations,
    stack,
    screenshotUrl: fetchResult.url ? getScreenshotUrl(fetchResult.url) : "",
    reliability: context.reliability,
    evidenceBadges: context.evidenceBadges || [],
    structuredDataSummary: summarizeStructuredData(context.structuredData),
    extractedSignals: context.extractedSignals,
    resourceSummary: context.resourceSummary
  };
}

function buildManualRecommendations(checklist, pageResults, plan) {
  const pageStatus = new Map(pageResults.map((item) => [item.type, item]));
  return checklist
    .filter((item) => {
      if (item.page === "general") return item.priorityScore >= 4 || item.defaultEvaluation === "Bad" || item.defaultEvaluation === "Can be Improved";
      return !pageStatus.has(item.page) || item.priorityScore >= 5 || item.defaultEvaluation === "Bad";
    })
    .slice(0, plan === "pro" ? 60 : FREE_PLAN_MAX_RECOMMENDATIONS)
    .map((item) => ({
      title: item.checkpoint,
      detail: `Review this area on the ${item.pageLabel.toLowerCase()} under ${item.section}.`,
      priority: (item.priorityScore || 1) + (item.impact || 1),
      impactLabel: item.impact >= 3 ? "High" : item.impact === 2 ? "Medium" : "Low",
      pageLabel: item.pageLabel,
      type: "manual",
      url: resolveRecommendationUrl(item, pageResults)
    }));
}

function resolveRecommendationUrl(item, pageResults) {
  const directMatch = pageResults.find((page) => page.type === item.page);
  if (directMatch?.url) return directMatch.url;

  if (item.page === "general") {
    return pageResults.find((page) => page.type === "home")?.url || pageResults[0]?.url || "";
  }

  if (item.page === "product") {
    return pageResults.find((page) => page.type === "product")?.url || "";
  }

  return pageResults[0]?.url || "";
}


function getSpeedClass(score) {
  if (score == null) return "speed-unknown";
  if (score >= 80) return "speed-good";
  if (score >= 50) return "speed-medium";
  return "speed-bad";
}

function getSpeedMessage(score) {
  if (score == null) return "Could not measure home page speed automatically.";
  if (score >= 80) return "Good performance";
  if (score >= 50) return "Average performance · should be improved";
  return "Poor performance · likely hurting conversion";
}

function renderHomeSpeedMetric(homePageSpeed) {
  const scoreElement = document.getElementById("pageSpeedScore");
  const labelElement = document.getElementById("pageSpeedLabel");
  const speedCard = scoreElement?.closest(".metric-card");
  if (!scoreElement || !labelElement || !speedCard) return;

  const score = typeof homePageSpeed === "number"
    ? homePageSpeed
    : (homePageSpeed && typeof homePageSpeed.score === "number" ? homePageSpeed.score : null);

  speedCard.classList.remove("speed-good", "speed-medium", "speed-bad", "speed-unknown");
  speedCard.classList.add(getSpeedClass(score));

  scoreElement.textContent = score != null ? `${score}/100` : "Unavailable";
  labelElement.textContent = score != null
    ? `${getSpeedMessage(score)} · Google PageSpeed mobile score`
    : getSpeedMessage(score);

  let gauge = speedCard.querySelector(".speed-meter");
  if (!gauge) {
    gauge = document.createElement("div");
    gauge.className = "speed-meter";
    gauge.innerHTML = '<div class="speed-meter-fill"></div>';
    labelElement.insertAdjacentElement("afterend", gauge);
  }

  const fill = gauge.querySelector(".speed-meter-fill");
  if (fill) {
    fill.style.width = `${Math.max(0, Math.min(100, score ?? 0))}%`;
  }
}

function renderReport(report) {
  hydrateReportLinks(report);
  document.getElementById("overallScore").textContent = `${report.overallScore}/100`;
  document.getElementById("overallScoreLabel").textContent = report.overallScore >= 80 ? "0 to 100 scale · Strong CRO baseline" : report.overallScore >= 60 ? "0 to 100 scale · Good start, room to improve" : "0 to 100 scale · Needs CRO attention";
  document.getElementById("checksUsed").textContent = report.checksUsed;
  document.getElementById("criticalIssues").textContent = report.criticalIssues;
  document.getElementById("pagesAnalyzed").textContent = report.pagesAnalyzed;
  document.getElementById("revenueOpportunity").textContent = `${report.revenueOpportunity || estimateRevenueOpportunity(report.overallScore, report.criticalIssues, report.pagesAnalyzed)}%`;
  document.getElementById("revenueOpportunityLabel").textContent = "Heuristic upside from fixing the current gaps";
  renderHomeSpeedMetric(report.homePageSpeed);
  const gauge = document.getElementById("scoreGaugeFill");
  if (gauge) gauge.style.width = `${Math.max(0, Math.min(100, report.overallScore))}%`;

  renderInspectionQuality(report);
  renderRecommendations(report.recommendations);
  renderPageBreakdown(report.pageResults);
  renderStackInsights(report.stackSummary);
  renderCompetitorComparison(report.competitorReport);
  renderScreenshots(report.pageResults);
  renderDiscoveredUrls(report.discovered || STATE.discovered);
}

function renderInspectionQuality(report) {
  const container = document.getElementById("inspectionQuality");
  if (!container) return;
  const summary = report?.inspectionSummary || buildInspectionSummary(report?.pageResults || []);
  const reliabilityClass = (summary.reliabilityLabel || "Low").toLowerCase().replace(/\s+/g, "-");
  container.className = "inspection-quality-grid";
  container.innerHTML = `
    <article class="inspection-card">
      <span class="metric-label">Inspection confidence</span>
      <strong class="inspection-score ${escapeAttribute(reliabilityClass)}">${escapeHtml(summary.reliabilityLabel || "Low")}</strong>
      <span class="metric-sub">Based on fetched pages, structured data, and linked assets</span>
    </article>
    <article class="inspection-card">
      <span class="metric-label">Pages fetched</span>
      <strong>${summary.fetchedPages}/${summary.pageCount}</strong>
      <span class="metric-sub">Automatic page access succeeded on these URLs</span>
    </article>
    <article class="inspection-card">
      <span class="metric-label">Structured data found</span>
      <strong>${summary.structuredDataCount}</strong>
      <span class="metric-sub">JSON-LD items used to enrich the audit</span>
    </article>
    <article class="inspection-card">
      <span class="metric-label">Extra sources inspected</span>
      <strong>${summary.assetCount}</strong>
      <span class="metric-sub">Linked assets plus inline data used to strengthen the audit</span>
    </article>
  `;
}

function renderRecommendations(recommendations) {
  const container = document.getElementById("recommendations");
  if (!recommendations.length) {
    container.className = "recommendation-list empty-state";
    container.textContent = "No recommendations yet.";
    return;
  }

  container.className = "recommendation-list";
  container.innerHTML = recommendations.map((item, index) => {
    const issueText = getIssueText(item);
    const solutionText = getSolutionText(item);
    const destinationUrl = getRecommendationDestination(item, STATE.latestReport?.pageResults || []);
    const pageName = item.pageLabel || PAGE_LABELS[item.page] || "Relevant page";
    const linkLabel = `${index + 1}. ${item.title}`;
    const linkHint = destinationUrl ? `Open ${pageName} · ${shortDisplayUrl(destinationUrl)}` : `Open ${pageName} · No matching page URL configured`;
    const confidence = item.confidence || (item.type === "automatic" ? "Medium" : "Low");
    const sourceLabel = item.sourceLabel || (item.type === "automatic" ? "Automatic inspection" : "Manual review");

    return `
    <article class="rec-card rec-card-detailed">
      <div class="rec-head">
        <div class="rec-head-main">
          ${destinationUrl
            ? `<a class="rec-link" href="${escapeAttribute(destinationUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkLabel)}</a>`
            : `<div class="rec-title">${escapeHtml(linkLabel)}</div>`}
          <div class="rec-subtitle">${escapeHtml(linkHint)}</div>
        </div>
        <span class="tag ${impactClass(item.impactLabel)}">${escapeHtml(item.impactLabel)} impact</span>
      </div>

      <div class="rec-body">
        <div class="rec-block">
          <strong>ISSUE</strong>
          <p>${escapeHtml(issueText)}</p>
        </div>
        <div class="rec-block">
          <strong>SOLUTION</strong>
          <p>${escapeHtml(solutionText)}</p>
        </div>
        ${item.evidence ? `<div class="rec-block rec-evidence"><strong>EVIDENCE</strong><p>${escapeHtml(item.evidence)}</p></div>` : ""}
      </div>

      <div class="tag-row">
        <span class="tag info">${escapeHtml(pageName)}</span>
        <span class="tag">${escapeHtml(sourceLabel)}</span>
        <span class="tag confidence-tag">${escapeHtml(confidence)} confidence</span>
      </div>
    </article>
  `;
  }).join("");
}

function hydrateReportLinks(report) {
  if (!report || !Array.isArray(report.recommendations)) return report;
  report.recommendations = report.recommendations.map((item) => {
    const page = item.page || normalizePageType(item.pageLabel) || guessPageFromText(item.title || item.detail || "") || "general";
    const pageLabel = item.pageLabel || PAGE_LABELS[page] || "General";
    return {
      ...item,
      page,
      pageLabel,
      url: item.url || getRecommendationDestination({ ...item, page, pageLabel }, report.pageResults || [])
    };
  });
  return report;
}

function getRecommendationDestination(item, pageResults) {
  if (item?.url) return item.url;
  const normalizedPage = item?.page || normalizePageType(item?.pageLabel) || guessPageFromText(item?.title || item?.detail || "") || "general";
  return resolveRecommendationUrl({ ...item, page: normalizedPage }, pageResults);
}

function normalizePageType(value) {
  const normalized = String(value || "").toLowerCase().trim();
  if (!normalized) return "";
  if (normalized.includes("home")) return "home";
  if (normalized.includes("category") || normalized.includes("collection")) return "category";
  if (normalized.includes("product")) return "product";
  if (normalized.includes("cart")) return "cart";
  if (normalized.includes("checkout")) return "checkout";
  if (normalized.includes("thank")) return "thankyou";
  if (normalized.includes("general")) return "general";
  return normalized;
}

function guessPageFromText(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "";
  if (text.includes("home page")) return "home";
  if (text.includes("category") || text.includes("collection")) return "category";
  if (text.includes("product page") || text.includes("product")) return "product";
  if (text.includes("cart")) return "cart";
  if (text.includes("checkout")) return "checkout";
  if (text.includes("thank you")) return "thankyou";
  return "";
}

function getIssueText(item) {
  if (item.type === "automatic") {
    return item.detail || `${item.title} is currently missing or too weak on this page.`;
  }

  return `${item.title} is missing, unclear, weak, or should be reviewed more closely on this page.`;
}

function getSolutionText(item) {
  const title = (item.title || "").toLowerCase();
  const shopifyHint = STATE.latestReport?.stackSummary?.platform === "Shopify" ? " On Shopify, this is usually handled in the theme editor or the relevant theme section / app block." : "";

  if (title.includes("title")) return `Add a clear, specific title that immediately tells the visitor what the page or product is about.${shopifyHint}`;
  if (title.includes("meta description")) return `Write a strong meta description that explains the value clearly and encourages clicks from search results.${shopifyHint}`;
  if (title.includes("contact") || title.includes("support")) return `Make contact or support options easy to find, ideally in the header, footer, cart, or product area.${shopifyHint}`;
  if (title.includes("policy") || title.includes("returns") || title.includes("refund") || title.includes("shipping")) return `Show shipping, returns, and policy information earlier and more clearly to reduce purchase hesitation.${shopifyHint}`;
  if (title.includes("search")) return `Add a visible search function so visitors can quickly find products or information.${shopifyHint}`;
  if (title.includes("heading") || title.includes("h1")) return "Use one clear main heading that matches the page intent and helps users orient themselves immediately.";
  if (title.includes("cta") || title.includes("add to cart") || title.includes("checkout") || title.includes("buy now")) return `Use a stronger and more visible primary call to action with clear wording and prominent placement.${shopifyHint}`;
  if (title.includes("value proposition")) return `State the main reason to buy from this brand near the top of the page in simple, benefit-focused language.${shopifyHint}`;
  if (title.includes("review") || title.includes("rating") || title.includes("testimonial") || title.includes("social proof")) return `Add visible reviews, ratings, or testimonials close to key buying decisions to build trust.${shopifyHint}`;
  if (title.includes("price")) return "Make the price easier to spot and easier to understand without extra scrolling or confusion.";
  if (title.includes("gallery") || title.includes("visual") || title.includes("image")) return `Add more high-quality product visuals and make sure they clearly show important product details.${shopifyHint}`;
  if (title.includes("benefits") || title.includes("features") || title.includes("bullets")) return `Summarize the most important product benefits in short bullets near the top of the page.${shopifyHint}`;
  if (title.includes("faq")) return `Add a short FAQ section that addresses common objections, shipping questions, sizing, or product concerns.${shopifyHint}`;
  if (title.includes("urgency") || title.includes("scarcity")) return "Add honest urgency or scarcity cues only where they are real and helpful, such as low stock or limited availability.";
  if (title.includes("filter") || title.includes("sorting") || title.includes("sort")) return `Add filters or sorting controls so shoppers can narrow options faster and find the right product sooner.${shopifyHint}`;
  if (title.includes("breadcrumb")) return "Add breadcrumbs so visitors always know where they are and can move back easily.";
  if (title.includes("quantity") || title.includes("remove")) return "Make cart editing actions simple and visible so users can change quantities or remove items without frustration.";
  if (title.includes("trust") || title.includes("secure") || title.includes("guarantee")) return `Reinforce trust with security, returns, guarantee, or reassurance messaging near the decision point.${shopifyHint}`;
  if (title.includes("summary")) return "Show a clear summary of the order or offer so users can confirm details quickly and confidently.";
  if (title.includes("guest checkout")) return `Offer guest checkout or make it more visible to reduce friction for first-time buyers.${shopifyHint}`;

  return `Improve this area on the ${item.pageLabel.toLowerCase()} with clearer CRO-focused content, stronger visibility, and less friction for the visitor.${shopifyHint}`;
}


function renderStackInsights(stackSummary) {
  const container = document.getElementById("stackInsights");
  if (!stackSummary) {
    container.className = "empty-state";
    container.textContent = "Run an analysis to detect the ecommerce stack.";
    return;
  }
  const apps = stackSummary.apps?.length ? stackSummary.apps.map((app) => `<span class="tag info">${escapeHtml(app)}</span>`).join("") : '<span class="tag">No major apps detected</span>';;
  const badges = [...(stackSummary.badges || []), ...(stackSummary.signals || [])].map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("");
  container.className = "";
  container.innerHTML = `
    <div class="stack-grid">
      <div class="mini-stat"><strong>Platform</strong><div class="comp-sub">${escapeHtml(stackSummary.platform || "Unknown")}</div></div>
      <div class="mini-stat"><strong>Theme</strong><div class="comp-sub">${escapeHtml(stackSummary.theme || "Unknown")}</div></div>
    </div>
    <div class="tag-row">${apps}</div>
    <div class="tag-row">${badges || '<span class="tag">No extra storefront signals detected yet</span>'}</div>
  `;
}

function renderCompetitorComparison(competitorReport) {
  const container = document.getElementById("competitorComparison");
  if (!competitorReport) {
    container.className = "empty-state";
    container.textContent = "Add a competitor home page URL to compare performance and CRO signals.";
    return;
  }
  const ownScore = STATE.latestReport?.overallScore ?? 0;
  const delta = competitorReport.score - ownScore;
  const deltaText = delta === 0 ? "You are currently tied on this high-level benchmark." : delta > 0 ? `Competitor leads by ${delta} points.` : `You lead by ${Math.abs(delta)} points.`;
  container.className = "";
  container.innerHTML = `
    <div class="comparison-grid">
      <div class="mini-stat"><strong>Your store</strong><div class="comp-score">${ownScore}/100</div><div class="comp-sub">Current storefront CRO score</div></div>
      <div class="mini-stat"><strong>Competitor</strong><div class="comp-score">${competitorReport.score}/100</div><div class="comp-sub">${escapeHtml(shortDisplayUrl(competitorReport.url))}</div></div>
      <div class="mini-stat"><strong>Your home speed</strong><div class="comp-score">${STATE.latestReport?.homePageSpeed?.score != null ? STATE.latestReport.homePageSpeed.score : "—"}</div><div class="comp-sub">Mobile performance</div></div>
      <div class="mini-stat"><strong>Competitor speed</strong><div class="comp-score">${competitorReport.speed != null ? competitorReport.speed : "—"}</div><div class="comp-sub">Mobile performance</div></div>
    </div>
    <p class="note-line">${escapeHtml(deltaText)}</p>
    <div class="tag-row">${competitorReport.stack?.platform ? `<span class="tag info">${escapeHtml(competitorReport.stack.platform)}</span>` : ""}${(competitorReport.stack?.apps || []).map((app) => `<span class="tag">${escapeHtml(app)}</span>`).join("")}</div>
  `;
}

function renderScreenshots(pageResults) {
  const container = document.getElementById("screenshotGallery");
  const pages = pageResults.filter((page) => page.url);
  if (!pages.length) {
    container.className = "screenshot-grid empty-state";
    container.textContent = "Run an analysis to generate page previews.";
    return;
  }
  container.className = "screenshot-grid";
  container.innerHTML = pages.slice(0, 6).map((page) => {
    const primary = page.screenshotUrl || getScreenshotUrl(page.url);
    const fallback = getScreenshotUrl(page.url, "fallback");
    return `
    <article class="thumb-card">
      <div class="thumb-title">${escapeHtml(page.label)}</div>
      <img class="screenshot-thumb" loading="eager" decoding="async" fetchpriority="high"
        src="${escapeAttribute(primary)}"
        alt="Screenshot preview for ${escapeAttribute(page.label)}"
        referrerpolicy="no-referrer"
        onerror="if(!this.dataset.fallbackLoaded){this.dataset.fallbackLoaded='true';this.src='${escapeAttribute(fallback)}';}else{this.outerHTML='<div class=&quot;thumb-empty&quot;>Screenshot preview unavailable for this page.</div>';}"
       />
      <div class="note-line">${escapeHtml(shortDisplayUrl(page.url))}</div>
    </article>
  `;
  }).join("");
}

function renderDiscoveredUrls(discovered) {
  const panel = document.getElementById("discoveryPanel");
  const list = document.getElementById("discoveryList");
  if (!panel || !list) return;

  const categories = discovered?.categories || [];
  const products = discovered?.products || [];
  const notes = discovered?.notes || [];
  const status = discovered?.status || "";

  if (!categories.length && !products.length && !status && !notes.length) {
    panel.classList.add("hidden");
    list.innerHTML = "";
    return;
  }

  panel.classList.remove("hidden");
  const summaryBits = [];
  if (status) summaryBits.push(`<div class="discovery-status">${escapeHtml(status)}</div>`);
  if (categories.length || products.length) summaryBits.push(`<div class="discovery-summary">${categories.length} category URL${categories.length === 1 ? "" : "s"} • ${products.length} product URL${products.length === 1 ? "" : "s"}</div>`);
  if (notes.length) summaryBits.push(`<div class="discovery-notes">${notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}</div>`);

  const chips = [
    ...categories.map((url) => `<div class="discovery-chip">Category: ${escapeHtml(shortDisplayUrl(url))}</div>`),
    ...products.map((url) => `<div class="discovery-chip">Product: ${escapeHtml(shortDisplayUrl(url))}</div>`)
  ].join("");

  list.innerHTML = `${summaryBits.join("")}${chips ? `<div class="discovery-chip-grid">${chips}</div>` : ""}`;
}

function renderTrendChart() {
  const container = document.getElementById("trendChart");
  if (!container) return;
  const reports = JSON.parse(localStorage.getItem("croSavedReports") || "[]").slice().reverse();
  if (!reports.length) {
    container.className = "empty-state";
    container.textContent = "No score history yet.";
    return;
  }
  const width = 720;
  const height = 220;
  const padding = 28;
  const points = reports.map((report, index) => {
    const x = padding + (index * ((width - padding * 2) / Math.max(1, reports.length - 1)));
    const y = height - padding - ((report.overallScore / 100) * (height - padding * 2));
    return { x, y, score: report.overallScore, label: new Date(report.createdAt).toLocaleDateString() };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const dots = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="white"></circle><text x="${point.x}" y="${point.y - 10}" fill="white" font-size="11" text-anchor="middle">${point.score}</text>`).join("");
  container.className = "trend-wrap";
  container.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(255,255,255,.2)"></line>
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="rgba(255,255,255,.2)"></line>
      <polyline fill="none" stroke="url(#trendGradient)" stroke-width="3" points="${polyline}"></polyline>
      <defs><linearGradient id="trendGradient" x1="0" x2="1"><stop offset="0%" stop-color="#6ea8fe"></stop><stop offset="100%" stop-color="#8b5cf6"></stop></linearGradient></defs>
      ${dots}
    </svg>
    <div class="legend-row">${reports.map((report) => `<span class="tag">${escapeHtml(new Date(report.createdAt).toLocaleDateString())}: ${report.overallScore}/100</span>`).join("")}</div>
  `;
}

function renderPageBreakdown(pageResults) {
  const container = document.getElementById("pageBreakdown");
  if (!pageResults.length) {
    container.className = "page-breakdown empty-state";
    container.textContent = "No page data yet.";
    return;
  }

  container.className = "page-breakdown";
  container.innerHTML = pageResults.map((page) => {
    const passed = page.appliedChecks.filter((item) => item.passed).length;
    const failed = page.appliedChecks.length - passed;
    const evidenceBadges = (page.evidenceBadges || []).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("");
    const structuredData = (page.structuredDataSummary || []).map((item) => `<span class="tag info">${escapeHtml(item)}</span>`).join("");
    const reliabilityLabel = page.reliability?.label || "Low";
    const reliabilityScore = page.reliability?.score ?? 0;
    return `
      <article class="page-card">
        <div class="page-top">
          <div>
            <div class="page-title">${escapeHtml(page.label)}</div>
            <a class="inline-link" href="${escapeAttribute(page.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(page.url)}</a>
          </div>
          <span class="tag ${page.fetchStatus.startsWith("Fetched") ? "success" : "warn"}">${escapeHtml(page.fetchStatus)}</span>
        </div>
        <div class="page-grid">
          <div class="stat-chip">
            <strong>${passed}</strong>
            <span>Passed</span>
          </div>
          <div class="stat-chip">
            <strong>${failed}</strong>
            <span>Needs work</span>
          </div>
          <div class="stat-chip">
            <strong>${page.appliedChecks.length}</strong>
            <span>Auto checks</span>
          </div>
          <div class="stat-chip">
            <strong>${reliabilityScore}</strong>
            <span>${escapeHtml(reliabilityLabel)} confidence</span>
          </div>
        </div>
        <p class="status-note">
          ${page.fetchStatus.startsWith("Fetched")
            ? "This page was fetched successfully and evaluated using page text, metadata, structured data, inline commerce state, reachable linked assets, and any storefront APIs that could be reached from this static app."
            : "This page could not be fetched automatically. Use the recommendations list as a structured manual review guide."}
        </p>
        ${(page.extractedSignals?.length || page.resourceSummary?.assetCount || page.structuredDataSummary?.length) ? `
          <div class="page-evidence">
            ${evidenceBadges}
            ${structuredData}
            ${page.resourceSummary?.assetCount ? `<span class="tag">${page.resourceSummary.assetCount} linked assets</span>` : ""}
          </div>` : ""}
        ${page.stack ? `<div class="tag-row"><span class="tag info">${escapeHtml(page.stack.platform || 'Unknown platform')}</span>${(page.stack.apps || []).slice(0, 3).map((app) => `<span class="tag">${escapeHtml(app)}</span>`).join('')}</div>` : ''}
      </article>
    `;
  }).join("");
}

function buildInspectionSummary(pageResults) {
  const pageCount = pageResults.length;
  const fetchedPages = pageResults.filter((page) => page.fetchStatus?.startsWith("Fetched")).length;
  const structuredDataCount = pageResults.reduce((sum, page) => sum + ((page.structuredDataSummary || []).length), 0);
  const assetCount = pageResults.reduce((sum, page) => sum + ((page.resourceSummary?.assetCount || 0) + (page.resourceSummary?.inlineCount || 0)), 0);
  const avgReliability = pageCount
    ? Math.round(pageResults.reduce((sum, page) => sum + (page.reliability?.score || 0), 0) / pageCount)
    : 0;
  return {
    pageCount,
    fetchedPages,
    structuredDataCount,
    assetCount,
    reliabilityScore: avgReliability,
    reliabilityLabel: avgReliability >= 80 ? "High" : avgReliability >= 50 ? "Medium" : "Low"
  };
}

function summarizeStructuredData(items) {
  const types = [];
  (items || []).forEach((entry) => {
    const entryTypes = Array.isArray(entry?.types) ? entry.types : [];
    entryTypes.forEach((item) => {
      if (item && !types.includes(item)) types.push(item);
    });
  });
  return types.slice(0, 4);
}

function explainRuleFailure(ruleDef, pageType, context) {
  const hints = {
    title: "No strong title signal was found in the parsed page title or heading structure.",
    description: "The page is missing a clear descriptive metadata signal.",
    search: "No strong search element or search wording was found in the parsed page content.",
    review: "No strong review or rating signal was found in page text, structured data, or reachable assets.",
    shipping: "Shipping or returns reassurance was not clearly found in the parsed page content.",
    faq: "No FAQ-style content was found in the parsed text or structured data.",
    price: "A price pattern was not confidently detected in text or structured data.",
    cart: "The expected cart or checkout signal was not confidently detected in the parsed page content."
  };
  const id = ruleDef.id || "";
  if (/meta-description/.test(id)) return hints.description;
  if (/search/.test(id)) return hints.search;
  if (/review|social-proof|rating/.test(id)) return hints.review;
  if (/shipping|refund|returns|policy/.test(id)) return hints.shipping;
  if (/faq/.test(id)) return hints.faq;
  if (/price/.test(id)) return hints.price;
  if (/title|h1/.test(id)) return hints.title;
  if (/checkout|cart/.test(id)) return hints.cart;
  const pageLabel = PAGE_LABELS[pageType] || "page";
  return `This signal was not found strongly enough in the ${pageLabel.toLowerCase()} content that could be inspected automatically.`;
}

function describeRuleEvidence(ruleDef, context, pageType, passed, fetchOk) {
  if (!fetchOk) return "Automatic page access was blocked.";
  const sources = [];
  if (context.title) sources.push(`title: ${truncateText(context.title, 70)}`);
  if (context.metaDescription) sources.push(`meta: ${truncateText(context.metaDescription, 90)}`);
  if ((context.structuredData || []).length) sources.push(`${context.structuredData.length} JSON-LD item${context.structuredData.length === 1 ? "" : "s"}`);
  if (context.commerceSignals?.stateSnippets?.length) sources.push(`${context.commerceSignals.stateSnippets.length} commerce-state snippet${context.commerceSignals.stateSnippets.length === 1 ? "" : "s"}`);
  if (context.resourceSummary?.assetCount) sources.push(`${context.resourceSummary.assetCount} linked source${context.resourceSummary.assetCount === 1 ? "" : "s"} inspected`);
  if (context.platformApiSignals?.badges?.length) sources.push(context.platformApiSignals.badges.join(", "));
  if (passed) return sources.slice(0, 3).join(" · ") || "Signal confirmed from parsed page content.";
  return sources.slice(0, 3).join(" · ") || `Checked parsed ${PAGE_LABELS[pageType].toLowerCase()} HTML only.`;
}


function buildFallbackAnalysisContext(doc, pageUrl) {
  return {
    url: pageUrl,
    title: doc.querySelector("title")?.textContent?.trim() || "",
    metaDescription: "",
    signalText: (doc.body?.innerText || "").replace(/\s+/g, " ").toLowerCase(),
    structuredData: [],
    resources: { css: [], scripts: [], inlineScripts: [], inlineStyles: [] },
    resourceSummary: { assetCount: 0, inlineCount: 0, totalSources: 1 },
    evidenceBadges: ["HTML"],
    extractedSignals: [],
    domStats: {},
    commerceSignals: { stateSnippets: [], currencies: [], productHandles: [], reviewMentions: 0, trustMentions: 0, shippingMentions: 0 },
    platformApiSignals: { badges: [], urlHints: [], score: 0, assetCount: 0 },
    reliability: { score: 18, label: "Low" },
    assetText: "",
    inlineText: "",
    resourceHints: "",
    fetchMode: "blocked"
  };
}

async function buildAnalysisContext(doc, html, pageUrl) {
  const title = (doc.querySelector("title")?.textContent || "").trim();
  const metaDescription = (doc.querySelector('meta[name="description"]')?.getAttribute("content") || "").trim();
  const ogTitle = (doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || "").trim();
  const ogDescription = (doc.querySelector('meta[property="og:description"], meta[name="twitter:description"]')?.getAttribute("content") || "").trim();
  const canonicalUrl = (doc.querySelector('link[rel="canonical"]')?.getAttribute("href") || "").trim();
  const bodyText = ((doc.body?.innerText || stripHtmlToText(html) || "").replace(/\s+/g, " ").trim());
  const headingText = [...doc.querySelectorAll("h1, h2, h3")].map((el) => el.textContent.trim()).filter(Boolean).slice(0, 30).join(" ");
  const buttonText = [...doc.querySelectorAll('button, [role="button"], a, summary')].map((el) => el.textContent.trim()).filter(Boolean).slice(0, 60).join(" ");
  const altText = [...doc.querySelectorAll("img[alt]")].map((el) => el.getAttribute("alt")?.trim()).filter(Boolean).slice(0, 40).join(" ");
  const metaSignals = extractMetaSignals(doc, pageUrl);
  const structuredData = extractStructuredData(doc);
  const inlineSignals = extractInlineSignals(doc, html, pageUrl);
  const commerceSignals = extractCommerceSignals(doc, html, structuredData, inlineSignals, pageUrl);
  const linkedResources = await inspectLinkedResources(doc, pageUrl);
  const platformApiSignals = await inspectPlatformApiSignals(pageUrl, html, structuredData);
  const domStats = collectDomStats(doc, structuredData);
  const jsonLdText = structuredData.map((item) => item.text).join(" ");
  const assetText = [
    ...linkedResources.css.map((item) => item.text),
    ...linkedResources.scripts.map((item) => item.text),
    ...platformApiSignals.textSnippets
  ].join(" ");

  const signalText = [
    bodyText,
    title,
    metaDescription,
    ogTitle,
    ogDescription,
    canonicalUrl,
    headingText,
    buttonText,
    altText,
    jsonLdText,
    metaSignals.text,
    inlineSignals.text,
    commerceSignals.text,
    assetText,
    inlineSignals.urlHints.join(" "),
    linkedResources.urlHints.join(" "),
    platformApiSignals.urlHints.join(" ")
  ].join(" ").replace(/\s+/g, " ").toLowerCase();

  const evidenceBadges = ["HTML"];
  if (title || metaDescription) evidenceBadges.push("Meta");
  if (ogTitle || ogDescription || metaSignals.extraMetaCount) evidenceBadges.push("Open Graph");
  if (structuredData.length) evidenceBadges.push("JSON-LD");
  if (inlineSignals.inlineScripts) evidenceBadges.push("Inline JS");
  if (inlineSignals.inlineStyles) evidenceBadges.push("Inline CSS");
  if (commerceSignals.stateSnippets.length) evidenceBadges.push("App state");
  if (linkedResources.css.length) evidenceBadges.push("CSS");
  if (linkedResources.scripts.length) evidenceBadges.push("JS");
  if (platformApiSignals.badges.length) evidenceBadges.push(...platformApiSignals.badges);

  const extractedSignals = [
    title ? "Title" : "",
    metaDescription ? "Meta description" : "",
    ogTitle || ogDescription ? "Open Graph" : "",
    domStats.searchInputs ? "Search input" : "",
    domStats.ctaCount ? "CTA/button" : "",
    domStats.forms ? "Form" : "",
    domStats.productForms ? "Product form" : "",
    commerceSignals.priceSignals ? "Price signal" : "",
    commerceSignals.variantSignals ? "Variant signal" : "",
    commerceSignals.reviewMentions ? "Review signal" : "",
    commerceSignals.shippingMentions ? "Shipping/returns signal" : "",
    structuredData.some((item) => item.types.includes("Product")) ? "Product schema" : "",
    structuredData.some((item) => item.types.includes("AggregateRating") || item.types.includes("Review")) ? "Review schema" : "",
    domStats.reviewWidgets ? "Review widget" : "",
    domStats.faqBlocks ? "FAQ content" : "",
    platformApiSignals.badges.join(", ")
  ].filter(Boolean);

  const textStrength = Math.min(24, Math.round(bodyText.length / 220));
  const structuredStrength = Math.min(20, structuredData.length * 5);
  const linkedStrength = Math.min(20, linkedResources.assetCount * 4);
  const inlineStrength = Math.min(16, inlineSignals.inlineScripts + inlineSignals.inlineStyles * 2 + Math.min(6, inlineSignals.urlHints.length > 0 ? 4 : 0));
  const domStrength = Math.min(18, [domStats.ctaCount, domStats.forms, domStats.productForms, domStats.images > 2 ? 1 : 0, domStats.navLinks > 5 ? 1 : 0, domStats.structuredProductHints ? 1 : 0].reduce((sum, value) => sum + (value ? 3 : 0), 0));
  const commerceStrength = Math.min(18, (
    (commerceSignals.priceSignals ? 4 : 0)
    + (commerceSignals.variantSignals ? 4 : 0)
    + Math.min(4, commerceSignals.reviewMentions)
    + Math.min(3, commerceSignals.shippingMentions)
    + Math.min(3, commerceSignals.trustMentions)
  ));
  const platformStrength = Math.min(12, platformApiSignals.score || 0);
  const reliabilityScore = Math.max(30, Math.min(98,
    18
    + textStrength
    + (title ? 5 : 0)
    + (metaDescription ? 4 : 0)
    + (ogTitle || ogDescription ? 4 : 0)
    + structuredStrength
    + linkedStrength
    + inlineStrength
    + domStrength
    + commerceStrength
    + platformStrength
  ));

  return {
    url: pageUrl,
    title,
    metaDescription,
    ogTitle,
    ogDescription,
    canonicalUrl,
    signalText,
    structuredData,
    resources: linkedResources,
    resourceSummary: {
      assetCount: linkedResources.assetCount + platformApiSignals.assetCount,
      inlineCount: inlineSignals.inlineScripts + inlineSignals.inlineStyles + commerceSignals.stateSnippets.length,
      totalSources: linkedResources.assetCount + platformApiSignals.assetCount + inlineSignals.inlineScripts + inlineSignals.inlineStyles + commerceSignals.stateSnippets.length + structuredData.length + 1
    },
    evidenceBadges: [...new Set(evidenceBadges)].slice(0, 10),
    extractedSignals: [...new Set(extractedSignals)].slice(0, 12),
    domStats,
    commerceSignals,
    platformApiSignals,
    reliability: {
      score: reliabilityScore,
      label: reliabilityScore >= 80 ? "High" : reliabilityScore >= 50 ? "Medium" : "Low"
    },
    assetText,
    inlineText: `${inlineSignals.text} ${commerceSignals.text}`,
    resourceHints: [
      ...linkedResources.css.map((item) => item.url),
      ...linkedResources.scripts.map((item) => item.url),
      ...linkedResources.urlHints,
      ...inlineSignals.urlHints,
      ...platformApiSignals.urlHints,
      ...structuredData.flatMap((item) => item.types),
      ...commerceSignals.productHandles
    ].join(" "),
    fetchMode: "parsed"
  };
}

function extractInlineSignals(doc, html, pageUrl) {
  const inlineScripts = [...doc.querySelectorAll('script:not([src])')]
    .map((node) => (node.textContent || "").trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((text) => text.slice(0, MAX_INLINE_TEXT_CHARS));
  const inlineStyles = [...doc.querySelectorAll('style')]
    .map((node) => (node.textContent || "").trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((text) => text.slice(0, MAX_INLINE_TEXT_CHARS / 2));
  const appStateScripts = [...doc.querySelectorAll('script[type="application/json"], script[type*="json" i]')]
    .map((node) => (node.textContent || "").trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((text) => text.slice(0, MAX_INLINE_TEXT_CHARS));

  const combined = [...inlineScripts, ...inlineStyles, ...appStateScripts].join(" ");
  const urlHints = extractEmbeddedUrlsFromText(combined, pageUrl).slice(0, MAX_DISCOVERY_TEXT_URLS);
  return {
    inlineScripts: inlineScripts.length + appStateScripts.length,
    inlineStyles: inlineStyles.length,
    text: combined,
    urlHints
  };
}

function extractMetaSignals(doc, pageUrl) {
  const metaNodes = [...doc.querySelectorAll('meta[name], meta[property], meta[itemprop]')].slice(0, 40);
  const values = metaNodes.map((node) => `${node.getAttribute("name") || node.getAttribute("property") || node.getAttribute("itemprop")}: ${node.getAttribute("content") || ""}`.trim()).filter(Boolean);
  const links = [...doc.querySelectorAll('link[rel][href]')].slice(0, 20).map((node) => `${node.getAttribute("rel")}: ${normalizeDiscoveredUrl(node.getAttribute("href"), pageUrl) || node.getAttribute("href") || ""}`.trim()).filter(Boolean);
  return {
    text: [...values, ...links].join(" "),
    extraMetaCount: values.length + links.length
  };
}

function extractCommerceSignals(doc, html, structuredData, inlineSignals, pageUrl) {
  const textBank = [];
  const stateSnippets = [];
  const currencies = [...new Set((String(html || "").match(/(?:\$|€|£|USD|EUR|GBP|RON|CAD|AUD|JPY)/gi) || []).map((item) => item.toUpperCase()))].slice(0, 6);
  const productHandles = [];
  const reviewMentions = (String(html || "").match(/review|rating|stars?|testimonial|verified buyer/gi) || []).length;
  const trustMentions = (String(html || "").match(/secure|guarantee|money[- ]back|trusted|encrypted/gi) || []).length;
  const shippingMentions = (String(html || "").match(/shipping|delivery|returns?|refund|dispatch/gi) || []).length;
  const variantSignals = /size|color|variant|swatch|option[1-3]/i.test(`${inlineSignals.text} ${html}`) || !!doc.querySelector('[name*="option" i], [class*="variant" i], [class*="swatch" i], select');
  const priceSignals = hasCurrency(`${doc.body?.innerText || ""} ${html}`) || structuredData.some((item) => item.types.includes("Offer") || item.types.includes("Product"));

  [...doc.querySelectorAll('script[type="application/json"], script[type*="json" i], script:not([src])')]
    .slice(0, 12)
    .forEach((node) => {
      const raw = (node.textContent || "").trim();
      if (!raw) return;
      const snippet = raw.slice(0, MAX_INLINE_TEXT_CHARS);
      if (/("variants"|"product"|"price"|"compare_at_price"|"inventory"|"sku"|"vendor"|"available")/i.test(snippet)) {
        stateSnippets.push(snippet);
        textBank.push(snippet);
      }
      const handleMatches = snippet.match(/"handle"\s*:\s*"([^"]+)"/gi) || [];
      handleMatches.forEach((match) => {
        const found = match.match(/"handle"\s*:\s*"([^"]+)"/i);
        if (found?.[1]) productHandles.push(found[1]);
      });
    });

  [...doc.querySelectorAll('[itemprop], [itemtype], [data-product], [data-product-id], [data-section-type], [data-cart-item-title]')]
    .slice(0, 50)
    .forEach((node) => {
      const attrs = [
        node.getAttribute('itemprop'),
        node.getAttribute('itemtype'),
        node.getAttribute('data-product'),
        node.getAttribute('data-product-id'),
        node.getAttribute('data-section-type'),
        node.getAttribute('data-cart-item-title')
      ].filter(Boolean);
      if (attrs.length) textBank.push(attrs.join(' '));
    });

  structuredData.forEach((item) => {
    if (item.raw) textBank.push(item.raw.slice(0, 4000));
  });

  return {
    text: textBank.join(' '),
    stateSnippets: stateSnippets.slice(0, 6),
    currencies,
    productHandles: [...new Set(productHandles)].slice(0, 8),
    reviewMentions,
    trustMentions,
    shippingMentions,
    variantSignals,
    priceSignals
  };
}

async function inspectPlatformApiSignals(pageUrl, html, structuredData) {
  const output = { textSnippets: [], urlHints: [], badges: [], score: 0, assetCount: 0 };
  const lower = String(html || '').toLowerCase();
  const base = pageUrl || '';
  if (!base) return output;

  if (/shopify|cdn\.shopify\.com|myshopify\.com/.test(lower) || structuredData.some((item) => item.types.includes('Product'))) {
    const productsEndpoint = normalizeDiscoveredUrl('/products.json?limit=12', base);
    if (productsEndpoint) {
      const response = await fetchTextResource(productsEndpoint);
      if (response.ok && /^\s*[\[{]/.test(response.text)) {
        output.badges.push('Shop API');
        output.assetCount += 1;
        output.score += 6;
        output.textSnippets.push(response.text.slice(0, 12000));
        try {
          const parsed = JSON.parse(response.text);
          const items = Array.isArray(parsed?.products) ? parsed.products : (Array.isArray(parsed) ? parsed : []);
          items.slice(0, 12).forEach((item) => {
            const handle = item?.handle;
            if (handle) output.urlHints.push(normalizeDiscoveredUrl(`/products/${handle}`, base));
          });
        } catch (error) {}
      }
    }

    const collectionsEndpoint = normalizeDiscoveredUrl('/collections.json?limit=12', base);
    if (collectionsEndpoint) {
      const response = await fetchTextResource(collectionsEndpoint);
      if (response.ok && /^\s*[\[{]/.test(response.text)) {
        output.badges.push('Collections API');
        output.assetCount += 1;
        output.score += 4;
        output.textSnippets.push(response.text.slice(0, 8000));
        try {
          const parsed = JSON.parse(response.text);
          const items = Array.isArray(parsed?.collections) ? parsed.collections : [];
          items.slice(0, 12).forEach((item) => {
            const handle = item?.handle;
            if (handle) output.urlHints.push(normalizeDiscoveredUrl(`/collections/${handle}`, base));
          });
        } catch (error) {}
      }
    }
  }

  output.urlHints = [...new Set(output.urlHints.filter(Boolean))].slice(0, MAX_DISCOVERY_TEXT_URLS);
  return output;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => run());
  await Promise.all(runners);
  return results;
}

function collectDomStats(doc, structuredData) {
  return {
    headings: doc.querySelectorAll('h1, h2, h3').length,
    buttons: doc.querySelectorAll('button, [role="button"]').length,
    ctaCount: [...doc.querySelectorAll('button, a, [role="button"]')].filter((el) => /shop|buy|cart|checkout|discover|learn more|start|subscribe/i.test(el.textContent || "")).length,
    forms: doc.querySelectorAll('form').length,
    productForms: doc.querySelectorAll('form[action*="/cart"], [data-product], [itemtype*="Product"]').length + (structuredData.some((item) => item.types.includes('Product')) ? 1 : 0),
    searchInputs: doc.querySelectorAll('input[type="search"], [role="search"], form[action*="search" i]').length,
    navLinks: doc.querySelectorAll('header a[href], nav a[href]').length,
    images: doc.querySelectorAll('img, picture source').length,
    accordions: doc.querySelectorAll('details, summary, [aria-expanded]').length,
    reviewWidgets: doc.querySelectorAll('[class*="review" i], [data-rating], [itemprop="review"], [itemprop="aggregateRating"]').length,
    faqBlocks: doc.querySelectorAll('[class*="faq" i], [id*="faq" i], details').length,
    trustMentions: [...doc.querySelectorAll('body *')].filter((el) => /secure|returns|refund|guarantee|shipping/i.test((el.textContent || "").slice(0, 80))).length
  };
}

function extractEmbeddedUrlsFromText(text, baseUrl) {
  const matches = String(text || "").match(/https?:\/\/[^\s"'<>]+|\/(products?|collections?|category|categories|catalog|shop|store|item|p)\/[^\s"'<>]+/gi) || [];
  return [...new Set(matches.map((value) => normalizeDiscoveredUrl(value, baseUrl)).filter(Boolean))];
}

function extractStructuredData(doc) {
  return [...doc.querySelectorAll('script[type="application/ld+json"]')].map((node) => {
    const raw = (node.textContent || "").trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const flat = Array.isArray(parsed) ? parsed : [parsed];
      const types = [];
      flat.forEach((item) => collectJsonLdTypes(item, types));
      return { raw, text: JSON.stringify(parsed).slice(0, MAX_LINKED_RESOURCE_CHARS), types: [...new Set(types)] };
    } catch (error) {
      return { raw, text: raw.slice(0, MAX_LINKED_RESOURCE_CHARS), types: [] };
    }
  }).filter(Boolean);
}

function collectJsonLdTypes(value, bucket) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLdTypes(item, bucket));
    return;
  }
  if (typeof value !== "object") return;
  const rawType = value["@type"];
  if (Array.isArray(rawType)) rawType.forEach((item) => item && bucket.push(String(item)));
  else if (rawType) bucket.push(String(rawType));
  if (value["@graph"]) collectJsonLdTypes(value["@graph"], bucket);
}


async function inspectLinkedResources(doc, pageUrl) {
  const cssUrls = getInspectableResourceUrls(doc, pageUrl, 'link[rel*="stylesheet"][href]', 'href', MAX_LINKED_STYLESHEETS);
  const scriptUrls = getInspectableResourceUrls(doc, pageUrl, 'script[src]', 'src', MAX_LINKED_SCRIPTS);
  const urlHints = [];

  const css = (await mapWithConcurrency(cssUrls, RESOURCE_FETCH_CONCURRENCY, async (url) => {
    const text = await fetchLinkedResourceText(url);
    if (!text) return null;
    urlHints.push(...extractEmbeddedUrlsFromText(text, pageUrl));
    return { url, text };
  })).filter(Boolean);

  const scripts = (await mapWithConcurrency(scriptUrls, RESOURCE_FETCH_CONCURRENCY, async (url) => {
    const text = await fetchLinkedResourceText(url);
    if (!text) return null;
    urlHints.push(...extractEmbeddedUrlsFromText(text, pageUrl));
    return { url, text };
  })).filter(Boolean);

  return { css, scripts, assetCount: css.length + scripts.length, urlHints: [...new Set(urlHints)].slice(0, MAX_DISCOVERY_TEXT_URLS) };
}

function getInspectableResourceUrls(doc, pageUrl, selector, attribute, limit) {
  const origin = safeHostname(pageUrl);
  const urls = [];
  [...doc.querySelectorAll(selector)].forEach((node) => {
    const raw = node.getAttribute(attribute);
    if (!raw || urls.length >= limit) return;
    try {
      const resolved = new URL(raw, pageUrl).toString();
      if (safeHostname(resolved) !== origin) return;
      if (!urls.includes(resolved)) urls.push(resolved);
    } catch (error) {
      return;
    }
  });
  return urls;
}


async function fetchLinkedResourceText(url) {
  const result = await fetchTextResource(url);
  return result.ok ? result.text.slice(0, MAX_LINKED_RESOURCE_CHARS) : "";
}

function truncateText(value, maxLength = 90) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function validateFreePlanScope(plan, configuredPages) {
  if (plan !== "free") {
    return { allowed: true };
  }

  const normalizedUrls = configuredPages
    .map((page) => normalizeAuditUrl(page.url))
    .filter(Boolean);

  if (!normalizedUrls.length) {
    return { allowed: true };
  }

  const storefronts = [...new Set(normalizedUrls.map((item) => item.storefrontKey))];
  if (storefronts.length > 1) {
    return {
      allowed: false,
      message: "Free plan can analyze only one storefront at a time. Please keep all URLs on the same storefront or switch to Pro."
    };
  }


  const storefrontKey = storefronts[0];
  const ledger = getFreePlanUsageLedger();
  const existingEntry = ledger[storefrontKey];

  if (!existingEntry) {
    return { allowed: true };
  }

  const currentSet = [...new Set(normalizedUrls.map((item) => item.pageKey))].sort();
  const lockedSet = [...new Set(existingEntry.pageKeys || [])].sort();
  const isSameSet = currentSet.length === lockedSet.length && currentSet.every((value, index) => value === lockedSet[index]);

  if (!isSameSet) {
    return {
      allowed: false,
      message: `Free plan already locked a storefront sample for ${storefrontKey}. You can re-run the same saved sample, but you cannot add new page URLs little by little to audit the full site. Upgrade to Pro to analyze additional pages.`
    };
  }

  return { allowed: true };
}

function persistFreePlanScope(configuredPages) {
  const normalizedUrls = configuredPages
    .map((page) => normalizeAuditUrl(page.url))
    .filter(Boolean);

  if (!normalizedUrls.length) return;

  const storefrontKey = normalizedUrls[0].storefrontKey;
  const ledger = getFreePlanUsageLedger();
  const pageKeys = [...new Set(normalizedUrls.map((item) => item.pageKey))].sort();
  const entry = ledger[storefrontKey] || {
    storefrontKey,
    firstLockedAt: new Date().toISOString()
  };

  entry.pageKeys = pageKeys;
  entry.lastUsedAt = new Date().toISOString();
  entry.urlCount = pageKeys.length;
  ledger[storefrontKey] = entry;

  writeFreePlanUsageLedger(ledger);
}

function getFreePlanUsageLedger() {
  const combined = [
    readJsonStorage(localStorage, FREE_PLAN_USAGE_KEY),
    readJsonStorage(sessionStorage, FREE_PLAN_USAGE_KEY),
    readCookieJson(FREE_PLAN_USAGE_COOKIE)
  ];

  return combined.reduce((acc, part) => mergeUsageLedgers(acc, part), {});
}

function writeFreePlanUsageLedger(ledger) {
  const serialized = JSON.stringify(ledger);
  try {
    localStorage.setItem(FREE_PLAN_USAGE_KEY, serialized);
  } catch (error) {}
  try {
    sessionStorage.setItem(FREE_PLAN_USAGE_KEY, serialized);
  } catch (error) {}
  setCookie(FREE_PLAN_USAGE_COOKIE, serialized, 3650);
}

function mergeUsageLedgers(base, extra) {
  const output = { ...(base || {}) };
  Object.entries(extra || {}).forEach(([storefrontKey, entry]) => {
    const current = output[storefrontKey];
    if (!current) {
      output[storefrontKey] = entry;
      return;
    }

    const currentTime = Date.parse(current.lastUsedAt || current.firstLockedAt || 0) || 0;
    const incomingTime = Date.parse(entry.lastUsedAt || entry.firstLockedAt || 0) || 0;
    output[storefrontKey] = incomingTime >= currentTime ? { ...current, ...entry } : { ...entry, ...current };
  });
  return output;
}

function readJsonStorage(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || "{}");
  } catch (error) {
    return {};
  }
}

function readCookieJson(name) {
  try {
    const value = getCookie(name);
    return value ? JSON.parse(value) : {};
  } catch (error) {
    return {};
  }
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + (days * 24 * 60 * 60 * 1000)).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length)
    ? decodeURIComponent(document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(prefix))
      .slice(prefix.length))
    : "";
}

function normalizeAuditUrl(value) {
  try {
    const url = new URL(value);
    const path = normalizePath(url.pathname);
    const storefrontKey = getStorefrontKey(url.hostname);
    const pageKey = `${storefrontKey}${path}`;
    return {
      storefrontKey,
      pageKey,
      hostname: url.hostname.toLowerCase(),
      path
    };
  } catch (error) {
    return null;
  }
}

function normalizePath(pathname) {
  const path = (pathname || "/")
    .replace(/\/+$/, "")
    .toLowerCase();
  return path || "/";
}

function getStorefrontKey(hostname) {
  const clean = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^www\d*\./, "");

  const parts = clean.split(".").filter(Boolean);
  if (parts.length <= 2) return clean;

  const tail3 = parts.slice(-3).join(".");
  const tail2 = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.includes(parts.slice(-2).join("."))) {
    return parts.slice(-3).join(".");
  }
  if (MULTI_PART_TLDS.includes(tail3)) {
    return parts.slice(-4).join(".");
  }

  return tail2;
}

function saveReport(report) {
  const existing = JSON.parse(localStorage.getItem("croSavedReports") || "[]");
  existing.unshift(report);
  localStorage.setItem("croSavedReports", JSON.stringify(existing.slice(0, 20)));
  renderTrendChart();
}

function renderSavedReports() {
  const reports = JSON.parse(localStorage.getItem("croSavedReports") || "[]");
  const container = document.getElementById("savedReports");

  if (!reports.length) {
    container.className = "saved-reports empty-state";
    container.textContent = "No saved reports yet.";
    return;
  }

  container.className = "saved-reports";
  container.innerHTML = reports.map((report) => `
    <article class="report-card">
      <div class="report-top">
        <div>
          <div class="report-title">${escapeHtml(report.projectName)}</div>
          <p>${new Date(report.createdAt).toLocaleString()}</p>
        </div>
        <span class="tag info">${escapeHtml(report.plan.toUpperCase())}</span>
      </div>
      <div class="tag-row">
        <span class="tag">${report.overallScore}/100 CRO score</span>
        <span class="tag">${report.pagesAnalyzed} pages</span>
        <span class="tag">${report.criticalIssues} critical issues</span>
      </div>
      <div class="report-actions">
        <button class="secondary-button" type="button" onclick="downloadStoredReport('${report.id}')">Download JSON</button>
        <button class="secondary-button" type="button" onclick="downloadStoredReportPdf('${report.id}')">Download PDF</button>
        <button class="secondary-button" type="button" onclick="loadStoredReport('${report.id}')">Load summary</button>
        <button class="secondary-button" type="button" onclick="deleteStoredReport('${report.id}')">Delete</button>
      </div>
    </article>
  `).join("");
}

function loadStoredReport(reportId) {
  const reports = JSON.parse(localStorage.getItem("croSavedReports") || "[]");
  const report = reports.find((item) => item.id === reportId);
  if (!report) return;
  STATE.latestReport = report;
  renderReport(report);
}

function deleteStoredReport(reportId) {
  const reports = JSON.parse(localStorage.getItem("croSavedReports") || "[]");
  const filtered = reports.filter((item) => item.id !== reportId);
  localStorage.setItem("croSavedReports", JSON.stringify(filtered));
  renderSavedReports();
  renderTrendChart();
}

function exportLatestReport() {
  if (!STATE.latestReport) {
    alert("Run an analysis first.");
    return;
  }
  downloadJson(STATE.latestReport, `${slugify(STATE.latestReport.projectName)}-report.json`);
}

function exportLatestPdf() {
  if (!STATE.latestReport) {
    alert("Run an analysis first.");
    return;
  }
  downloadPdfReport(STATE.latestReport);
}

function exportLatestReportPdf() {
  if (!STATE.latestReport) {
    alert("Run an analysis first.");
    return;
  }
  downloadPdfReport(STATE.latestReport);
}

function downloadStoredReportPdf(reportId) {
  const reports = JSON.parse(localStorage.getItem("croSavedReports") || "[]");
  const report = reports.find((item) => item.id === reportId);
  if (!report) return;
  downloadPdfReport(report);
}

function downloadPdfReport(report) {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    alert("PDF library could not be loaded.");
    return;
  }
  const doc = new jsPDF();
  const lines = [
    report.projectName,
    `Plan: ${report.plan.toUpperCase()}`,
    `Public storefront CRO Score: ${report.overallScore}/100`,
    `Critical issues: ${report.criticalIssues}`,
    `Pages analyzed: ${report.pagesAnalyzed}`,
    `Estimated revenue opportunity: ${report.revenueOpportunity || estimateRevenueOpportunity(report.overallScore, report.criticalIssues, report.pagesAnalyzed)}%`,
    report.stackSummary?.platform ? `Platform: ${report.stackSummary.platform}` : "",
    report.stackSummary?.apps?.length ? `Apps: ${report.stackSummary.apps.join(', ')}` : "",
    "",
    "Top recommendations:"
  ].filter(Boolean);
  (report.recommendations || []).slice(0, 12).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.title}`);
    lines.push(`Issue: ${getIssueText(item)}`);
    lines.push(`Solution: ${getSolutionText(item)}`);
    lines.push("");
  });
  let y = 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(report.projectName, 14, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  lines.slice(1).forEach((line) => {
    const wrapped = doc.splitTextToSize(line, 180);
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(wrapped, 14, y);
    y += (wrapped.length * 6);
  });
  doc.save(`${slugify(report.projectName)}-report.pdf`);
}

function downloadStoredReport(reportId) {
  const reports = JSON.parse(localStorage.getItem("croSavedReports") || "[]");
  const report = reports.find((item) => item.id === reportId);
  if (!report) return;
  downloadJson(report, `${slugify(report.projectName)}-report.json`);
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(blobUrl);
}

function rule(id, label, weight, tier, test) {
  return { id, label, weight, tier, test };
}

function hasTitle(doc) {
  return (doc.querySelector("title")?.textContent || "").trim().length > 0;
}

function hasPrimaryCTA(doc, text) {
  if (doc.querySelector('button, a[class*="button"], [role="button"]')) {
    const candidates = [...doc.querySelectorAll('button, a, [role="button"]')].slice(0, 20);
    if (candidates.some((el) => /shop|buy|discover|learn more|add to cart|start/i.test(el.textContent || ""))) {
      return true;
    }
  }
  return hasAny(text, ["shop now", "buy now", "discover", "start here", "add to cart"]);
}

function hasAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase.toLowerCase()));
}

function hasCurrency(text) {
  return /(\$|€|£|ron|usd|eur)\s?\d|(\d[\d,.]*)\s?(\$|€|£|ron|usd|eur)/i.test(text);
}

function hasStructuredDataType(context, ...types) {
  const bucket = new Set((context?.structuredData || []).flatMap((item) => item.types || []).map((item) => String(item).toLowerCase()));
  return types.some((type) => bucket.has(String(type).toLowerCase()));
}

function impactRank(label) {
  if (label === "High") return 3;
  if (label === "Medium") return 2;
  return 1;
}

function impactClass(label) {
  if (label === "High") return "danger";
  if (label === "Medium") return "warn";
  return "success";
}

function slugify(value) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function shortDisplayUrl(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch (error) {
    return value;
  }
}

function escapeAttribute(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}



let screenshotModalInstance = null;
let screenshotModalImage = null;

function ensureScreenshotModal() {
  if (screenshotModalInstance) return;

  screenshotModalInstance = document.createElement("div");
  screenshotModalInstance.id = "screenshotModal";
  screenshotModalInstance.innerHTML = `
    <div class="screenshot-modal-backdrop"></div>
    <div class="screenshot-modal-content">
      <div class="screenshot-modal-spinner" id="screenshotModalSpinner"></div>
      <img id="screenshotModalImage" src="" alt="Screenshot preview" loading="eager" decoding="async"/>
    </div>
  `;
  document.body.appendChild(screenshotModalInstance);

  screenshotModalImage = screenshotModalInstance.querySelector("#screenshotModalImage");

  screenshotModalInstance.addEventListener("click", (e) => {
    if (e.target.id === "screenshotModal" || e.target.classList.contains("screenshot-modal-backdrop")) {
      screenshotModalInstance.classList.remove("visible", "loaded");
      if (screenshotModalImage) {
        screenshotModalImage.removeAttribute("src");
      }
    }
  });
}

function openScreenshotModal(src) {
  ensureScreenshotModal();
  if (!screenshotModalInstance || !screenshotModalImage || !src) return;

  screenshotModalInstance.classList.add("visible");
  screenshotModalInstance.classList.remove("loaded");

  const preload = new Image();
  preload.decoding = "async";
  preload.onload = () => {
    screenshotModalImage.src = src;
    screenshotModalInstance.classList.add("loaded");
  };
  preload.onerror = () => {
    screenshotModalImage.src = src;
    screenshotModalInstance.classList.add("loaded");
  };
  preload.src = src;
}

document.addEventListener("click", (e) => {
  const img = e.target.closest(".screenshot-thumb");
  if (!img) return;
  const src = img.currentSrc || img.src;
  if (!src) return;
  openScreenshotModal(src);
});

document.addEventListener("mouseover", (e) => {
  const img = e.target.closest(".screenshot-thumb");
  if (!img) return;
  const src = img.currentSrc || img.src;
  if (!src || img.dataset.preloaded === "true") return;
  const preload = new Image();
  preload.decoding = "async";
  preload.src = src;
  img.dataset.preloaded = "true";
});



document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && screenshotModalInstance) {
    screenshotModalInstance.classList.remove("visible", "loaded");
    if (screenshotModalImage) {
      screenshotModalImage.removeAttribute("src");
    }
  }
});
