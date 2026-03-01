// script.js

// Theme toggle (persisted)
(function themeInit(){
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") {
    document.documentElement.setAttribute("data-theme", saved);
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();

document.getElementById("themeToggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Animated background (particles)
(function bgParticles(){
  const canvas = document.getElementById("bg-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });

  let w, h, dpr;
  const particles = [];
  const PARTICLE_COUNT = 70;

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(min, max){ return Math.random() * (max - min) + min; }

  function getColors(){
    const theme = document.documentElement.getAttribute("data-theme") || "dark";
    if (theme === "light") {
      return {
        dot: "rgba(31, 60, 255, 0.18)",
        line: "rgba(20, 24, 38, 0.08)"
      };
    }
    return {
      dot: "rgba(42, 60, 255, 0.20)",
      line: "rgba(231, 234, 240, 0.07)"
    };
  }

  function init(){
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++){
      particles.push({
        x: rand(0, w),
        y: rand(0, h),
        vx: rand(-0.35, 0.35),
        vy: rand(-0.25, 0.25),
        r: rand(1.2, 2.6)
      });
    }
  }

  function step(){
    const { dot, line } = getColors();

    ctx.clearRect(0, 0, w, h);

    // soft vignette
    const grad = ctx.createRadialGradient(w*0.35, h*0.15, 80, w*0.5, h*0.3, Math.max(w, h));
    const theme = document.documentElement.getAttribute("data-theme") || "dark";
    grad.addColorStop(0, theme === "light" ? "rgba(31,60,255,0.08)" : "rgba(42,60,255,0.12)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // move
    for (const p of particles){
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;
    }

    // lines
    for (let i = 0; i < particles.length; i++){
      for (let j = i + 1; j < particles.length; j++){
        const a = particles[i];
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 130){
          const alpha = (1 - dist / 130) * 0.9;
          ctx.strokeStyle = line.replace("0.08", (0.08 * alpha).toFixed(4))
                               .replace("0.07", (0.07 * alpha).toFixed(4));
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // dots
    for (const p of particles){
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(step);
  }

  resize();
  init();
  step();

  window.addEventListener("resize", () => {
    resize();
    init();
  });

  // Repaint colors on theme change
  const obs = new MutationObserver(() => {});
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
