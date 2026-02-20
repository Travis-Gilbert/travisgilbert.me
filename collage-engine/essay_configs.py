"""
essay_configs.py

Define the composition for each essay here.
The engine uses these configs to generate the collage images at build time.

Structure per essay:
  - slug: must match your content system's slug (used as PRNG seed)
  - hero: path to the ONE dominant center object (post-background-removal PNG)
  - supports: list of smaller fragment objects (up to 5 recommended)
  - strips: list of vertical strip fragments (book spines, torn pages)
  - ground: "olive" (default, matches Atlantic reference) | "dark" | "#hexcolor"

Choosing your hero object:
  The hero is the FOCAL POINT — one large, interesting object that
  the composition centers on. Everything else orbits it.
  Good hero candidates: a photographed object with strong silhouette,
  an interesting texture, something directly related to the essay subject.

  Parking essay → cracked concrete fragment, a parking permit, an aerial
  Inequality essay → torn dollar bill, a housing document, an eviction notice
  Flint water essay → a water pipe cross-section, a water sample bottle
"""

ESSAYS = [

    {
        "slug": "parking-lot-problem",
        "title": "The Parking Lot Problem",
        "hero": "photos/cutouts/parking-structure.png",
        "supports": [
            "photos/cutouts/zoning-map.png",
            "photos/cutouts/hamming-book.png",
            "photos/cutouts/coffee-mug.png",
            "photos/cutouts/new-yorker.png",
        ],
        "strips": [
            "photos/cutouts/flow-trip-strip.png",
        ],
        "ground": "olive",
    },

    {
        "slug": "curb-extensions-pedestrian-safety",
        "title": "The Curb Extension",
        "hero": "photos/cutouts/sketchbook-open.png",
        "supports": [
            "photos/cutouts/raspberry-pi.png",
            "photos/cutouts/poetics-of-space-book.png",
            "photos/cutouts/coffee-mug.png",
        ],
        "strips": [
            "photos/cutouts/hamming-book-spine.png",
            "photos/cutouts/newyorker-strip.png",
        ],
        "ground": "olive",
    },

    {
        "slug": "wealth-inequality-built-environment",
        "title": "Wealth Inequality and the Built Environment",
        "hero": "photos/cutouts/utopia-of-rules-book.png",
        "supports": [
            "photos/cutouts/zoning-map.png",
            "photos/cutouts/camera.png",
            "photos/cutouts/notebook.png",
            "photos/cutouts/hoto-toolkit.png",
        ],
        "strips": [
            "photos/cutouts/flow-trip-strip.png",
        ],
        "ground": "olive",
    },

    {
        "slug": "flint-water-design-failure",
        "title": "Flint and Infrastructure Neglect",
        "hero": "photos/cutouts/raspberry-pi.png",
        "supports": [
            "photos/cutouts/notebook-journal.png",
            "photos/cutouts/glasses.png",
            "photos/cutouts/coffee-mug.png",
        ],
        "strips": [
            "photos/cutouts/hamming-book-spine.png",
        ],
        "ground": "dark",
    },

]

# ── Desk object reference ────────────────────────────────────────────
# This is your full photo shoot list. Each item needs:
#   1. A raw photo: photos/raw/<name>.jpg
#   2. Background removed: python3 remove_bg.py photos/raw/<name>.jpg
#   3. Resulting cutout lands at: photos/cutouts/<name>.png

PHOTO_SHOOT_CHECKLIST = [
    # Books (shoot cover and spine as separate photos)
    "hamming-book",           # The Art of Doing Science and Engineering — blue hardcover
    "hamming-book-spine",     # just the spine, vertical
    "poetics-of-space-book",  # The Poetics of Space — shoot cover
    "utopia-of-rules-book",   # The Utopia of Rules — shoot cover or spine
    "strategic-pm-book",      # Strategic Project Management Made Simple
    "flow-trip-magazine",     # Flow Trip — The Whale Issue
    "flow-trip-strip",        # just the spine strip, vertical
    "new-yorker",             # The New Yorker — cover, slightly fanned
    "newyorker-strip",        # spine/edge of New Yorker as a strip

    # Objects (shoot on clean background — white table or dark cloth)
    "camera",                 # your camera — interesting angle
    "raspberry-pi",           # Pi board — straight overhead or 3/4 angle
    "coffee-mug",             # one mug — interesting angle, slight steam optional
    "sketchbook-open",        # open sketchbook with some sketches/notes visible
    "sketchbook-closed",      # closed sketchbook as a flat object
    "notebook-journal",       # journaling notebook
    "glasses",                # glasses + cleaner, composed together
    "hoto-toolkit",           # HOTO toolkit — open if possible
    "green-brothers-photo",   # the photo with John and Hank Green

    # Paper fragments (scan or photograph flat)
    "zoning-map",             # a printed city zoning map
    "parking-permit",         # a parking permit or ticket
]
