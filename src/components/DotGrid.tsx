import { useRef, useEffect } from 'preact/hooks';

interface Props {
  dotSpacing?: number;
  dotRadius?: number;
  dotColor?: string;
  influenceRadius?: number;
  repulsionStrength?: number;
  springStiffness?: number;
  damping?: number;
}

const TWO_PI = Math.PI * 2;

export default function DotGrid({
  dotSpacing = 20,
  dotRadius = 0.75,
  dotColor = 'rgba(160, 154, 144, 0.5)',
  influenceRadius = 100,
  repulsionStrength = 25,
  springStiffness = 0.15,
  damping = 0.75,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── Mutable state ────────────────────────────
    let mouseX = -9999;
    let mouseY = -9999;
    let cols = 0;
    let rows = 0;
    let dotCount = 0;
    let homeX = new Float32Array(0);
    let homeY = new Float32Array(0);
    let curX = new Float32Array(0);
    let curY = new Float32Array(0);
    let vx = new Float32Array(0);
    let vy = new Float32Array(0);
    let animating = false;
    let idleFrames = 0;
    let rafId = 0;
    let dpr = window.devicePixelRatio || 1;

    const influenceRadius2 = influenceRadius * influenceRadius;
    const isTouchOnly =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none)').matches;

    // ── Grid setup ───────────────────────────────
    function allocateGrid() {
      dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;

      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;

      // Add 2 extra rows/cols so dots entering from edges are pre-positioned
      cols = Math.ceil(w / dotSpacing) + 2;
      rows = Math.ceil(h / dotSpacing) + 2;
      dotCount = cols * rows;

      homeX = new Float32Array(dotCount);
      homeY = new Float32Array(dotCount);
      curX = new Float32Array(dotCount);
      curY = new Float32Array(dotCount);
      vx = new Float32Array(dotCount);
      vy = new Float32Array(dotCount);

      computeHomePositions();

      // Snap current positions to home (no animation on resize)
      curX.set(homeX);
      curY.set(homeY);
    }

    function computeHomePositions() {
      const offsetX = -(window.scrollX % dotSpacing);
      const offsetY = -(window.scrollY % dotSpacing);

      let i = 0;
      for (let row = -1; row < rows - 1; row++) {
        for (let col = -1; col < cols - 1; col++) {
          homeX[i] = col * dotSpacing + offsetX;
          homeY[i] = row * dotSpacing + offsetY;
          i++;
        }
      }
    }

    // ── Drawing ──────────────────────────────────
    function drawDots() {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, canvas!.width / dpr, canvas!.height / dpr);
      ctx!.fillStyle = dotColor;
      ctx!.beginPath();
      for (let i = 0; i < dotCount; i++) {
        ctx!.moveTo(curX[i] + dotRadius, curY[i]);
        ctx!.arc(curX[i], curY[i], dotRadius, 0, TWO_PI);
      }
      ctx!.fill();
    }

    // ── Static redraw (no physics, just home positions) ──
    function drawStatic() {
      computeHomePositions();
      curX.set(homeX);
      curY.set(homeY);
      drawDots();
    }

    // ── Animation loop ───────────────────────────
    function tick() {
      computeHomePositions();

      let anyDisplaced = false;

      for (let i = 0; i < dotCount; i++) {
        let targetX = homeX[i];
        let targetY = homeY[i];

        // Check distance to mouse
        const dx = homeX[i] - mouseX;
        const dy = homeY[i] - mouseY;
        const dist2 = dx * dx + dy * dy;

        if (dist2 < influenceRadius2 && dist2 > 0.01) {
          const dist = Math.sqrt(dist2);
          const factor = (1 - dist / influenceRadius);
          const push = factor * factor * repulsionStrength;
          targetX = homeX[i] + (dx / dist) * push;
          targetY = homeY[i] + (dy / dist) * push;
        }

        // Spring physics
        vx[i] += (targetX - curX[i]) * springStiffness;
        vy[i] += (targetY - curY[i]) * springStiffness;
        vx[i] *= (1 - damping);
        vy[i] *= (1 - damping);
        curX[i] += vx[i];
        curY[i] += vy[i];

        // Check if this dot is displaced from home
        const dispX = curX[i] - homeX[i];
        const dispY = curY[i] - homeY[i];
        if (dispX * dispX + dispY * dispY > 0.01) {
          anyDisplaced = true;
        }
      }

      drawDots();

      if (!anyDisplaced) {
        idleFrames++;
        if (idleFrames > 60) {
          animating = false;
          return;
        }
      } else {
        idleFrames = 0;
      }

      rafId = requestAnimationFrame(tick);
    }

    function startAnimation() {
      if (animating) return;
      animating = true;
      idleFrames = 0;
      rafId = requestAnimationFrame(tick);
    }

    // ── Event handlers ───────────────────────────
    function onMouseMove(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      startAnimation();
    }

    function onScroll() {
      if (!animating) {
        drawStatic();
      }
    }

    function onResize() {
      allocateGrid();
      if (animating) {
        // Let the animation loop handle the next draw
      } else {
        drawDots();
      }
    }

    // ── Initialize ───────────────────────────────
    allocateGrid();
    drawDots();

    if (!isTouchOnly) {
      window.addEventListener('mousemove', onMouseMove, { passive: true });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    // ── Cleanup ──────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      if (!isTouchOnly) {
        window.removeEventListener('mousemove', onMouseMove);
      }
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
}
