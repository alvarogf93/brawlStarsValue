# Landing Page "Arena Edition" — Design Spec

**Date:** 2026-04-07
**Status:** Approved
**Scope:** Replace minimal landing page with expanded, immersive 7-section landing

---

## Overview

Transform the current minimal landing (hero card + 4 feature cards) into a full-page immersive experience that showcases BrawlVision's capabilities, builds credibility, and drives login/signup conversions. 100% consistent with existing Brawl design system.

## Design System Constraints

- Cards: `brawl-card` (light) and `brawl-card-dark` (dark) classes
- Buttons: `brawl-button` (gold 3D button)
- Typography: `text-stroke-brawl` / `text-stroke-brawl-brand`, Lilita One for headings, Inter for body
- Colors: `--color-brawl-dark`, `--color-brawl-blue`, `--color-brawl-sky`, `--color-brawl-gold`, `--color-brawl-purple`, `--color-brawl-red`
- Animations: framer-motion for viewport reveals + floating brawlers, CSS keyframes for parade
- Images: `cdn.brawlify.com/brawlers/borders/{id}.png` via next/image
- i18n: next-intl, 13 locales, all new keys under `landing.*`

## Sections

### 1. Hero (Full Viewport)

- Full viewport height (`min-h-screen`)
- Centered `brawl-card` with title, subtitle, InputForm (existing component, untouched)
- 6 brawler portraits flanking the form with absolute positioning:
  - Left: Shelly (16000000), Spike (16000005), Mortis (16000011)
  - Right: Crow (16000012), Leon (16000023), El Primo (16000010)
  - Floating animation: framer-motion `y: [0, -12, 0]` with staggered delays
  - Mobile (<768px): hidden or opacity-20 to avoid blocking form
- Below InputForm: "Or sign in with Google" link that opens AuthModal
- LocaleSwitcher stays in top-right corner (existing)

### 2. Stats Ticker

- Horizontal `brawl-card-dark` bar, max-width 900px centered
- 3 animated counters with lucide-react icons:
  - Swords icon: "101+" Brawlers
  - Users icon: "10,000+" Players
  - Zap icon: "1M+" Battles
- Gold text for numbers, white for labels
- Viewport-triggered count-up animation

### 3. Features Grid (6 cards)

- 3x2 grid desktop, 2x2 tablet, 1-col mobile
- `brawl-card-dark` style per card
- Each card: colored icon circle + Lilita One title + 1-line description
- Cards:
  1. Gem Power Score (gold circle) — "Calculate the real gem value of every brawler, gadget, and skin"
  2. Battle Analytics (sky circle) — "Deep dive into win rates, modes, and performance trends"
  3. Team Synergies (green circle) — "Find your best teammate combos and brawler pairs"
  4. Counter-Picks (red circle) — "Know exactly which brawler beats your enemy"
  5. Tilt Detector (purple circle) — "Know when to stop before losing trophies"
  6. Play Now (gold circle) — "Real-time brawler recommendations based on YOUR data"
- Hover: scale(1.03) transition

### 4. Brawler Parade

- Title: "EVERY BRAWLER. EVERY STAT." with text-stroke-brawl
- 2 rows of brawler portraits auto-scrolling in opposite directions
- Row 1 (left-to-right): ~30 brawlers, CSS `@keyframes scrollLeft`
- Row 2 (right-to-left): ~30 different brawlers, CSS `@keyframes scrollRight`
- Portrait size: 64px with 3px border colored by rarity:
  - Trophy Road: #9CA3AF (gray)
  - Rare: #4ADE80 (green)
  - Super Rare: #3B82F6 (blue)
  - Epic: #A855F7 (purple)
  - Mythic: #EF4444 (red)
  - Legendary: #FFC91B (gold)
  - Chromatic: linear-gradient (rainbow)
  - Ultra Legendary: #FF6B35 (orange glow)
- CSS-only animation, GPU-accelerated transforms
- Images duplicated in DOM for seamless loop
- Lazy-loaded via next/image

### 5. How It Works (3 Steps)

- 3 columns (mobile: vertical stack)
- Each step: `brawl-card` with large gold number (text-stroke), lucide icon, title, 1-line description
- Steps:
  1. Search icon — "Enter your #TAG" — "Find it in-game under your profile"
  2. BarChart3 icon — "Get instant analysis" — "We crunch every brawler, battle, and upgrade"
  3. Trophy icon — "Dominate the arena" — "Use data-driven insights to climb trophies"
- Gold arrows (→) between steps on desktop

### 6. Premium Teaser

- `brawl-card` with special gold top-border (4px solid gold)
- Title: "UNLOCK YOUR FULL POTENTIAL" with text-stroke
- 2-column comparison:
  - Free column: green checkmarks for Gem Calculator, Basic Stats, Club View
  - Premium column (gold badge): gold checkmarks for everything in Free + Battle History, AI Analytics, Counter-Picks, Tilt Detector, No Ads
- Badge: "From €2.99/mo" in brawl-card-dark
- CTA: `brawl-button` "ACTIVATE PREMIUM" → opens AuthModal or redirects to premium page

### 7. Final CTA + Footer

- `brawl-card` centered, max-width 500px
- Title: "READY TO DOMINATE?" with text-stroke-brawl-brand
- Google sign-in button (same style as AuthModal)
- Text below: "Free forever. Premium for pros."
- Footer: existing footer (privacy, contact, Supercell disclaimer)

## Component Architecture

```
src/app/[locale]/page.tsx          — Server component, orchestrates sections
src/components/landing/
  InputForm.tsx                     — EXISTING, untouched
  HeroBrawlers.tsx                  — Client: floating brawler portraits with framer-motion
  StatsTicker.tsx                   — Client: animated counters on viewport enter
  FeaturesGrid.tsx                  — Server: 6 feature cards grid
  BrawlerParade.tsx                 — Client: auto-scrolling brawler strips
  HowItWorks.tsx                    — Server: 3-step explanation
  PremiumTeaser.tsx                 — Client: comparison + CTA with AuthModal
  FinalCTA.tsx                      — Client: sign-in button with AuthModal
```

## i18n Keys (under `landing.*`)

New keys needed (added to all 13 locale files):

```
landing.heroSignIn          — "Or sign in with Google"
landing.statsBrawlers       — "Brawlers Analyzed"
landing.statsPlayers        — "Players"
landing.statsBattles        — "Battles Tracked"
landing.feature1Title       — "Gem Power Score"
landing.feature1Desc        — "Calculate the real gem value of every brawler, gadget, and skin"
landing.feature2Title       — "Battle Analytics"
landing.feature2Desc        — "Deep dive into win rates, modes, and performance trends"
landing.feature3Title       — "Team Synergies"
landing.feature3Desc        — "Find your best teammate combos and brawler pairs"
landing.feature4Title       — "Counter-Picks"
landing.feature4Desc        — "Know exactly which brawler beats your enemy"
landing.feature5Title       — "Tilt Detector"
landing.feature5Desc        — "Know when to stop before losing trophies"
landing.feature6Title       — "Play Now"
landing.feature6Desc        — "Real-time brawler recommendations based on YOUR data"
landing.paradeTitle         — "Every Brawler. Every Stat."
landing.step1Title          — "Enter your #TAG"
landing.step1Desc           — "Find it in-game under your profile"
landing.step2Title          — "Get instant analysis"
landing.step2Desc           — "We crunch every brawler, battle, and upgrade"
landing.step3Title          — "Dominate the arena"
landing.step3Desc           — "Use data-driven insights to climb trophies"
landing.premiumTitle        — "Unlock your full potential"
landing.premiumFree         — "Free"
landing.premiumPro          — "Premium"
landing.premiumFrom         — "From €2.99/mo"
landing.premiumCTA          — "Activate Premium"
landing.premiumFreeF1       — "Gem Calculator"
landing.premiumFreeF2       — "Basic Stats"
landing.premiumFreeF3       — "Club View"
landing.premiumProF1        — "Battle History"
landing.premiumProF2        — "AI Analytics"
landing.premiumProF3        — "Counter-Picks"
landing.premiumProF4        — "Tilt Detector"
landing.premiumProF5        — "No Ads"
landing.finalTitle          — "Ready to dominate?"
landing.finalSubtitle       — "Free forever. Premium for pros."
landing.finalGoogle         — "Sign in with Google"
```

## Performance

- All sections below the fold use framer-motion `whileInView` for reveal animations
- Brawler images: next/image with `loading="lazy"`, `sizes` responsive
- Parade: CSS transforms only (no layout thrashing)
- No JavaScript for parade scroll (pure CSS animation)
- Hero brawlers: small images (~120px), preloaded since above fold

## Responsive Breakpoints

- Mobile (<640px): 1 column everything, hero brawlers hidden, parade 48px portraits
- Tablet (640-1024px): 2-col features, hero brawlers at opacity-30
- Desktop (>1024px): full layout, 3-col features row, hero brawlers at full opacity
