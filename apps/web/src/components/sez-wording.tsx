"use client";
import { useEffect } from "react";
import { sez } from "@/lib/sections";

const SKIP = /^(TEXTAREA|SCRIPT|STYLE)$/;
const ATTRS = ["title", "aria-label", "placeholder", "alt"];
/** Shows "SEZ" for "Port City" on screen, as the artifact does. A select option keeps its saved value, so stored data never changes. */
function apply(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    const p = root.parentElement;
    if (!p || SKIP.test(p.nodeName) || p.isContentEditable) return;
    if (p.nodeName === "OPTION" && !p.hasAttribute("value")) p.setAttribute("value", p.textContent ?? "");
    const next = sez(root.nodeValue ?? "");
    if (next !== root.nodeValue) root.nodeValue = next;
    return;
  }
  if (!(root instanceof Element) || SKIP.test(root.nodeName)) return;
  root.querySelectorAll("option:not([value])").forEach((o) => { if (o.textContent?.includes("Port City")) o.setAttribute("value", o.textContent); });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue?.includes("Port City") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
  const found: Node[] = [];
  while (walker.nextNode()) found.push(walker.currentNode);
  found.forEach(apply);
  [root, ...root.querySelectorAll("[title],[aria-label],[placeholder],[alt]")].forEach((el) => ATTRS.forEach((a) => { const v = el.getAttribute(a); if (v?.includes("Port City")) el.setAttribute(a, sez(v)); }));
}
export function SezWording() {
  useEffect(() => {
    apply(document.body);
    const mo = new MutationObserver((ms) => ms.forEach((m) => { if (m.type === "characterData") apply(m.target); else m.addedNodes.forEach(apply); }));
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
