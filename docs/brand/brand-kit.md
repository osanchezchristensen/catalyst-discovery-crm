# Brand kit

The app uses KU's official palette and type. KU Blue leads the interface, Steam and white carry the surfaces, and Crimson is reserved for emphasis and warnings. This file is the design system: it overrides any design plugin's defaults.

## Name and voice
- **Product name:** Catalyst Discovery CRM (short form: Discovery CRM)
- **Tagline:** Talk to customers. Test the idea. Know what's real.
- **Voice:** a coach, not a professor. Use short sentences, plain words and second person ("you"). Push toward action ("Log your next interview") and toward honest evidence over optimism.
- **Program words to reuse:** cohort, venture, Guide, Guide in Training, Stage 1/2/3, learning by doing

## Logo and marks
- **Wordmark:** text only. "The Catalyst" is set in the display serif, with "Discovery CRM" in the sans beside or below it. Use KU Blue on light backgrounds, or white on KU Blue.
- **Official KU marks:** do **not** draw, trace or AI-generate the Jayhawk or the KU signature; KU Marketing manages those marks. Add an official KU School of Business signature only from files KU Marketing supplies.
- **App icon:** a simple geometric mark, such as a spark or a speech bubble with a check, in KU Blue (#0051BA) on white.

## Color palette

| Role | KU color | HEX | HSL | Use |
| --- | --- | --- | --- | --- |
| Primary | KU Blue (PMS 293) | #0051BA | 214 100% 36% | Primary buttons, links, active nav, headers |
| Primary dark | KU Blue darker | #004091 | 214 100% 28% | Hover and pressed states |
| Primary deepest | KU Blue darkest | #003171 | 214 100% 22% | Sidebar background |
| Ink | Night | #003459 | 205 100% 17% | Body text and headings on light backgrounds |
| Accent / destructive | Crimson (PMS 186) | #E8000D | 357 100% 45% | Sparing highlights, invalidated hypotheses, delete |
| Accent dark | Crimson darker | #B90009 | 357 100% 36% | Crimson text on white, destructive hover |
| Surface | Steam | #DDE5ED | 210 31% 90% | Section bands, table headers, borders |
| Page | Steam lightest | #F2F5F8 | 210 30% 96% | App background |
| Info | Sky | #73CBF2 | 198 83% 70% | Info badges, charts (with Night text) |
| Highlight | Gold | #FFC82D | 44 100% 59% | "Mixed evidence" badge, insight flags (with Night text) |
| Chart 2 | Bright blue | #2767FF | 222 100% 58% | Chart series |
| Chart 3 | Brick | #C66E4E | 16 51% 54% | Chart series |
| Neutral | Gray | #85898A | 190 2% 53% | Dividers, disabled icons (not body text) |

- **Accessible pairs:** white on KU Blue, white on KU Blue darkest, Night on Sky, Night on Steam, Night on Gold.
- **Avoid:** white on Sky or Gold, and Gray for body text; these fail contrast.
- **Muted secondary text:** #4E5A66. This is a derived value chosen to pass contrast; swap it if KU Marketing specifies a text gray.

## Typography

KU approves Roc Grotesk, Moret, Freight Pro and Halyard, with Arial and Palatino as alternates.

| Use | Preferred | Fallback stack (what ships) | Sizes |
| --- | --- | --- | --- |
| Display / page titles | Moret | Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif | 32 / 24 px, weight 600 |
| UI, headings, body | Roc Grotesk | Arial, Helvetica, sans-serif | H2 20/600, H3 16/600, body 15/400, small 13 |
| Numbers | Roc Grotesk, tabular figures | Arial, sans-serif | 14 px, `font-variant-numeric: tabular-nums` |

Roc Grotesk and Moret are Adobe Fonts. A desktop app can't embed them without a desktop or app license, and it can't load a web font kit because the app is offline. **Ship the fallback stacks.** Bundle the KU fonts only if KU provides font files licensed for app embedding.

## UI rules
- **Layout:** left sidebar in KU Blue darkest with white text. Page background is Steam lightest. Cards are white, with a 1px Steam border, 8px radius and a soft shadow.
- **Spacing:** 4px grid, 24px card padding, 1280px max content width. The minimum window is 1024×700.
- **Buttons:**
  - Primary: KU Blue fill with white text.
  - Secondary: white with a KU Blue border.
  - Destructive: Crimson.
- **Status:** always pair color with an icon and a word.
- **Icons:** Lucide, 1.5px stroke.
- **Motion:** 150–200 ms ease-out on state changes only. No decorative animation. Respect `prefers-reduced-motion`.
- **Density:** this is a working tool, so favor tables, compact cards and keyboard shortcuts over hero sections.
- **Empty states:** one line of coaching plus one button, for example: "No interviews yet. Most viable ventures start with 10. Log your first."
- **Focus:** a visible 2px KU Blue focus ring on every interactive element.

Sources: [KU color palettes](https://brand.ku.edu/guidelines/color), [KU web pattern library](https://patternlab.app.ku.edu/master/pattern-lab/public/patterns/00-base-05-colors/index.html), [KUMC fonts and colors](https://www.kumc.edu/communications/brand-center/fonts-and-colors.html)
