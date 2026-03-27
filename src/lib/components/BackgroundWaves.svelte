<script lang="ts">
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let raf = 0;
  let w = 0;
  let h = 0;
  let dpr = 1;

  const TAU = Math.PI * 2;
  const PHI = (1 + Math.sqrt(5)) / 2;

  // Pre-rendered static layers
  let flowerBuf: HTMLCanvasElement | null = null;
  let metatronBuf: HTMLCanvasElement | null = null;
  let bufSize = 0;

  function createBuf(
    size: number,
  ): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const x = c.getContext("2d")!;
    return [c, x];
  }

  // ── Flower of Life: hex-grid circles ──
  function prerenderFlower(size: number) {
    const [buf, bx] = createBuf(size);
    const cx = size / 2;
    const cy = size / 2;
    const r = Math.min(w, h) * 0.11 * dpr;
    const sqrt3 = Math.sqrt(3);
    const rings = 4;

    bx.strokeStyle = "rgba(168, 85, 247, 0.2)";
    bx.lineWidth = 1;

    for (let q = -rings; q <= rings; q++) {
      for (let s = -rings; s <= rings; s++) {
        if (Math.abs(q) + Math.abs(s) + Math.abs(q + s) > rings * 2) continue;
        const x = cx + r * (q + s * 0.5);
        const y = cy + r * ((s * sqrt3) / 2);
        bx.beginPath();
        bx.arc(x, y, r, 0, TAU);
        bx.stroke();
      }
    }
    flowerBuf = buf;
  }

  // ── Metatron's Cube: 13 nodes + all connecting lines ──
  function prerenderMetatron(size: number) {
    const [buf, bx] = createBuf(size);
    const cx = size / 2;
    const cy = size / 2;
    const r = Math.min(w, h) * 0.18 * dpr;

    const nodes: { x: number; y: number }[] = [{ x: cx, y: cy }];
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6 - Math.PI / 2;
      nodes.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6 + Math.PI / 6 - Math.PI / 2;
      nodes.push({ x: cx + r * 2 * Math.cos(a), y: cy + r * 2 * Math.sin(a) });
    }

    // Connecting lines
    bx.strokeStyle = "rgba(56, 189, 248, 0.12)";
    bx.lineWidth = 0.8;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        bx.beginPath();
        bx.moveTo(nodes[i].x, nodes[i].y);
        bx.lineTo(nodes[j].x, nodes[j].y);
        bx.stroke();
      }
    }

    // Fruit of Life circles (at each node)
    bx.strokeStyle = "rgba(56, 189, 248, 0.14)";
    bx.lineWidth = 0.7;
    for (const n of nodes) {
      bx.beginPath();
      bx.arc(n.x, n.y, r * 0.48, 0, TAU);
      bx.stroke();
    }

    // Node dots
    bx.fillStyle = "rgba(56, 189, 248, 0.35)";
    for (const n of nodes) {
      bx.beginPath();
      bx.arc(n.x, n.y, 2 * dpr, 0, TAU);
      bx.fill();
    }

    metatronBuf = buf;
  }

  function prerender() {
    bufSize = Math.round(Math.max(w, h) * dpr * 1.6);
    prerenderFlower(bufSize);
    prerenderMetatron(bufSize);
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    prerender();
  }

  const FPS = 5;
  const FRAME_MS = 1000 / FPS;
  let lastFrame = 0;

  function draw(ts: number) {
    raf = requestAnimationFrame(draw);
    if (!ctx) return;
    if (ts - lastFrame < FRAME_MS) return;
    lastFrame = ts;
    const t = ts * 0.001;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    // ── Layer 1: Flower of Life ──
    if (flowerBuf) {
      const rot = t * 0.015;
      const breath = 0.7 + 0.3 * Math.sin(t * 0.25);
      ctx.save();
      ctx.globalAlpha = breath;
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.drawImage(
        flowerBuf,
        -bufSize / dpr / 2,
        -bufSize / dpr / 2,
        bufSize / dpr,
        bufSize / dpr,
      );
      ctx.restore();
    }

    // ── Layer 2: Metatron's Cube ──
    if (metatronBuf) {
      const rot = -t * 0.01;
      const breath = 0.65 + 0.35 * Math.sin(t * 0.18 + 2);
      ctx.save();
      ctx.globalAlpha = breath;
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.drawImage(
        metatronBuf,
        -bufSize / dpr / 2,
        -bufSize / dpr / 2,
        bufSize / dpr,
        bufSize / dpr,
      );
      ctx.restore();
    }

    // ── Layer 3: Golden Spiral ──
    {
      const spiralRot = t * 0.04;
      const maxR = Math.min(w, h) * 0.42;
      const b = Math.log(PHI) / (Math.PI / 2);
      const a = 1.2;
      const breath = 0.6 + 0.4 * Math.sin(t * 0.15 + 4);

      ctx.save();
      ctx.globalAlpha = breath;
      ctx.translate(cx, cy);

      // Main spiral
      ctx.beginPath();
      let first = true;
      for (let theta = 0; theta < TAU * 5; theta += 0.03) {
        const r = a * Math.exp(b * theta);
        if (r > maxR) break;
        const x = r * Math.cos(theta + spiralRot);
        const y = r * Math.sin(theta + spiralRot);
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(251, 191, 36, 0.2)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Mirror spiral
      ctx.beginPath();
      first = true;
      for (let theta = 0; theta < TAU * 5; theta += 0.03) {
        const r = a * Math.exp(b * theta);
        if (r > maxR) break;
        const x = -r * Math.cos(theta + spiralRot);
        const y = -r * Math.sin(theta + spiralRot);
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(251, 191, 36, 0.12)";
      ctx.stroke();

      ctx.restore();
    }

    // ── Layer 4: Pulsing sacred nodes ──
    {
      const nodeR = Math.min(w, h) * 0.18;
      ctx.save();
      ctx.translate(cx, cy);
      const nodeRot = t * 0.008;

      for (let ring = 0; ring < 3; ring++) {
        const count = ring === 0 ? 1 : ring === 1 ? 6 : 12;
        const dist = ring * nodeR;
        const offset = ring === 2 ? Math.PI / 12 : 0;

        for (let i = 0; i < count; i++) {
          const a = (i * TAU) / count + offset + nodeRot;
          const x = ring === 0 ? 0 : dist * Math.cos(a);
          const y = ring === 0 ? 0 : dist * Math.sin(a);
          const pulse = 0.3 + 0.7 * Math.sin(t * 1.5 + ring * 1.2 + i * 0.5);
          const sz = 1.5 + pulse * 1.5;

          ctx.beginPath();
          ctx.arc(x, y, sz, 0, TAU);
          ctx.fillStyle = `rgba(34, 211, 238, ${0.2 * pulse})`;
          ctx.fill();

          // Outer halo
          if (pulse > 0.6) {
            ctx.beginPath();
            ctx.arc(x, y, sz + 5, 0, TAU);
            ctx.strokeStyle = `rgba(34, 211, 238, ${(0.1 * (pulse - 0.6)) / 0.4})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
  }

  $effect(() => {
    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        raf = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(raf);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisible);
    };
  });
</script>

<canvas
  bind:this={canvas}
  class="fixed inset-0 w-full h-full pointer-events-none"
  style="z-index: 0;"
></canvas>
