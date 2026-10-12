import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { installMotion } from "../public/motion.js";
function setup({ reduce = false, fine = true } = {}) {
  const window = new Window();
  const queries = new Map();
  window.matchMedia = (query) => {
    const result = new window.EventTarget();
    result.matches = query.includes("reduced") ? reduce : fine;
    queries.set(query, result);
    return result;
  };
  let pending = null,
    frames = 0;
  window.requestAnimationFrame = (fn) => {
    pending = fn;
    frames++;
    return frames;
  };
  window.cancelAnimationFrame = () => {
    pending = null;
  };
  window.document.body.innerHTML =
    '<div data-tilt><span>Cover</span></div><button data-section="guide-section-0">Install</button><h2 id="guide-section-0" tabindex="-1">Install</h2>';
  const cover = window.document.querySelector("[data-tilt]");
  cover.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 400,
    height: 200,
  });
  installMotion(window.document, window);
  return {
    window,
    queries,
    cover,
    get frames() {
      return frames;
    },
    flush() {
      const fn = pending;
      pending = null;
      fn?.();
    },
    move(x, y, type = "mouse") {
      cover.dispatchEvent(
        new window.PointerEvent("pointermove", {
          bubbles: true,
          clientX: x,
          clientY: y,
          pointerType: type,
        }),
      );
    },
  };
}
test("cover motion batches pointer events into one frame and resets when leaving", () => {
  const s = setup();
  s.move(200, 50);
  s.move(400, 200);
  assert.equal(s.frames, 1);
  s.flush();
  assert.equal(s.cover.style.getPropertyValue("--tilt-y"), "6.00deg");
  assert.equal(s.cover.style.getPropertyValue("--tilt-x"), "-5.00deg");
  s.cover.dispatchEvent(
    new s.window.PointerEvent("pointerout", {
      bubbles: true,
      relatedTarget: s.window.document.body,
    }),
  );
  assert.equal(s.cover.style.getPropertyValue("--tilt-y"), "");
});
test("touch and reduced-motion preferences skip tilt; changing preference clears active motion", () => {
  for (const options of [{ reduce: true }, { fine: false }]) {
    const s = setup(options);
    s.move(400, 0);
    assert.equal(s.frames, 0);
  }
  const s = setup();
  s.move(400, 0, "touch");
  assert.equal(s.frames, 0);
  s.move(400, 0);
  s.flush();
  const preference = s.queries.get("(prefers-reduced-motion: reduce)");
  preference.matches = true;
  preference.dispatchEvent(new s.window.Event("change"));
  assert.equal(s.cover.style.getPropertyValue("--tilt-y"), "");
  s.move(400, 0);
  assert.equal(s.frames, 1);
});
test("document navigation focuses the real heading and respects reduced motion", () => {
  const s = setup({ reduce: true });
  const heading = s.window.document.querySelector("h2");
  let scroll;
  heading.scrollIntoView = (options) => {
    scroll = options;
  };
  const button = s.window.document.querySelector("button");
  button.click();
  assert.equal(s.window.document.activeElement, heading);
  assert.equal(button.getAttribute("aria-current"), "true");
  assert.deepEqual(scroll, { behavior: "instant", block: "start" });
});
