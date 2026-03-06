# Mobile QA and Lighthouse Checklist

## Devices
- iPhone SE (small-screen baseline)
- iPhone 13 (mid-size iOS baseline)
- iPhone 15 Pro Max (large-screen iOS safe-area baseline)
- Pixel A-class device (mid-tier Android baseline)

## Browsers
- Safari on iOS
- Chrome on Android

## Route Matrix
- `/`
- `/essays/[slug]`
- `/field-notes/[slug]`
- `/research`
- `/studio`
- `/networks`
- `/commonplace`

## Mobile UX Checks (Per Route)
- No horizontal overflow or clipped content
- Tap targets are thumb-friendly (`~44px` min target)
- Fixed headers/footers respect safe areas (`env(safe-area-inset-*)`)
- No content hidden behind fixed bottom nav or home indicator
- Readability remains comfortable (line-height, heading scale, spacing)
- Motion is reduced when `prefers-reduced-motion: reduce` is active

## App Shell Checks
- Drawer opens from hamburger and closes by backdrop tap
- Bottom tabs switch views one-handed without layout jumps
- Timeline/list scrolling remains smooth on long datasets
- Graph-heavy tabs lazy-load and do not block first interaction

## Lighthouse Targets (Mobile)
- Performance `>= 85`
- Accessibility `>= 95`
- Best Practices `>= 90`

## Repeatable Lighthouse Commands
```bash
# 1) Start app (new terminal)
npm run dev

# 2) Run mobile Lighthouse checks (this terminal)
npx lighthouse http://localhost:3000 \
  --form-factor=mobile \
  --output=html \
  --output-path=./.next/lighthouse-home-mobile.html

npx lighthouse http://localhost:3000/research \
  --form-factor=mobile \
  --output=html \
  --output-path=./.next/lighthouse-research-mobile.html

npx lighthouse http://localhost:3000/studio \
  --form-factor=mobile \
  --output=html \
  --output-path=./.next/lighthouse-studio-mobile.html

npx lighthouse http://localhost:3000/networks \
  --form-factor=mobile \
  --output=html \
  --output-path=./.next/lighthouse-networks-mobile.html

npx lighthouse http://localhost:3000/commonplace \
  --form-factor=mobile \
  --output=html \
  --output-path=./.next/lighthouse-commonplace-mobile.html
```

## Regression Gate
- Desktop layout remains unchanged for `(main)`, `(studio)`, `(networks)`, and `(commonplace)` at `>=1024px`
- Mobile shell behavior only applies below app-shell breakpoint
