---
name: Metalune
colors:
  surface: '#141319'
  surface-dim: '#141319'
  surface-bright: '#3a383f'
  surface-container-lowest: '#0e0d13'
  surface-container-low: '#1c1b21'
  surface-container: '#201f25'
  surface-container-high: '#2b2930'
  surface-container-highest: '#35343b'
  on-surface: '#e5e1ea'
  on-surface-variant: '#c9c4d2'
  inverse-surface: '#e5e1ea'
  inverse-on-surface: '#312f36'
  outline: '#928f9c'
  outline-variant: '#484551'
  surface-tint: '#c8bfff'
  primary: '#c8bfff'
  on-primary: '#302272'
  primary-container: '#a89cf2'
  on-primary-container: '#3c307e'
  inverse-primary: '#5e53a3'
  secondary: '#afc6ff'
  on-secondary: '#142f5f'
  secondary-container: '#2e4677'
  on-secondary-container: '#9db5ed'
  tertiary: '#c2c6d8'
  on-tertiary: '#2c303e'
  tertiary-container: '#a3a6b8'
  on-tertiary-container: '#383c4a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e5deff'
  primary-fixed-dim: '#c8bfff'
  on-primary-fixed: '#1a055d'
  on-primary-fixed-variant: '#463b89'
  secondary-fixed: '#d9e2ff'
  secondary-fixed-dim: '#afc6ff'
  on-secondary-fixed: '#001a43'
  on-secondary-fixed-variant: '#2e4677'
  tertiary-fixed: '#dfe2f5'
  tertiary-fixed-dim: '#c2c6d8'
  on-tertiary-fixed: '#171b29'
  on-tertiary-fixed-variant: '#424655'
  background: '#141319'
  on-background: '#e5e1ea'
  surface-variant: '#35343b'
typography:
  display-xl:
    fontFamily: Playfair Display
    fontSize: 4.5rem
    fontWeight: '400'
    lineHeight: 5rem
    letterSpacing: -0.02em
  display-xl-mobile:
    fontFamily: Playfair Display
    fontSize: 2.75rem
    fontWeight: '400'
    lineHeight: 3.25rem
    letterSpacing: -0.01em
  display-lg:
    fontFamily: Playfair Display
    fontSize: 3.5rem
    fontWeight: '400'
    lineHeight: 4rem
    letterSpacing: -0.015em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 2.25rem
    fontWeight: '400'
    lineHeight: 2.75rem
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 2.5rem
    fontWeight: '400'
    lineHeight: 3rem
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 1.75rem
    fontWeight: '400'
    lineHeight: 2.25rem
    letterSpacing: 0em
  headline-md:
    fontFamily: Playfair Display
    fontSize: 2rem
    fontWeight: '500'
    lineHeight: 2.5rem
    letterSpacing: -0.005em
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 1.5rem
    fontWeight: '500'
    lineHeight: 2rem
    letterSpacing: 0em
  title-lg:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '500'
    lineHeight: 1.5rem
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: 1.75rem
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: 0.005em
  label-caps:
    fontFamily: Inter
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.12em
  label-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.02em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-desktop: 2rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
The design system embodies the mood of "liquid metal under dark glass"—haute-couture material architecture engineered for a world of quiet luxury, technological precision, and bespoke brand formulation. Designed for founders, creative directors, and product visionaries who perceive software as tactile physical matter, the interface communicates weight, rarity, and quiet authority. 

Drawing from modern Glassmorphism and Tactile Metallics, surfaces exist as smoky, deep vitreous planes suspended over near-black violet substrate. Visual hierarchy relies on specular reflections, micro-diffused light sheens, and ultra-crisp hairline strokes rather than flat drop shadows. The tension between haute-couture editorial typography and utilitarian corporate clarity produces an atmosphere that feels simultaneously established, sovereign, and intensely modern.

## Colors
The palette is built on chromatic alloys rather than flat pigments:
- **Lilac Alloy (Primary #A89CF2):** Evokes illuminated violet platinum. Used for core interactive states, brand accent markers, and focused elements. Its shadow anchor is `#7B6FD0` with specular crests reaching `#D6CEFF`.
- **Glaucous Alloy (Secondary #7C93C9):** A tempered titanium-blue alloy. Used for structural data tiers, secondary interaction layers, and contextual telemetry. Anchored by shadow `#55689A` and accented with `#B4C4EC`.
- **Snow Alloy (Tertiary #DCDFF2):** Polished silver-white bullion. Serves as high-contrast metallic edge lighting, specular gleams, and tertiary metadata. Anchored by shadow `#AEB3D1` and topped with highlight `#F6F7FF`.
- **Ground & Canvas (Neutral #0D0C12):** An obsidian violet-tinted ground absorbing ambient luminescence. Paired with warm off-white contrast text (`#F4F2EE`) and tinted muted mid-tones (`#8E899D`, `#575266`) for harmonious readability.

Metallic styling is achieved via 135-degree linear gradients traversing shadow, base, and specular highlight tiers, encased within frosted translucent containers.

## Typography
Typography is orchestrated across two distinct realms: high-contrast couture authority and systematic structural utility.
- **Playfair Display** commands monumental display headlines, hero titles, and editorial numeric readouts. It is frequently styled with natural italics (`font-style: italic`) on expressive brand phrases, echoing haute horlogerie and editorial print monographs.
- **Inter** executes functional interface copy, complex data grids, body copy, and navigation controls. Its neutral geometry ensures legibility against reflective glass planes.
- **Micro-Labels & Meta:** The `label-caps` token utilizes all-caps formatting combined with wide letter-spacing (`0.12em`) on small scales to serve as pill badges, alloy identifiers, and engineering stamps.

## Layout & Spacing
The layout system follows a balanced fluid-grid structure anchored by generous, intentional breathing room:
- **Canvas Columns:** A 12-column layout on desktop screens (scaling down to 8 columns on tablet and 4 on mobile).
- **Margins & Safe Zones:** High-density margins frame panels with museum-like spatial pacing. Sections breathe through multiples of `space-xl` (40px) to prevent crowded elements and highlight material finish.
- **Reflow & Responsive Adaptations:** On desktop viewports, split panels present expansive metallic stages with multi-column controls. On mobile, components stack vertically while maintaining outer canvas margins of `margin` (1rem), collapsing gutters to avoid horizontal truncation.

## Elevation & Depth
Elevation is constructed through physical light penetration, frosted glass opacity, and edge-sheen highlights:
- **Surface Foundations:** Background planes sit at `#0D0C12`. Secondary tiers rest on `rgba(22, 20, 31, 0.65)` layered with a `backdrop-filter: blur(24px)`.
- **Specular Hairline Outlines:** Rather than dark drops, containers feature 1px gradient borders flowing from upper-left specular highlights (`rgba(214, 206, 255, 0.28)`) to lower-right shadows (`rgba(123, 111, 208, 0.05)`).
- **Inner Ambient Sheen:** Elevated containers receive a subtle top-down inner ring (`box-shadow: inset 0 1px 1px 0 rgba(246, 247, 255, 0.12)`).
- **Deep Ambient Glow:** Floating modals and interactive overlays cast wide-aperture, low-opacity lilac shadows (`box-shadow: 0 24px 64px -12px rgba(123, 111, 208, 0.18)`), creating a weightless hover effect above the obsidian floor.

## Shapes
Geometry is sculptural, ergonomic, and organic:
- **Pill Philosophy (Level 3):** All controls, buttons, toggles, indicators, and chips feature complete pill silhouettes (`border-radius: 9999px` or minimum `1rem`), replicating liquid droplets and polished metallurgical slugs.
- **Card Enclosures:** Container structures adhere to a strict 28px (`1.75rem`) border radius, balancing generous organic corner curves with high structural stability.
- **Micro-Elements:** Inputs and modal sheets scale gracefully between `rounded-lg` (2rem) and continuous pill curves.

## Components

### Buttons
- **Primary Liquid Button:** Continuous pill shape. Background utilizes a directional linear gradient (`135deg`, `#D6CEFF 0%`, `#A89CF2 52%`, `#7B6FD0 100%`). Foreground text is obsidian `#0D0C12` in medium-weight Inter. Outer edge finished with a 1px metallic overlay and subtle internal top gleam. Hover initiates an increased specular luminance without artificial displacement.
- **Secondary Ghost Pill:** Glassmorphic translucent ground (`rgba(168, 156, 242, 0.08)`) with a hairline border (`rgba(214, 206, 255, 0.2)`). Text colored in `#F4F2EE`.

### Cards & Panels
- **Material Stage Card:** 28px border radius, frosted vitreous surface with `backdrop-filter: blur(20px)`, and `rgba(18, 16, 26, 0.7)` background. Hairline border running linear gradients of Snow Alloy and Lilac Alloy. Subtle top-edge inner glow. Content padding strictly respects `space-lg` to `space-xl`.

### Chips & Alloy Tags
- **Alloy Badges:** Pill contouring with tight internal padding (`space-xs` vertical, `space-sm` horizontal). Typography utilizes `label-caps`. Styled with faint metallic backgrounds tinted to respective alloy categories (Lilac, Glaucous, or Snow).

### Form Controls & Inputs
- **Text Inputs:** Pill-shaped fields with dark-tinted inset fill (`rgba(10, 9, 15, 0.8)`). 1px border tinted in `#575266`, shifting to focused specular Lilac (`#A89CF2`) accompanied by a diffuse outer bloom (`0 0 16px rgba(168, 156, 242, 0.25)`).
- **Checkboxes & Radios:** Curved organic capsules. Active states display a polished metal center droplet on a deep obsidian floor.

### Lists & Data Rows
- **Specimen Lists:** Borderless items separated by delicate etched dividers (`1px solid rgba(220, 223, 242, 0.06)`). Hover events evoke a faint horizontal illumination strip spanning from the left edge.

### Bespoke System Component: The Material Inspector
- A dedicated floating HUD panel combining a 28px rounded glass shell, tabbed alloy toggles, and live specular preview controls for adjusting substrate roughness, transmission, and metallic luster.