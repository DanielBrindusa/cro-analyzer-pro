

const STATE = {
  plan: "free",
  latestReport: null,
  productRows: 0
};

const PRO_PAYMENT_LINK = "REPLACE_WITH_YOUR_STRIPE_PAYMENT_LINK";
const PRO_UNLOCK_STORAGE_KEY = "croProAccessUnlocked";
const FETCH_TIMEOUT_MS = 12000;
const SPEED_TIMEOUT_MS = 12000;

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
    rule("product-price", "Product price is visible", 3, "basic", ({ text, context }) => hasCurrency(text) || hasStructuredDataType(context, "Offer", "Product")),
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

async function runAnalysis() {
  const analyzeButton = document.getElementById("analyzeButton");
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

  const freePlanGuard = validateFreePlanScope(plan, configuredPages);
  if (!freePlanGuard.allowed) {
    alert(freePlanGuard.message);
    return;
  }

  analyzeButton.disabled = true;
  startProgress(Math.max((configuredPages.length || 1) + 4, 5));
  setProgressValue(4, "Starting analysis...", "Preparing your audit and checking the provided URLs.");
  await waitForNextPaint();

  const homeSeedUrl = document.getElementById("homeUrl")?.value.trim() || configuredPages.find((page) => page.type === "home")?.url || "";
  if (homeSeedUrl && (!configuredPages.some((page) => page.type === "category") || !configuredPages.some((page) => page.type === "product"))) {
    updateProgress(0.4, Math.max((configuredPages.length || 1) + 4, 5), "Discovering category and product URLs...");
    await waitForNextPaint();
    STATE.discovered = await discoverUrlsForAudit(homeSeedUrl);
    renderDiscoveredUrls(STATE.discovered);
    autoFillDiscoveredUrls(STATE.discovered, plan);
    configuredPages = buildPageTargets();
    updateProgress(0.8, Math.max((configuredPages.length || 1) + 4, 5), "Suggested URLs found. Preparing the full analysis...");
    await waitForNextPaint();
  }

  try {
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

    if (!configuredPages.length) {
      updateProgress(1, 1, "No page URLs were provided. Building a manual CRO review report...");
      await wait(350);
    }

    for (let index = 0; index < configuredPages.length; index += 1) {
      const target = configuredPages[index];
      updateProgress(index, configuredPages.length, `Fetching ${target.label}...`);
      const fetchResult = await fetchPageHtml(target.url);
      fetchResult.url = target.url;
      updateProgress(index + 0.5, configuredPages.length, `Scoring ${target.label}...`);
      const pageAnalysis = analyzePage(target.type, fetchResult, plan);

      pageResults.push({
        ...target,
        ...pageAnalysis
      });

      if (target.type === "home" && pageAnalysis.stack) {
        stackSummary = pageAnalysis.stack;
        updateProgress(index + 0.75, configuredPages.length + 2, "Checking homepage performance signals...");
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

      updateProgress(index + 1, configuredPages.length, `${target.label} analyzed.`);
      await wait(150);
    }

    updateProgress(configuredPages.length || 1, configuredPages.length || 1, "Compiling CRO recommendations...");
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
      revenueOpportunity: estimateRevenueOpportunity(overallScore, criticalIssues, configuredPages.length)
    };

    hydrateReportLinks(report);
    STATE.latestReport = report;
    saveReport(report);
    renderReport(report);
    renderSavedReports();
    completeProgress(`Analysis complete. ${report.pagesAnalyzed} page${report.pagesAnalyzed === 1 ? "" : "s"} processed.`);
  } catch (error) {
    failProgress("The analysis stopped unexpectedly. Please try again.");
    console.error(error);
  } finally {
    analyzeButton.disabled = false;
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

function startProgress(totalSteps) {
  const panel = document.getElementById("analysisProgress");
  panel.classList.remove("hidden");
  setProgressValue(3, "Preparing analysis...", "The app is getting your audit ready.");
  panel.dataset.totalSteps = String(Math.max(totalSteps, 1));
  revealAnalysisProgress();
}

function updateProgress(completedSteps, totalSteps, statusText) {
  const safeTotal = Math.max(totalSteps, 1);
  const ratio = Math.max(0.08, Math.min(completedSteps / safeTotal, 0.94));
  setProgressValue(Math.round(ratio * 100), "Running analysis...", statusText);
}

function completeProgress(statusText) {
  setProgressValue(100, "Analysis complete", statusText);
  revealAnalysisProgress();
}

function failProgress(statusText) {
  const title = document.getElementById("progressTitle");
  title.textContent = "Analysis failed";
  title.classList.add("progress-error");
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
  status.textContent = statusText;
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

  const seen = new Set();
  return targets
    .map((target) => {
      try {
        const normalizedUrl = new URL(target.url).toString();
        return { ...target, url: normalizedUrl };
      } catch (error) {
        return target;
      }
    })
    .filter((target) => {
      const key = `${target.type}::${target.url}`;
      if (!target.url || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function readStableHtmlCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STABLE_HTML_CACHE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeStableHtmlCache(cache) {
  try {
    const entries = Object.entries(cache || {})
      .sort((a, b) => (b[1]?.savedAt || 0) - (a[1]?.savedAt || 0))
      .slice(0, STABLE_CACHE_MAX_ENTRIES);
    localStorage.setItem(STABLE_HTML_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch (error) {
    // Ignore storage errors in locked-down browsers.
  }
}

function normalizeFetchedHtml(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (match) => match.length > 20000 ? match.slice(0, 20000) : match)
    .replace(/nonce=(['"]).*?\1/gi, 'nonce=""')
    .replace(/integrity=(['"]).*?\1/gi, 'integrity=""')
    .replace(/\bdata-time(?:stamp)?=(['"]).*?\1/gi, 'data-time=""');
}

function scoreHtmlQuality(html) {
  const lower = String(html || "").toLowerCase();
  if (!lower || lower.length < 300) return 0;
  let score = Math.min(60, Math.floor(lower.length / 3000));
  if (/<title[\s>]/i.test(lower)) score += 8;
  if (/<h1[\s>]/i.test(lower)) score += 8;
  if (/add to cart|buy now|product|collection|checkout|price|review/i.test(lower)) score += 12;
  if (/application\/ld\+json/i.test(lower)) score += 8;
  if (/<meta[^>]+description/i.test(lower)) score += 4;
  if (/<a[\s>]/i.test(lower)) score += 3;
  return score;
}

function getStableFetchCacheKey(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch (error) {
    return String(url || "").trim();
  }
}

function getCachedFetchResult(url) {
  const cacheKey = getStableFetchCacheKey(url);
  const sessionCached = PAGE_FETCH_CACHE.get(cacheKey);
  if (sessionCached && (Date.now() - (sessionCached.savedAt || 0)) < STABLE_CACHE_TTL_MS) {
    return { ...sessionCached, fromCache: true, cacheLayer: "memory" };
  }

  const persistentCache = readStableHtmlCache();
  const entry = persistentCache[cacheKey];
  if (entry && (Date.now() - (entry.savedAt || 0)) < STABLE_CACHE_TTL_MS) {
    PAGE_FETCH_CACHE.set(cacheKey, entry);
    return { ...entry, fromCache: true, cacheLayer: "storage" };
  }

  return null;
}

function persistFetchResult(url, result) {
  if (!result?.ok || !result?.html) return;
  const cacheKey = getStableFetchCacheKey(url);
  const payload = {
    ok: true,
    html: normalizeFetchedHtml(result.html),
    source: result.source || "direct",
    url: result.url || url,
    qualityScore: result.qualityScore || scoreHtmlQuality(result.html),
    savedAt: Date.now(),
    attemptedSources: result.attemptedSources || [result.source || "direct"]
  };
  PAGE_FETCH_CACHE.set(cacheKey, payload);
  const persistentCache = readStableHtmlCache();
  persistentCache[cacheKey] = payload;
  writeStableHtmlCache(persistentCache);
}

async function fetchTextCandidate(url, label) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal, cache: "no-store" });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const text = await response.text();
    if (!text || text.length < 300) return null;
    const normalized = normalizeFetchedHtml(text);
    return {
      ok: true,
      html: normalized,
      source: label,
      qualityScore: scoreHtmlQuality(normalized),
      attemptedSources: [label]
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return null;
  }
}

async function fetchBestLiveHtml(url) {
  const normalizedTarget = getStableFetchCacheKey(url);
  const attempts = [
    { type: "direct", url: normalizedTarget },
    { type: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(normalizedTarget)}` },
    { type: "corsproxy", url: `https://corsproxy.io/?${encodeURIComponent(normalizedTarget)}` }
  ];

  const candidates = [];
  for (const attempt of attempts) {
    for (let retry = 0; retry < FETCH_RETRY_COUNT; retry += 1) {
      const candidate = await fetchTextCandidate(attempt.url, attempt.type);
      if (candidate) {
        candidates.push(candidate);
        break;
      }
    }
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const qualityDelta = (b.qualityScore || 0) - (a.qualityScore || 0);
    if (qualityDelta !== 0) return qualityDelta;
    return String(a.source || "").localeCompare(String(b.source || ""));
  });

  const best = candidates[0];
  return {
    ...best,
    ok: true,
    url: normalizedTarget,
    attemptedSources: [...new Set(candidates.map((item) => item.source))]
  };
}

function extractStructuredData(doc) {
  const items = [];
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    const raw = script.textContent?.trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const queue = Array.isArray(parsed) ? parsed : [parsed];
      queue.forEach((item) => items.push(item));
    } catch (error) {
      // Ignore malformed JSON-LD blocks.
    }
  });
  return items;
}

function collectStructuredTypes(value, bucket = new Set()) {
  if (!value) return bucket;
  if (Array.isArray(value)) {
    value.forEach((item) => collectStructuredTypes(item, bucket));
    return bucket;
  }
  if (typeof value === "object") {
    const type = value['@type'];
    if (Array.isArray(type)) type.forEach((entry) => bucket.add(String(entry)));
    else if (type) bucket.add(String(type));
    Object.values(value).forEach((entry) => collectStructuredTypes(entry, bucket));
  }
  return bucket;
}

function hasStructuredDataType(context, ...types) {
  const available = new Set((context?.structuredTypes || []).map((item) => String(item).toLowerCase()));
  return types.some((type) => available.has(String(type).toLowerCase()));
}

function buildAnalysisContext(doc, html, url) {
  const metaDescription = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || "";
  const structuredData = extractStructuredData(doc);
  const structuredTypes = [...collectStructuredTypes(structuredData)].sort();
  const linkHrefs = [...doc.querySelectorAll('a[href]')]
    .map((link) => link.getAttribute('href'))
    .filter(Boolean)
    .slice(0, 400);
  const imageAltCount = [...doc.querySelectorAll('img[alt]')].filter((img) => (img.getAttribute('alt') || '').trim().length > 1).length;
  const imageCount = doc.querySelectorAll('img').length;
  const canonicalUrl = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || url || "";
  return {
    metaDescription,
    structuredData,
    structuredTypes,
    canonicalUrl,
    linkHrefs,
    imageAltCount,
    imageCount,
    hasSearchInput: !!doc.querySelector('input[type="search"], [role="search"], form[action*="search" i]'),
    hasEmailCapture: !!doc.querySelector('input[type="email"]'),
    hasBreadcrumbs: !!doc.querySelector('nav[aria-label*="breadcrumb" i], [class*="breadcrumb" i]'),
    hasProductSchema: hasStructuredDataType({ structuredTypes }, 'Product', 'Offer'),
    hasReviewSchema: hasStructuredDataType({ structuredTypes }, 'AggregateRating', 'Review'),
    fetchUrl: url || ""
  };
}

async function discoverUrlsForAudit(homeUrl) {
  const discovered = { categories: [], products: [] };
  const fetchResult = await fetchPageHtml(homeUrl);
  if (!fetchResult.ok) return discovered;

  const merged = discoverUrlsFromHtml(fetchResult.html, homeUrl);
  discovered.categories.push(...merged.categories);
  discovered.products.push(...merged.products);

  try {
    const home = new URL(homeUrl);
    const robotsUrl = `${home.origin}/robots.txt`;
    const robotsResult = await fetchPageHtml(robotsUrl, { preferFresh: true, allowCacheFallback: true });
    if (robotsResult.ok) {
      const sitemapMatches = [...robotsResult.html.matchAll(/sitemap:\s*(https?:[^\s]+)/gi)].map((match) => match[1]);
      for (const sitemapUrl of sitemapMatches.slice(0, MAX_DISCOVERY_SITEMAPS)) {
        const sitemapResult = await fetchPageHtml(sitemapUrl, { preferFresh: true, allowCacheFallback: true });
        if (!sitemapResult.ok) continue;
        const urlMatches = [...sitemapResult.html.matchAll(/<loc>(.*?)<\/loc>/gi)].map((match) => match[1]).slice(0, MAX_DISCOVERY_URLS_FROM_SITEMAP);
        const additional = discoverUrlsFromHtml(urlMatches.map((loc) => `<a href="${loc}"></a>`).join(''), homeUrl);
        discovered.categories.push(...additional.categories);
        discovered.products.push(...additional.products);
      }
    }
  } catch (error) {
    // Keep homepage-based discovery only.
  }

  discovered.categories = [...new Set(discovered.categories)].sort().slice(0, MAX_AUTO_DISCOVERED_CATEGORIES);
  discovered.products = [...new Set(discovered.products)].sort().slice(0, MAX_AUTO_DISCOVERED_PRODUCTS);
  return discovered;
}

async function fetchPageHtml(url, options = {}) {
  const { preferFresh = false, allowCacheFallback = true } = options;
  const cached = getCachedFetchResult(url);
  if (cached && !preferFresh) {
    return { ...cached, url: cached.url || url };
  }

  const live = await fetchBestLiveHtml(url);
  if (live?.ok) {
    if (cached && cached.ok && STABLE_ANALYSIS_MODE) {
      const liveQuality = live.qualityScore || 0;
      const cachedQuality = cached.qualityScore || 0;
      if (cachedQuality > liveQuality + 6) {
        return { ...cached, url: cached.url || url, usedStableSnapshot: true };
      }
    }
    persistFetchResult(url, live);
    return live;
  }

  if (allowCacheFallback && cached?.ok) {
    return { ...cached, url: cached.url || url, usedStableSnapshot: true };
  }

  return {
    ok: false,
    html: "",
    source: "blocked",
    url,
    attemptedSources: ["direct", "allorigins", "corsproxy"]
  };
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

function detectStoreStack(doc, text, html, url) {
  const lowerHtml = String(html || "").toLowerCase();
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
    ["Shop Pay", /shop pay/i]
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

function discoverUrlsFromHtml(html, baseUrl) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const base = new URL(baseUrl);
    const links = [...doc.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href'))
      .filter(Boolean)
      .map((href) => {
        try { return new URL(href, base).toString(); } catch (error) { return null; }
      })
      .filter(Boolean)
      .filter((href) => safeHostname(href) === safeHostname(baseUrl));

    const scoreUrl = (href) => {
      try {
        const parsed = new URL(href);
        const path = parsed.pathname.toLowerCase();
        let score = 0;
        if (/\/(collections|category|catalog|shop)(\/|$)/i.test(path)) score += 10;
        if (/\/(products|product)(\/|$)/i.test(path)) score += 10;
        if (/sale|new|best|featured/i.test(path)) score += 1;
        if (parsed.search) score -= 1;
        if (/\/collections\/all(\/|$)/i.test(path)) score += 2;
        return score;
      } catch (error) {
        return 0;
      }
    };

    const uniqueLinks = [...new Set(links)].sort((a, b) => {
      const scoreDelta = scoreUrl(b) - scoreUrl(a);
      if (scoreDelta !== 0) return scoreDelta;
      return a.localeCompare(b);
    });

    const categories = uniqueLinks.filter((href) => /\/(collections|category|collections\/all|catalog|shop)(\/|$)/i.test(new URL(href).pathname)).slice(0, MAX_AUTO_DISCOVERED_CATEGORIES);
    const products = uniqueLinks.filter((href) => /\/(products|product)(\/|$)/i.test(new URL(href).pathname)).slice(0, MAX_AUTO_DISCOVERED_PRODUCTS);
    return { categories, products };
  } catch (error) {
    return { categories: [], products: [] };
  }
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
  const home = analyzePage("home", fetchResult, plan);
  const general = analyzePage("general", fetchResult, plan);
  const totalWeight = home.totalWeight + general.totalWeight;
  const scoreWeight = home.scoreWeight + general.scoreWeight;
  const speed = await fetchPageSpeedScore(url);
  return {
    url,
    fetched: fetchResult.ok,
    score: totalWeight ? Math.round((scoreWeight / totalWeight) * 100) : 0,
    speed: speed?.score ?? null,
    stack: fetchResult.ok ? detectStoreStack(new DOMParser().parseFromString(fetchResult.html, "text/html"), fetchResult.html.toLowerCase(), fetchResult.html, url) : null
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
  const discovered = await discoverUrlsForAudit(homeUrl);
  if (!discovered.categories.length && !discovered.products.length) {
    alert("The app could not discover enough category or product URLs automatically for this site.");
    return;
  }
  STATE.discovered = discovered;
  renderDiscoveredUrls(discovered);
  autoFillDiscoveredUrls(discovered, STATE.plan);
}

function analyzePage(pageType, fetchResult, plan) {
  const parser = new DOMParser();
  const fallbackHtml = "<html><body></body></html>";
  const doc = parser.parseFromString(fetchResult.ok ? fetchResult.html : fallbackHtml, "text/html");
  const text = (doc.body?.innerText || "").replace(/\s+/g, " ").toLowerCase();
  const html = fetchResult.ok ? fetchResult.html : "";
  const context = buildAnalysisContext(doc, html, fetchResult.url || "");
  const stack = fetchResult.ok ? detectStoreStack(doc, text, html, fetchResult.url || "") : null;
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
        passed = !!ruleDef.test({ doc, text, html, stack, context, url: fetchResult.url || "" });
      } catch (error) {
        passed = false;
      }
    }

    totalWeight += ruleDef.weight;
    if (passed) scoreWeight += ruleDef.weight;

    appliedChecks.push({
      id: ruleDef.id,
      label: ruleDef.label,
      passed,
      weight: ruleDef.weight,
      tier: ruleDef.tier
    });

    if (!passed) {
      const priority = ruleDef.weight * (plan === "pro" ? 2 : 1.6);
      if (ruleDef.weight >= 3) criticalIssues += 1;
      recommendations.push({
        title: ruleDef.label,
        detail: fetchResult.ok
          ? `This check did not pass automatically on the ${PAGE_LABELS[pageType]} URL.`
          : `The page could not be fetched automatically, so this important check should be reviewed manually.`,
        priority,
        impactLabel: ruleDef.weight >= 3 ? "High" : ruleDef.weight === 2 ? "Medium" : "Low",
        pageLabel: PAGE_LABELS[pageType],
        type: fetchResult.ok ? "automatic" : "manual"
      });
    }
  });

  const fetchStatus = fetchResult.ok
    ? `Fetched via ${fetchResult.usedStableSnapshot ? 'stable cached snapshot' : fetchResult.source}`
    : "Fetch blocked or unavailable";

  return {
    fetchStatus,
    appliedChecks,
    scoreWeight,
    totalWeight,
    criticalIssues,
    recommendations,
    stack,
    screenshotUrl: fetchResult.url ? getScreenshotUrl(fetchResult.url) : "",
    structuredTypes: context.structuredTypes
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

  renderRecommendations(report.recommendations);
  renderPageBreakdown(report.pageResults);
  renderStackInsights(report.stackSummary);
  renderCompetitorComparison(report.competitorReport);
  renderScreenshots(report.pageResults);
  renderDiscoveredUrls(report.discovered || STATE.discovered);
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
      </div>

      <div class="tag-row">
        <span class="tag info">${escapeHtml(pageName)}</span>
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
  if (!categories.length && !products.length) {
    panel.classList.add("hidden");
    list.innerHTML = "";
    return;
  }
  panel.classList.remove("hidden");
  list.innerHTML = [
    ...categories.map((url) => `<div class="discovery-chip">Category: ${escapeHtml(shortDisplayUrl(url))}</div>`),
    ...products.map((url) => `<div class="discovery-chip">Product: ${escapeHtml(shortDisplayUrl(url))}</div>`)
  ].join("");
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
    return `
      <article class="page-card">
        <div class="page-top">
          <div>
            <div class="page-title">${escapeHtml(page.label)}</div>
            <a class="inline-link" href="${escapeHtml(page.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(page.url)}</a>
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
        </div>
        <p class="status-note">
          ${page.fetchStatus.startsWith("Fetched")
            ? "This page was fetched successfully and evaluated using the automatic rules available in this static app."
            : "This page could not be fetched automatically. Use the recommendations list as a structured manual review guide."}
        </p>
        ${page.stack ? `<div class="tag-row"><span class="tag info">${escapeHtml(page.stack.platform || 'Unknown platform')}</span>${(page.stack.apps || []).slice(0, 3).map((app) => `<span class="tag">${escapeHtml(app)}</span>`).join('')}</div>` : ''}
      </article>
    `;
  }).join("");
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
