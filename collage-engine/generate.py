"""
generate.py

Production script — generates all essay collage images from essay_configs.py.
Run this when you've added new photos or updated a config.

Usage:
    # Generate all essays
    python3 generate.py

    # Regenerate a single essay
    python3 generate.py --slug parking-lot-problem

    # Preview size (faster, for checking composition)
    python3 generate.py --preview

    # Full resolution
    python3 generate.py --full
"""

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from collage_engine import compose
from essay_configs import ESSAYS


FULL_SIZE    = (1400, 875)   # final output (16:10-ish)
PREVIEW_SIZE = (900,  562)   # quick preview for checking composition
# Output to project-level public/collage/ (one directory up from collage-engine/)
PROJECT_ROOT = Path(__file__).parent.parent
OUTPUT_DIR   = PROJECT_ROOT / "public" / "collage"


def generate_essay(config: dict, size: tuple, force: bool = False) -> bool:
    slug = config["slug"]
    out  = OUTPUT_DIR / f"{slug}.jpg"

    if out.exists() and not force:
        print(f"  SKIP   {slug}  (already exists, use --force to regenerate)")
        return False

    # Check if hero exists
    hero = config.get("hero")
    if hero and not Path(hero).exists():
        print(f"  WARN   {slug}  hero not found: {hero}")
        print(f"         Run: python3 remove_bg.py photos/raw/<your-hero-photo>.jpg")
        hero = None  # will compose without hero (circles + strips only)

    supports = [p for p in config.get("supports", []) if Path(p).exists()]
    missing = len(config.get("supports", [])) - len(supports)
    if missing:
        print(f"  INFO   {slug}  {missing} support image(s) not found, composing without them")

    strips = [p for p in config.get("strips", []) if Path(p).exists()]

    t0 = time.time()
    compose(
        slug=slug,
        hero=hero,
        supports=supports,
        strips=strips,
        output=str(out),
        canvas_size=size,
        ground=config.get("ground", "olive"),
        fade_to_parchment=True,
        grain=True,
        vignette=True,
    )
    elapsed = time.time() - t0
    print(f"  OK     {slug}  ({elapsed:.1f}s)")
    return True


def main():
    parser = argparse.ArgumentParser(description="Generate essay collage images")
    parser.add_argument("--slug",    default=None, help="Only regenerate this slug")
    parser.add_argument("--preview", action="store_true", help="Use preview size (900x562)")
    parser.add_argument("--full",    action="store_true", help="Use full size (1400x875)")
    parser.add_argument("--force",   action="store_true", help="Overwrite existing outputs")
    args = parser.parse_args()

    size = PREVIEW_SIZE if args.preview else FULL_SIZE
    print(f"Output size: {size[0]}x{size[1]}px")
    print(f"Output dir:  {OUTPUT_DIR}\n")

    essays = ESSAYS
    if args.slug:
        essays = [e for e in ESSAYS if e["slug"] == args.slug]
        if not essays:
            print(f"ERROR: no config found for slug '{args.slug}'")
            sys.exit(1)

    t_total = time.time()
    generated = 0
    for cfg in essays:
        generated += generate_essay(cfg, size, force=args.force)

    print(f"\nDone. Generated {generated}/{len(essays)} image(s) "
          f"in {time.time() - t_total:.1f}s")
    print(f"Files in: {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
