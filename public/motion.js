// Delegated interactions survive SSR hydration and client navigation. No animation library.
export function installMotion(doc = document, win = window) {
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = win.matchMedia("(hover: hover) and (pointer: fine)");
  let active = null,
    frame = 0,
    point = null;
  const reset = () => {
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    if (active) {
      for (const name of ["--tilt-x", "--tilt-y", "--light-x", "--light-y"])
        active.style.removeProperty(name);
    }
    active = null;
    point = null;
  };
  doc.addEventListener(
    "pointermove",
    (event) => {
      if (reduced.matches || !fine.matches || event.pointerType === "touch")
        return;
      const cover = event.target.closest?.("[data-tilt]");
      if (!cover) {
        if (active) reset();
        return;
      }
      if (active !== cover) {
        reset();
        active = cover;
      }
      point = { x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = win.requestAnimationFrame(() => {
        frame = 0;
        if (!active?.isConnected || !point) return reset();
        const box = active.getBoundingClientRect();
        if (!box.width || !box.height) return;
        const x = Math.max(
          -0.5,
          Math.min(0.5, (point.x - box.left) / box.width - 0.5),
        );
        const y = Math.max(
          -0.5,
          Math.min(0.5, (point.y - box.top) / box.height - 0.5),
        );
        active.style.setProperty("--tilt-x", `${(-y * 10).toFixed(2)}deg`);
        active.style.setProperty("--tilt-y", `${(x * 12).toFixed(2)}deg`);
        active.style.setProperty("--light-x", `${(x + 0.5) * 100}%`);
        active.style.setProperty("--light-y", `${(y + 0.5) * 100}%`);
      });
    },
    { passive: true },
  );
  doc.addEventListener(
    "pointerout",
    (event) => {
      if (active && !active.contains(event.relatedTarget)) reset();
    },
    { passive: true },
  );
  doc.addEventListener("visibilitychange", () => {
    if (doc.hidden) reset();
  });
  win.addEventListener("pagehide", reset);
  reduced.addEventListener("change", reset);
  fine.addEventListener("change", reset);
  doc.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-section]");
    if (!button) return;
    const heading = doc.getElementById(button.dataset.section);
    if (!heading) return;
    doc
      .querySelectorAll("[data-section]")
      .forEach((item) => item.removeAttribute("aria-current"));
    button.setAttribute("aria-current", "true");
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({
      behavior: reduced.matches ? "instant" : "smooth",
      block: "start",
    });
  });
}
