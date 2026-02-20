"""
remove_bg.py

Strips the background from your desk photos, producing PNG cutouts
with transparent backgrounds ready for the composition engine.

Run this ONCE per photo. The resulting PNGs go into photos/cutouts/.

Usage:
    # Single file
    python3 remove_bg.py photos/raw/hamming-book.jpg

    # Whole folder
    python3 remove_bg.py photos/raw/

    # With custom output dir
    python3 remove_bg.py photos/raw/ --out photos/cutouts/

Tips for best cutout quality:
  - Photograph objects on a plain light or dark background (not parchment)
  - Natural window light beats overhead lighting — fewer harsh shadows
  - Shoot straight-on for flat objects (books, magazines, maps)
  - Shoot at a slight angle for 3D objects (Pi board, mug, camera)
  - 12 megapixel phone camera is plenty — no need for DSLR
  - After removal, inspect each PNG and touch up in any photo editor if edges look rough
"""

import sys
import argparse
from pathlib import Path


def remove_background(input_path: Path, output_path: Path) -> None:
    """Remove background from a single image file using rembg."""
    try:
        from rembg import remove
    except ImportError:
        print("ERROR: rembg not installed. Run: pip install rembg onnxruntime")
        sys.exit(1)

    from PIL import Image
    import io

    print(f"Processing: {input_path.name}")

    with open(input_path, "rb") as f:
        input_data = f.read()

    output_data = remove(input_data)
    img = Image.open(io.BytesIO(output_data)).convert("RGBA")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(output_path), format="PNG")
    print(f"  Saved:  {output_path}")


def process_directory(input_dir: Path, output_dir: Path) -> None:
    """Process all images in a directory."""
    extensions = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
    files = [f for f in input_dir.iterdir()
             if f.suffix.lower() in extensions and not f.name.startswith(".")]

    if not files:
        print(f"No image files found in {input_dir}")
        return

    print(f"Found {len(files)} image(s) to process\n")
    for f in sorted(files):
        out = output_dir / (f.stem + ".png")
        if out.exists():
            print(f"  Skipping {f.name} (output already exists)")
            continue
        try:
            remove_background(f, out)
        except Exception as e:
            print(f"  ERROR on {f.name}: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Remove backgrounds from desk photos for the collage engine"
    )
    parser.add_argument("input",
                        help="Image file or directory of images")
    parser.add_argument("--out", default=None,
                        help="Output directory (default: photos/cutouts/)")
    args = parser.parse_args()

    input_path = Path(args.input)
    default_out = Path("photos/cutouts")
    output_dir  = Path(args.out) if args.out else default_out

    if input_path.is_dir():
        process_directory(input_path, output_dir)
    elif input_path.is_file():
        out = output_dir / (input_path.stem + ".png")
        remove_background(input_path, out)
    else:
        print(f"ERROR: {input_path} not found")
        sys.exit(1)


if __name__ == "__main__":
    main()
