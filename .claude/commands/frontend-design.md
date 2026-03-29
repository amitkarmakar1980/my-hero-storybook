Before writing any frontend code, complete every step below in order. Do not skip steps or proceed to coding until this checklist is done.

## Step 1 — Load brand assets

Read everything in `Code/brand_assets/`:
- List all files found there
- If a logo exists, note its path and format
- If a color guide or style guide exists, read it fully
- If reference images exist, read and visually analyse each one — describe layout, spacing, typography, colors, and components you observe

## Step 2 — Extract design tokens

From the CSS provided by the user (or from brand assets), document the exact values you will use:
- **Primary color** (hex)
- **Background color** (hex)
- **Accent / secondary colors** (hex each)
- **Heading font** (name + weights)
- **Body font** (name + weights)
- **Border radius tokens**
- **Any other notable tokens** (shadows, spacing scale, etc.)

## Step 3 — Analyse the reference image (if provided)

If a reference image was provided, describe it with precision:
- Overall layout (columns, grid, sections)
- Header: logo position, nav links, CTA placement
- Hero: headline size/weight, subtext, CTA style, any illustration or image
- Cards / feature sections: count, layout, colors, icon style
- Footer if visible
- Spacing between sections (rough estimate in px or rem)
- Any animations or interactive states visible

## Step 4 — Identify components needed

List every React component you will create before writing a single line of code. For each:
- Component name
- What it renders
- Props it will accept (if any)

## Step 5 — State your approach

In 3–5 sentences, describe:
- How you will structure the files
- Which Tailwind v4 patterns you will use (e.g., `@theme` tokens, arbitrary values)
- Any tradeoffs or decisions (e.g., emoji vs SVG for icons)
- Screenshot plan: which URL and label you will use after building

Only after completing all five steps above should you begin writing code.
