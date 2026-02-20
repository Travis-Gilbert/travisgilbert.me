"""
test_compose.py

Generates a demo collage output using SYNTHETIC placeholder images —
no real photos required yet. Run this immediately to verify the engine works.

When you have real photographs:
  1. Run remove_bg.py on each photo
  2. Drop the resulting PNGs into photos/cutouts/
  3. Update the config in essay_configs.py
  4. Run generate.py

Usage:
    python3 test_compose.py
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys
import os

sys.path.insert(0, str(Path(__file__).parent))
from collage_engine import compose, lerp, make_rng, TERRACOTTA, TEAL, GOLD, CREAM, NEAR_BLACK, OLIVE_GROUND


# ── Generate synthetic cutout placeholders ───────────────────────────

def make_synthetic_hero(w=480, h=620):
    """
    Simulates a dominant center object — e.g. a cracked plaster bust,
    a parking structure facade, a torn architectural drawing.
    This is a placeholder; replace with a real photo cutout.
    """
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Torn / irregular silhouette approximation using polygon
    # Outer shape
    poly = [
        (60, 0), (380, 10), (460, 80),
        (470, 300), (440, 500), (380, 600),
        (200, 615), (80, 580), (30, 420),
        (20, 200), (40, 80)
    ]
    draw.polygon(poly, fill=(210, 205, 195, 245))

    # Crack lines through the object (like a plaster cast)
    crack_color = (160, 155, 148, 180)
    draw.line([(200, 40), (240, 200), (220, 420), (260, 580)],
              fill=crack_color, width=2)
    draw.line([(280, 80), (260, 200)], fill=crack_color, width=1)
    draw.line([(200, 300), (180, 380)], fill=crack_color, width=1)

    # Surface texture: slightly varied fill
    for i in range(0, h, 8):
        alpha = 30 + int(20 * ((i / h) % 0.3))
        draw.line([(40, i), (w - 40, i)],
                  fill=(190, 185, 175, alpha), width=1)

    # Label (simulates what a real object looks like when loaded)
    draw.text((160, 290), "HERO OBJECT\n(replace with\nreal photo)",
              fill=(100, 95, 90, 180))

    return img


def make_synthetic_support(label: str, color=(180, 90, 45),
                            w=180, h=220) -> Image.Image:
    """Simulates a smaller support fragment — book, map, Pi board, etc."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # slightly irregular rectangle with rounded feel
    margin = 6
    draw.rounded_rectangle(
        [margin, margin, w - margin, h - margin],
        radius=4,
        fill=color + (230,),
        outline=(color[0] - 20, color[1] - 20, color[2] - 20, 180),
        width=1
    )

    # inner texture lines
    for y in range(margin + 14, h - margin, 16):
        draw.line([(margin + 8, y), (w - margin - 8, y)],
                  fill=(255, 255, 255, 35), width=1)

    # label text
    draw.text((margin + 8, margin + 10), label,
              fill=(255, 255, 255, 190))
    draw.text((margin + 8, h // 2), "support\nfragment",
              fill=(255, 255, 255, 120))

    return img


def make_synthetic_strip(label: str, w=70, h=380) -> Image.Image:
    """Simulates a vertical strip — book spine, torn magazine page, etc."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    bg = (228, 218, 204, 240)
    draw.rectangle([0, 0, w, h], fill=bg, outline=(200, 190, 178, 200))

    # ruled lines
    for y in range(20, h, 18):
        draw.line([(4, y), (w - 4, y)], fill=(180, 168, 155, 55), width=1)

    # vertical colored bar
    draw.rectangle([w // 2 - 10, 12, w // 2 + 10, h - 12],
                   fill=TERRACOTTA + (90,))

    # label
    draw.text((8, h // 2 - 20), label[:8],
              fill=(80, 70, 60, 160))

    return img


# ── Build synthetic test assets ──────────────────────────────────────

def build_test_assets(asset_dir: Path):
    asset_dir.mkdir(parents=True, exist_ok=True)

    # Hero
    hero_path = asset_dir / "test_hero.png"
    if not hero_path.exists():
        make_synthetic_hero().save(str(hero_path))
        print(f"  Created: {hero_path}")

    # Supports
    support_specs = [
        ("zoning-map",  (80, 105, 75)),    # teal-ish
        ("hamming-book",(30,  74, 111)),    # dark blue
        ("coffee-mug",  (100, 68,  40)),    # brown
        ("pi-board",    (26, 100,  52)),    # green
        ("new-yorker",  (200, 190, 175)),   # cream
    ]
    support_paths = []
    for name, color in support_specs:
        p = asset_dir / f"test_{name}.png"
        if not p.exists():
            make_synthetic_support(name, color=color).save(str(p))
            print(f"  Created: {p}")
        support_paths.append(str(p))

    # Strips
    strip_specs = ["ODYSSEY", "ZONING", "DATA"]
    strip_paths = []
    for label in strip_specs:
        p = asset_dir / f"test_strip_{label.lower()}.png"
        if not p.exists():
            make_synthetic_strip(label).save(str(p))
            print(f"  Created: {p}")
        strip_paths.append(str(p))

    return str(hero_path), support_paths, strip_paths


# ── Run ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Building synthetic test assets...")
    base = Path(__file__).parent
    asset_dir = base / "test_assets"
    hero_path, support_paths, strip_paths = build_test_assets(asset_dir)

    out_path = str(base / "test_collage_output.jpg")
    print("\nComposing test collage...")
    result = compose(
        slug="parking-lot-problem",
        hero=hero_path,
        supports=support_paths,
        strips=strip_paths,
        output=out_path,
        canvas_size=(1200, 750),
        ground="olive",
        fade_to_parchment=True,
        grain=True,
        vignette=True,
    )

    print(f"\nDone. Output: {out_path}")
    print(f"Size: {result.size[0]}x{result.size[1]}px")
