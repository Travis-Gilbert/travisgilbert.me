"""
Collage Composition Engine
Travis Gilbert — travisgilbert.me

Generates a single, unified editorial collage image from:
  - One HERO object (dominant center focal point, ~55% canvas height)
  - Several SUPPORT objects (smaller fragments clustered tight around hero)
  - STRIP fragments (vertical document/book-spine style elements)
  - Color block rectangles (flat geometric patches for depth)
  - Geometric ACCENT shapes (circles + small squares)
  - Gesture scribble lines (expressive bezier curves, a la Blake Cale)
  - Thin sketch CONNECTOR lines

Output: a single flat image ready to use as an essay hero.

Usage:
    from collage_engine import compose

    result = compose(
        slug="parking-lot-problem",
        hero="photos/cutouts/parking-structure.png",
        supports=[
            "photos/cutouts/zoning-map.png",
            "photos/cutouts/hamming-book.png",
            "photos/cutouts/coffee-mug.png",
        ],
        strips=[
            "photos/cutouts/newyorker-strip.png",
        ],
        output="public/collage/parking-lot-problem.jpg"
    )
"""

import math
import struct
import zlib
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance


# ── Brand palette (Patent Parchment + Hero ground) ──────────────────
PARCHMENT       = (240, 235, 228)
HERO_GROUND     = (42,  40,  36)   # #2A2824 -- warm near-black
OLIVE_GROUND    = (58,  56,  32)   # #3A3820 -- dark olive (closer to Atlantic ref)
TERRACOTTA      = (180, 90,  45)   # #B45A2D
TERRACOTTA_LITE = (212, 135, 90)   # #D4875A
TEAL            = (45,  95,  107)  # #2D5F6B
GOLD            = (196, 154, 74)   # #C49A4A
INK             = (42,  36,  32)   # #2A2420
CREAM           = (240, 235, 228)  # same as parchment
CREAM_DARK      = (212, 204, 196)  # #D4CCC4
NEAR_BLACK      = (26,  24,  16)   # #1A1810
HOT_PINK        = (232, 80,  120)  # accent pop color (a la Blake Cale)


# ── Seeded PRNG (mulberry32, matches JS implementation) ──────────────
def _hash_str(s: str) -> int:
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h

def make_rng(seed: str):
    """Returns a callable that produces floats in [0, 1), seeded by slug string."""
    s = [_hash_str(seed)]
    def rng():
        s[0] ^= s[0] >> 15
        s[0] = (s[0] * 0x2C9277B5) & 0xFFFFFFFF
        s[0] ^= s[0] + (s[0] * 0x3D) & 0xFFFFFFFF
        s[0] ^= s[0] >> 14
        return (s[0] & 0xFFFFFFFF) / 4294967296
    return rng

def lerp(a, b, t):
    return a + (b - a) * t

def pick(lst, rng):
    return lst[int(rng() * len(lst))]

def clamp(v, lo, hi):
    return max(lo, min(hi, v))


# ── Grain texture ────────────────────────────────────────────────────
def add_grain(img: Image.Image, intensity: float = 0.03) -> Image.Image:
    """Adds a film-grain / paper-noise texture over the image."""
    arr = np.array(img).astype(np.float32)
    noise = np.random.normal(0, intensity * 255, arr.shape[:2])
    if arr.ndim == 3:
        noise = noise[:, :, np.newaxis]
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


# ── Blueprint grid overlay ───────────────────────────────────────────
def draw_blueprint_grid(draw: ImageDraw.Draw, w: int, h: int,
                        cell: int = 40, opacity: float = 0.12,
                        color=(255, 255, 255)) -> None:
    alpha = int(opacity * 255)
    line_color = color + (alpha,)
    for x in range(0, w, cell):
        draw.line([(x, 0), (x, h)], fill=line_color, width=1)
    for y in range(0, h, cell):
        draw.line([(0, y), (w, y)], fill=line_color, width=1)


# ── Sketch lines (straight) ─────────────────────────────────────────
def draw_sketch_lines(draw: ImageDraw.Draw, w: int, h: int,
                      n: int, rng, color=(255, 255, 255), opacity=0.15) -> None:
    """Thin connector lines drawn as simple line segments."""
    alpha = int(opacity * 255)
    line_col = color + (alpha,)
    for _ in range(n):
        x1 = int(lerp(w * 0.1, w * 0.9, rng()))
        y1 = int(lerp(h * 0.05, h * 0.9, rng()))
        x2 = int(lerp(w * 0.1, w * 0.9, rng()))
        y2 = int(lerp(h * 0.05, h * 0.9, rng()))
        draw.line([(x1, y1), (x2, y2)], fill=line_col, width=1)


# ── Gesture scribble lines (bezier curves) ───────────────────────────
def draw_gesture_lines(draw: ImageDraw.Draw, w: int, h: int,
                       n: int, rng, color=TERRACOTTA_LITE, opacity=0.35) -> None:
    """
    Expressive, loose bezier curves. Blake Cale uses these as red/terracotta
    scribble marks that feel hand-drawn. Approximated as multi-segment polylines.
    """
    alpha = int(opacity * 255)
    line_col = color + (alpha,)
    for _ in range(n):
        # 3-point bezier control points, clustered in center
        p0 = (int(lerp(w * 0.15, w * 0.85, rng())),
              int(lerp(h * 0.10, h * 0.70, rng())))
        p1 = (int(lerp(w * 0.20, w * 0.80, rng())),
              int(lerp(h * 0.10, h * 0.70, rng())))
        p2 = (int(lerp(w * 0.15, w * 0.85, rng())),
              int(lerp(h * 0.10, h * 0.70, rng())))
        # draw as ~20 segment polyline approximation
        steps = 20
        points = []
        for s in range(steps + 1):
            t = s / steps
            x = int((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0])
            y = int((1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1])
            points.append((x, y))
        for j in range(len(points) - 1):
            draw.line([points[j], points[j + 1]], fill=line_col, width=2)


# ── Color block rectangles ──────────────────────────────────────────
BLOCK_COLORS = [
    NEAR_BLACK,
    TERRACOTTA,
    TEAL,
    HOT_PINK,
    CREAM_DARK,
    GOLD,
]

def draw_color_blocks(canvas: Image.Image, overlay: Image.Image,
                      w: int, h: int, n: int, rng) -> None:
    """
    Flat colored rectangles used as compositional patches. These create depth
    by peeking out behind and between photo cutouts. Central to the Blake Cale
    aesthetic: not decorative, structural.
    """
    draw = ImageDraw.Draw(overlay)
    for _ in range(n):
        color = pick(BLOCK_COLORS, rng)
        alpha = int(lerp(140, 220, rng()))
        fill = color + (alpha,)

        # blocks vary from small squares to larger rectangles
        bw = int(lerp(w * 0.06, w * 0.22, rng()))
        bh = int(lerp(h * 0.08, h * 0.28, rng()))

        # Allow blocks to extend past left/right/top edges (bleed effect)
        bx = int(lerp(w * -0.08, w * 0.88 - bw, rng()))
        by = int(lerp(h * -0.06, h * 0.58, rng()))

        # slight rotation for organic feel
        angle = lerp(-8, 8, rng())

        # create the block as a separate image, rotate, paste
        block = Image.new("RGBA", (bw, bh), fill)
        if abs(angle) > 0.5:
            block = block.rotate(angle, expand=True, resample=Image.BICUBIC)
        bwf, bhf = block.size
        canvas.paste(block, (bx, by), block)


# ── Geometric accent shapes (circles + small squares) ────────────────
CIRCLE_OPTIONS = [
    (NEAR_BLACK,    1.0, False),
    (TERRACOTTA,    0.88, True),    # X mark
    (CREAM,         0.80, False),
    (CREAM_DARK,    0.75, False),
    (GOLD,          0.70, False),
    (TEAL,          0.65, False),
    (HOT_PINK,      0.60, False),
]

def draw_accent_shapes(canvas: Image.Image, overlay: Image.Image,
                       w: int, h: int, n: int, rng) -> None:
    """
    Small geometric punctuation: mix of circles and tiny squares.
    The small black squares scattered across the composition are a
    Blake Cale signature (visible in HBR, UVA Darden, Sojo pieces).
    """
    draw = ImageDraw.Draw(overlay)
    for _ in range(n):
        is_square = rng() < 0.4  # 40% squares, 60% circles
        color, alpha_scale, has_x = pick(CIRCLE_OPTIONS, rng)
        alpha = int(alpha_scale * 220)
        fill = color + (alpha,)

        # keep shapes in the upper 68% so they don't crowd the text zone
        cx = int(lerp(20, w - 20, rng()))
        cy = int(lerp(20, h * 0.68, rng()))

        if is_square:
            # small squares: 4-14px
            side = int(lerp(4, 14, rng()))
            draw.rectangle(
                [cx - side, cy - side, cx + side, cy + side],
                fill=fill
            )
        else:
            r = int(lerp(w * 0.012, w * 0.045, rng()))
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)

            if has_x:
                xc = int(r * 0.45)
                x_col = CREAM + (180,)
                draw.line([(cx - xc, cy - xc), (cx + xc, cy + xc)],
                          fill=x_col, width=max(1, r // 8))
                draw.line([(cx + xc, cy - xc), (cx - xc, cy + xc)],
                          fill=x_col, width=max(1, r // 8))


# ── Dot grid pattern (tiny squares in a loose grid) ──────────────────
def draw_dot_grid(overlay: Image.Image, w: int, h: int, rng,
                  density: float = 0.3, color=NEAR_BLACK, opacity=0.6) -> None:
    """
    Scattered tiny square dots in a loose grid pattern. These appear
    throughout Blake Cale's work as a subtle data/digital texture.
    """
    draw = ImageDraw.Draw(overlay)
    alpha = int(opacity * 255)
    fill = color + (alpha,)
    step = 28
    for gx in range(0, w, step):
        for gy in range(0, int(h * 0.72), step):
            if rng() < density:
                s = 2
                draw.rectangle([gx, gy, gx + s, gy + s], fill=fill)


# ── Strip fragments (vertical document / book-spine rectangles) ──────
def make_synthetic_strip(w_strip: int, h_strip: int, label: str,
                         bg_color=(232, 224, 214), rng=None) -> Image.Image:
    """
    Fallback: creates a synthetic strip if no image file provided.
    Simulates a page or book spine fragment.
    """
    img = Image.new("RGBA", (w_strip, h_strip), bg_color + (255,))
    draw = ImageDraw.Draw(img)

    # ruled lines
    for y in range(20, h_strip, 18):
        draw.line([(4, y), (w_strip - 4, y)],
                  fill=(180, 170, 160, 60), width=1)

    # vertical label text (simulated as a colored bar)
    bar_w = 18
    bar_x = w_strip // 2 - bar_w // 2
    draw.rectangle([bar_x, 10, bar_x + bar_w, h_strip - 10],
                   fill=TERRACOTTA + (40,))

    # subtle border
    draw.rectangle([0, 0, w_strip - 1, h_strip - 1],
                   outline=(180, 170, 160, 120), width=1)
    return img


def place_strip(canvas: Image.Image, strip_img: Image.Image,
                x: int, y: int, angle: float) -> None:
    """Paste a strip fragment with rotation onto canvas."""
    rotated = strip_img.rotate(angle, expand=True, resample=Image.BICUBIC)
    if rotated.mode != "RGBA":
        rotated = rotated.convert("RGBA")
    rx, ry = rotated.size
    px = x - rx // 2
    py = y - ry // 2
    canvas.paste(rotated, (px, py), rotated)


# ── Load + prepare a cutout PNG ──────────────────────────────────────
def load_cutout(path: str) -> Image.Image:
    """Load a PNG with transparency (background already removed)."""
    img = Image.open(path).convert("RGBA")
    return img

def resize_to_height(img: Image.Image, target_h: int) -> Image.Image:
    ratio = target_h / img.height
    return img.resize((int(img.width * ratio), target_h),
                      resample=Image.LANCZOS)

def resize_to_fit(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    img.thumbnail((max_w, max_h), Image.LANCZOS)
    return img


# ── Torn edge mask ───────────────────────────────────────────────────
def apply_torn_edge(img: Image.Image, rng, edge_width: int = 12) -> Image.Image:
    """
    Apply a rough torn-paper edge mask to an image. Instead of clean rectangular
    borders, this creates organic, slightly ragged edges like a physical collage.
    """
    w, h = img.size
    if w < 40 or h < 40:
        return img

    mask = Image.new("L", (w, h), 255)
    draw = ImageDraw.Draw(mask)

    # top edge
    for x in range(0, w, 3):
        offset = int(lerp(0, edge_width, rng()))
        draw.rectangle([x, 0, x + 3, offset], fill=0)

    # bottom edge
    for x in range(0, w, 3):
        offset = int(lerp(0, edge_width, rng()))
        draw.rectangle([x, h - offset, x + 3, h], fill=0)

    # left edge
    for y in range(0, h, 3):
        offset = int(lerp(0, edge_width, rng()))
        draw.rectangle([0, y, offset, y + 3], fill=0)

    # right edge
    for y in range(0, h, 3):
        offset = int(lerp(0, edge_width, rng()))
        draw.rectangle([w - offset, y, w, y + 3], fill=0)

    # blur the mask slightly for softness
    mask = mask.filter(ImageFilter.GaussianBlur(radius=1))

    img_copy = img.copy()
    if img_copy.mode == "RGBA":
        r, g, b, a = img_copy.split()
        a = Image.fromarray(np.minimum(np.array(a), np.array(mask)))
        img_copy = Image.merge("RGBA", (r, g, b, a))
    else:
        img_copy.putalpha(mask)

    return img_copy


# ── Vignette / edge darkening ────────────────────────────────────────
def apply_vignette(img: Image.Image, strength: float = 0.45) -> Image.Image:
    """Darken the edges slightly for a spotlight feel."""
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    steps = 40
    for i in range(steps):
        t = i / steps
        alpha = int((1 - t) * strength * 255)
        pad_x = int(t * w * 0.49)
        pad_y = int(t * h * 0.49)
        x0, y0 = pad_x, pad_y
        x1, y1 = max(x0 + 1, w - pad_x), max(y0 + 1, h - pad_y)
        draw.ellipse([x0, y0, x1, y1], fill=alpha)
    arr = np.array(img).astype(np.float32)
    mask_arr = np.array(mask).astype(np.float32) / 255.0
    if arr.ndim == 3 and arr.shape[2] >= 3:
        for c in range(3):
            arr[:, :, c] *= (1 - mask_arr * strength)
    result = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    return result


# ── Bottom gradient fade to parchment ───────────────────────────────
def apply_bottom_fade(img: Image.Image, fade_start: float = 0.72,
                      target_color=PARCHMENT) -> Image.Image:
    """
    Blend the bottom of the image toward parchment.
    fade_start = fraction of height where fade begins (0=top, 1=bottom)
    """
    w, h = img.size
    arr = np.array(img).astype(np.float32)
    target = np.array(target_color, dtype=np.float32)

    fade_px = int(fade_start * h)
    for y in range(fade_px, h):
        t = (y - fade_px) / max(1, h - fade_px)
        # smoothstep
        t = t * t * (3 - 2 * t)
        arr[y, :, :3] = arr[y, :, :3] * (1 - t) + target * t

    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


# ── Subtle color grade toward the brand palette ──────────────────────
def color_grade(img: Image.Image, warmth: float = 0.08) -> Image.Image:
    """Push the image slightly warm to match the patent parchment palette."""
    arr = np.array(img).astype(np.float32)
    arr[:, :, 0] = np.clip(arr[:, :, 0] * (1 + warmth), 0, 255)
    arr[:, :, 2] = np.clip(arr[:, :, 2] * (1 - warmth * 0.5), 0, 255)
    return Image.fromarray(arr.astype(np.uint8))


# ── Main compose function ────────────────────────────────────────────
def compose(
    slug: str,
    hero: Optional[str] = None,
    supports: Optional[list] = None,
    strips: Optional[list] = None,
    output: str = "collage_output.jpg",
    canvas_size: tuple = (1200, 750),
    ground: str = "olive",           # "olive" | "dark" | hex string
    fade_to_parchment: bool = True,
    grain: bool = True,
    vignette: bool = True,
    torn_edges: bool = True,
) -> Image.Image:
    """
    Compose a single editorial collage image.

    Parameters
    ----------
    slug        : essay slug (PRNG seed for deterministic layout)
    hero        : path to the dominant center image (PNG with transparency)
    supports    : list of paths to smaller fragment images
    strips      : list of paths to vertical strip images (book spines, pages)
    output      : output file path
    canvas_size : (width, height) of output image
    ground      : background color ("olive", "dark", or "#RRGGBB")
    fade_to_parchment : whether to fade the bottom to parchment
    grain       : add film grain texture
    vignette    : darken the edges
    torn_edges  : apply torn paper edge effect to fragments
    """
    rng = make_rng(slug)
    w, h = canvas_size
    supports = supports or []
    strips   = strips   or []

    # ── 1. Ground ────────────────────────────────────────────────────
    if ground == "olive":
        bg_color = OLIVE_GROUND
    elif ground == "dark":
        bg_color = HERO_GROUND
    elif ground.startswith("#"):
        hx = ground.lstrip("#")
        bg_color = tuple(int(hx[i:i+2], 16) for i in (0, 2, 4))
    else:
        bg_color = OLIVE_GROUND

    canvas = Image.new("RGBA", (w, h), bg_color + (255,))

    # ── 2. Blueprint grid (very subtle) ───────────────────────────────
    grid_overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_blueprint_grid(ImageDraw.Draw(grid_overlay), w, h,
                        cell=40, opacity=0.05)
    canvas = Image.alpha_composite(canvas, grid_overlay)

    # ── 2b. Scattered dot grid (tiny squares, data texture) ──────────
    dot_overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_dot_grid(dot_overlay, w, h, rng, density=0.12, opacity=0.5)
    canvas = Image.alpha_composite(canvas, dot_overlay)

    # ── 3. Color block rectangles (low z, behind everything) ─────────
    block_overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    n_blocks = int(lerp(3, 6, rng()))
    draw_color_blocks(canvas, block_overlay, w, h, n_blocks, rng)
    canvas = Image.alpha_composite(canvas, block_overlay)

    # ── 4. Strip fragments (background layer, behind hero) ───────────
    n_strips = max(2, len(strips) + 1)
    for i in range(n_strips):
        strip_w = int(lerp(w * 0.06, w * 0.14, rng()))
        strip_h = int(lerp(h * 0.55, h * 0.90, rng()))

        if i < len(strips) and Path(strips[i]).exists():
            strip_img = load_cutout(strips[i])
            strip_img = resize_to_fit(strip_img, strip_w * 2, strip_h)
        else:
            strip_img = make_synthetic_strip(strip_w, strip_h,
                                              f"STRIP-{i}", rng=rng)

        if torn_edges:
            strip_img = apply_torn_edge(strip_img, rng, edge_width=8)

        angle = lerp(-12, 12, rng())
        # Allow strips to bleed off left, right, and top edges.
        # Negative x/y values mean the fragment extends beyond the canvas,
        # which Pillow clips automatically (creating the bleed effect).
        sx = int(lerp(w * -0.05, w * 0.85, rng()))
        sy = int(lerp(-strip_h * 0.35, h * 0.15, rng()))
        place_strip(canvas, strip_img, sx, sy, angle)

    # ── 5. Support objects (tight cluster around hero center) ────────
    # MUCH tighter than before: objects physically overlap the hero
    # Support positions allow bleed off top, left, and right edges.
    # Positions near 0.0 or negative will clip at the canvas boundary,
    # creating the editorial bleed effect (fragments extend beyond the frame).
    support_positions = [
        # (x_lo, x_hi, y_lo, y_hi, sc_lo, sc_hi)
        (0.02, 0.32, -0.05, 0.35, 0.22, 0.40),   # upper-left, bleeds left+top
        (0.65, 0.95, -0.02, 0.30, 0.20, 0.38),   # upper-right, bleeds right+top
        (0.00, 0.25, 0.30, 0.58, 0.18, 0.34),    # left edge, mid-height, bleeds left
        (0.72, 0.98, 0.28, 0.55, 0.18, 0.32),    # right edge, mid-height, bleeds right
        (0.30, 0.55, 0.48, 0.66, 0.16, 0.30),    # below hero center (no bleed)
    ]

    for i, img_path in enumerate(supports):
        if not Path(img_path).exists():
            continue
        simg = load_cutout(img_path)

        pos = support_positions[i % len(support_positions)]
        x_lo, x_hi, y_lo, y_hi, sc_lo, sc_hi = pos

        target_h = int(lerp(h * sc_lo, h * sc_hi, rng()))
        simg = resize_to_height(simg, target_h)

        if torn_edges:
            simg = apply_torn_edge(simg, rng, edge_width=10)

        cx = int(lerp(w * x_lo, w * x_hi, rng()))
        cy = int(lerp(h * y_lo, h * y_hi, rng()))
        angle = lerp(-10, 10, rng())

        rotated = simg.rotate(angle, expand=True, resample=Image.BICUBIC)
        px = cx - rotated.width  // 2
        py = cy - rotated.height // 2
        canvas.paste(rotated, (px, py), rotated)

    # ── 6. HERO object (highest z, large, center-dominant) ───────────
    if hero and Path(hero).exists():
        hero_img = load_cutout(hero)

        # Hero occupies roughly 50-65% of canvas height
        hero_h = int(lerp(h * 0.50, h * 0.65, rng()))
        hero_img = resize_to_height(hero_img, hero_h)

        if torn_edges:
            hero_img = apply_torn_edge(hero_img, rng, edge_width=14)

        # Center-weighted position: clustered tight in middle
        hero_cx = int(lerp(w * 0.38, w * 0.58, rng()))
        hero_cy = int(lerp(h * 0.26, h * 0.42, rng()))

        # Very slight rotation (hero stays mostly upright)
        hero_angle = lerp(-3, 3, rng())
        hero_rot = hero_img.rotate(hero_angle, expand=True,
                                   resample=Image.BICUBIC)

        hpx = hero_cx - hero_rot.width  // 2
        hpy = hero_cy - hero_rot.height // 2
        canvas.paste(hero_rot, (hpx, hpy), hero_rot)

    # ── 7. Gesture scribble lines (expressive bezier curves) ─────────
    gesture_overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    n_gestures = int(lerp(2, 5, rng()))
    draw_gesture_lines(ImageDraw.Draw(gesture_overlay), w, h,
                       n_gestures, rng, color=TERRACOTTA_LITE, opacity=0.30)
    canvas = Image.alpha_composite(canvas, gesture_overlay)

    # ── 8. Sketch connector lines (over fragments, under circles) ────
    line_overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_sketch_lines(ImageDraw.Draw(line_overlay), w, h,
                      n=int(lerp(4, 8, rng())), rng=rng,
                      color=CREAM, opacity=0.12)
    canvas = Image.alpha_composite(canvas, line_overlay)

    # ── 9. Accent shapes (circles + small squares, top z) ────────────
    shape_overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_accent_shapes(canvas, shape_overlay, w, h,
                       n=int(lerp(7, 12, rng())), rng=rng)
    canvas = Image.alpha_composite(canvas, shape_overlay)

    # ── 10. Flatten to RGB for post-processing ────────────────────────
    result = canvas.convert("RGB")

    # ── 11. Vignette ──────────────────────────────────────────────────
    if vignette:
        result = apply_vignette(result, strength=0.35)

    # ── 12. Grain ─────────────────────────────────────────────────────
    if grain:
        np.random.seed(_hash_str(slug) % (2**31))
        result = add_grain(result, intensity=0.025)

    # ── 13. Warm color grade ──────────────────────────────────────────
    result = color_grade(result, warmth=0.05)

    # ── 14. Bottom fade to parchment ──────────────────────────────────
    if fade_to_parchment:
        result = apply_bottom_fade(result, fade_start=0.70)

    # ── 15. Save ──────────────────────────────────────────────────────
    out_path = Path(output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(str(out_path), quality=93)
    print(f"Saved: {out_path}  ({w}x{h}px)")
    return result


if __name__ == "__main__":
    print("collage_engine.py loaded. Run test_compose.py to generate a sample.")
