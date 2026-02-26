/**
 * Tailwind Config for Django Studio
 *
 * Mirrors the design tokens from travisgilbert.com's global.css
 * so both codebases share the same visual language.
 *
 * Place this in: theme/static_src/tailwind.config.js
 * (after running `python manage.py tailwind init`)
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Django templates (including cotton components)
    "../templates/**/*.html",
    "../../templates/**/*.html",
    "../../**/templates/**/*.html",
    // Crispy template pack
    "../../crispy_studio/templates/**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        // Brand primaries
        terracotta: {
          DEFAULT: "#B45A2D",
          hover: "#9A4A22",
          light: "#D4875A",
          tint: "rgba(180, 90, 45, 0.08)",
        },
        teal: {
          DEFAULT: "#2D5F6B",
          light: "#3A7A88",
          tint: "rgba(45, 95, 107, 0.08)",
        },
        gold: {
          DEFAULT: "#C49A4A",
          light: "#D4AA5A",
          tint: "rgba(196, 154, 74, 0.08)",
        },

        // Surfaces
        parchment: "#F0EBE4",
        "parchment-alt": "#E8E0D6",
        cream: "#FAF6F1",
        "dark-ground": "#1A1816",
        "dark-surface": "#2A2622",

        // Ink (text)
        ink: {
          DEFAULT: "#2A2420",
          secondary: "#6A5E52",
          muted: "#9A8E82",
        },

        // Borders
        border: {
          DEFAULT: "#D4CCC4",
          light: "#E8E0D6",
          dark: "#3A3632",
        },

        // Status
        success: "#5A7A4A",
        error: "#A44A3A",
      },

      fontFamily: {
        // The Documentarian (primary: 80% of use)
        title: ["Vollkorn", "serif"],
        body: ["Cabin", "sans-serif"],
        mono: ["Courier Prime", "monospace"],

        // The Architect (display)
        "title-alt": ["Ysabeau", "sans-serif"],
        "body-alt": ["IBM Plex Sans", "sans-serif"],
        "mono-alt": ["Space Mono", "monospace"],

        // Display / Masthead
        display: ["Instrument Serif", "serif"],
      },

      fontSize: {
        // Labels and technical text
        "label-sm": ["10px", { letterSpacing: "0.1em", lineHeight: "1.2" }],
        label: ["11px", { letterSpacing: "0.08em", lineHeight: "1.3" }],
        "label-lg": ["12px", { letterSpacing: "0.06em", lineHeight: "1.3" }],
      },

      borderRadius: {
        brand: "10px",
        "brand-lg": "14px",
      },

      boxShadow: {
        "warm-sm": "0 1px 2px rgba(42, 36, 32, 0.05)",
        warm: "0 2px 8px rgba(42, 36, 32, 0.07), 0 1px 3px rgba(42, 36, 32, 0.04)",
        "warm-lg": "0 4px 16px rgba(42, 36, 32, 0.10), 0 2px 6px rgba(42, 36, 32, 0.05)",
        // Embossed label effect
        emboss: "inset 0 1px 2px rgba(0, 0, 0, 0.15)",
      },

      backgroundImage: {
        // Blueprint grid overlay (use with ::before pseudo)
        "grid-blueprint":
          "linear-gradient(#D4CCC4 1px, transparent 1px), linear-gradient(90deg, #D4CCC4 1px, transparent 1px)",
      },

      backgroundSize: {
        grid: "40px 40px",
      },

      maxWidth: {
        prose: "65ch",
      },

      spacing: {
        grid: "20px",
      },
    },
  },
  plugins: [],
};
