import { JSDOM } from "jsdom";
import "fake-indexeddb/auto";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
  pretendToBeVisual: true,
});
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "HTMLTextAreaElement",
  "Node",
  "Event",
  "MouseEvent",
  "MutationObserver",
  "localStorage",
  "sessionStorage",
])
  Object.defineProperty(globalThis, key, {
    value: dom.window[key as keyof typeof dom.window],
    configurable: true,
  });
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  value: true,
  configurable: true,
  writable: true,
});
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
  dom.window,
);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(
  dom.window,
);
// jsdom has no layout. Give chart containers a fixed mobile-sized test viewport.
const boundingRect = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function () {
  if (this.classList.contains("recharts-responsive-container"))
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 350,
      bottom: 250,
      width: 350,
      height: 250,
      toJSON() {
        return {};
      },
    };
  return boundingRect.call(this);
};
