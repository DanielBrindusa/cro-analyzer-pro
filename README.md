# CRO Analyzer Pro

CRO Analyzer Pro is a browser-based auditing application for reviewing the conversion readiness of ecommerce storefronts. It evaluates key pages against a structured CRO ruleset, generates prioritized findings, scores the storefront on a 0–100 scale, and presents actionable recommendations in a clean client-facing interface.

The application is designed to run as a static front-end deployment and can be hosted on GitHub Pages or embedded into another website. In its current architecture, it requires no server to function for the core audit workflow, report generation, local persistence, and configurable ad placements. The main UI is defined in `index.html`, the styling in `styles.css`, the analysis and application logic in `app.js`, the checklist dataset in `checklist-data.js`, and the ad controls in `ads-config.json`.

## Purpose

The project is intended for agencies, CRO specialists, ecommerce consultants, and storefront owners who want a fast, structured way to review public-facing pages and identify high-value optimization opportunities. It is especially useful as a lead-generation tool, a discovery-phase audit interface, or the front-end foundation for a larger SaaS product.

## Key capabilities

The current version supports the following core capabilities:

- analysis of home, category or collection, product, cart, checkout, and thank-you page patterns through rule-based inspection
- separate Free and Pro plan behavior, with controlled usage limits for recommendations and URLs
- automatic checks for CRO signals such as titles, pricing, CTAs, trust indicators, shipping visibility, product media, reviews, filtering, and more
- prioritization of findings based on rule metadata and storefront context
- browser-side storage of completed reports
- export functionality for JSON and PDF outputs
- configurable ad placements controlled from a separate JSON file
- an embeddable interface suitable for websites, landing pages, and lead capture flows

The plan structure and feature gating are implemented directly in the application logic, including Free plan recommendation limits and Pro plan payment-link handling.

## How the application works

### 1. Project setup

The user enters a project name and one or more URLs to analyze. The interface supports a home page URL, cart URL, competitor home page URL, category or collection URLs, and product URLs. These inputs are presented in the main setup sidebar of the application.

### 2. Automated analysis

When the analysis starts, the app attempts to fetch the provided pages and evaluate them against a set of predefined rules. These rules are grouped by page type and cover common CRO signals such as whether an add-to-cart button exists, whether pricing is visible, whether a page contains multiple visuals, whether search is available, or whether trust and support information is present. The automated checks are defined in `app.js`. 

### 3. Checklist-driven scoring

In addition to hardcoded automated rules, the project includes a broader CRO checklist dataset in `checklist-data.js`. Each checklist entry contains metadata such as page type, section, impact, cost, tier, and default evaluation. This allows the application to produce structured, weighted recommendations beyond a simple pass or fail model.

### 4. Report generation

After the analysis completes, the app displays an overall storefront score, number of checks used, critical issues, pages analyzed, estimated opportunity, page-level breakdowns, and a recommendations list. The interface is designed to present the findings in a client-friendly dashboard format.

### 5. Local persistence and export

Reports are stored in browser local storage, allowing the user to revisit previous results from the same browser session environment. The interface also provides export actions for JSON and PDF report formats through dedicated buttons in the setup panel.

## Application structure

```text
project-root/
├── index.html
├── styles.css
├── app.js
├── checklist-data.js
├── ads-config.json
├── LICENSE.txt
└── README.md
```

### File overview

`index.html`  
Contains the user interface, including the hero section, pricing cards, ad banner, project setup form, progress panel, summary cards, and report sections.

`styles.css`  
Contains the visual system for the app, including color variables, layout grids, card styling, responsive behavior, controls, dashboard sections, and ad presentation styles.

`app.js`  
Contains the application state, plan logic, automated check definitions, ad config loading, ad slot initialization, and the main audit workflow. It also contains plan unlock behavior and configurable Free and Pro limits.

`checklist-data.js`  
Contains the CRO checklist dataset used to enrich scoring and recommendations with broader heuristic evaluation criteria.

`ads-config.json`  
Contains the separate ad configuration model for all ad placements on the page. Each slot can be enabled or disabled and configured independently without editing application logic.

`LICENSE.txt`  
Contains the proprietary license for the project under the CRO Analyzer Pro brand.

## Supported page types

The application is structured around these primary page contexts:

- General
- Home page
- Category page
- Product page
- Cart page
- Checkout page
- Thank you page

These labels are defined in the application state and are used across checks, reporting, and recommendation grouping.

## Ad system

A dedicated ad configuration file controls all monetization placements on the page.

### Available slots

- `hero`
- `sidebar`
- `inline`
- `footer`

Each slot supports the following fields:

- `enabled`
- `label`
- `note`
- `title`
- `text`
- `ctaLabel`
- `url`

The application loads `ads-config.json` at runtime, merges it with fallback defaults, and then populates each slot dynamically. If a placeholder or invalid URL is left in place, the button is safely disabled and the user receives a clear prompt to replace it. This behavior is implemented in the ad-loading functions in `app.js`.

### Example configuration

```json
{
  "slots": {
    "hero": {
      "enabled": true,
      "label": "Advertisement",
      "note": "Monetization space",
      "title": "Promote your CRO service, affiliate offer, or featured partner here.",
      "text": "This wide banner is ideal for your best monetization slot.",
      "ctaLabel": "Learn more",
      "url": "https://example.com/featured-offer"
    }
  }
}
```

## Deployment

### GitHub Pages deployment

1. Create a GitHub repository.
2. Upload all project files to the repository root.
3. Commit and push the files.
4. Open the repository settings.
5. Go to **Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Select the `main` branch and the `/ (root)` folder.
8. Save the settings.
9. Wait for GitHub Pages to publish the site.

For this project structure, `index.html` is the entry point, so the app can be served directly as a static site without additional build steps. The README already described GitHub Pages hosting as the intended deployment path for this version.

## Embedding in another website

The easiest way to embed the app is with an iframe.

```html
<iframe
  src="https://croanalyser.com/"
  width="100%"
  height="1200"
  style="border:0; border-radius:24px; overflow:hidden;"
  loading="lazy">
</iframe>
```

This approach keeps the app isolated, reduces CSS or JavaScript conflicts, and makes future updates easier because the embedded page can be updated independently of the host website.

## Customization guide

### Add or edit CRO rules

To change the automated analysis logic, edit the `AUTOMATED_CHECKS` object in `app.js`.  
To change the broader checklist model, edit `window.CRO_CHECKLIST` in `checklist-data.js`.

### Change ad content quickly

Edit `ads-config.json` only. In most cases, you do not need to touch `app.js` or `index.html` to update ad copy, labels, CTAs, or links.

### Modify the visual identity

Open `styles.css` and adjust the root variables to change the core appearance, especially:

```css
:root {
  --accent: #6ea8fe;
  --accent-2: #8b5cf6;
  --bg: #0b1020;
  --panel: #11192d;
}
```

The UI uses these variables throughout the application for consistent theming.

## Technical limitations

Because the project is currently a static browser-based application, there are some important limitations:

- some websites will block content fetching due to CORS restrictions
- no server-side crawling is available in this version
- checkout and post-purchase flows can be difficult or impossible to inspect automatically from a static front end
- the current Pro plan flow is a front-end payment-link structure, not a full subscription backend
- scheduled reporting is not server-automated in this architecture

These limitations were already noted in the earlier project documentation and remain accurate for the current version.

## Recommended next-stage improvements

For a more advanced product version, the next logical upgrades would be:

- backend-assisted crawling for more reliable page retrieval
- authenticated user accounts
- real subscription management and billing
- screenshot capture and richer visual audits
- AI-assisted explanation and prioritization layers
- saved team workspaces and shared report management
- store-specific integrations for platforms such as Shopify

## License

This project is proprietary software under the CRO Analyzer Pro brand.

Copyright (c) 2026 Daniel Cristian Brindusa  
All rights reserved.

The included license states that the software and associated documentation are the exclusive property of Daniel Cristian Brindusa, operating under the CRO Analyzer Pro brand, and may not be copied, modified, redistributed, reverse engineered, re-hosted, resold, or commercially exploited without explicit prior written permission.

## Contact

For licensing, commercial use, partnerships, or custom integration inquiries, update this repository with your preferred contact details.

## Disclaimer

This tool is intended to support CRO review and prioritization. It does not replace full analytics implementation, experimentation frameworks, user research, or platform-native performance diagnostics. It should be used as a structured front-end audit layer within a broader optimization process.
