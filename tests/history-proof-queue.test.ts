import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HistoryProofQueue, type HistoryProofItem } from "../app/components/HistoryProofQueue";

const investigations: HistoryProofItem[] = [
  {
    id: "receipt-alpha",
    question: "Who owns the release blocker?",
    createdAt: "2031-04-08T10:00:00.000Z",
    status: "grounded",
    providers: ["Slack", "Linear", "Slack"],
  },
  {
    id: "receipt-beta",
    question: "What changed after the customer escalation?",
    createdAt: "2031-04-08T11:00:00.000Z",
    status: "partial",
    providers: ["Slack", "GitHub"],
  },
  {
    id: "receipt-gamma",
    question: "Is there proof of a confirmed deadline?",
    createdAt: "2031-04-08T12:00:00.000Z",
    status: "abstained",
    providers: [],
  },
];

describe("HistoryProofQueue", () => {
  it("derives source usage and receipt paths only from saved investigations", () => {
    const html = renderToStaticMarkup(createElement(HistoryProofQueue, { investigations }));

    expect(html).toContain("Your evidence, arranged as a queue.");
    expect(html).toContain("<dt>Receipts</dt><dd>3</dd>");
    expect(html).toContain("<dt>Sources</dt><dd>3</dd>");
    expect(html).toContain("<dt>Links</dt><dd>4</dd>");
    expect(html).toContain("Slack");
    expect(html).toContain("2 saved questions");
    expect(html).toContain("Linear");
    expect(html).toContain("GitHub");
    expect(html).toContain("No source coverage");
    expect(html).not.toMatch(/placeholder|sample|demo source/i);
  });

  it("links every visible queue item back to its exact receipt", () => {
    const html = renderToStaticMarkup(createElement(HistoryProofQueue, { investigations }));

    expect(html).toContain('href="/?run=receipt-alpha"');
    expect(html).toContain('href="/?run=receipt-beta"');
    expect(html).toContain('href="/?run=receipt-gamma"');
    expect(html).toContain("receipt-alpha");
    expect(html).toContain("grounded");
    expect(html).toContain("partial");
    expect(html).toContain("abstained");
  });

  it("renders an honest empty path without manufactured graph nodes", () => {
    const html = renderToStaticMarkup(createElement(HistoryProofQueue, { investigations: [] }));

    expect(html).toContain("Your first receipt will start the path.");
    expect(html).toContain("No source nodes are shown until QueueProof stores a real investigation.");
    expect(html).not.toContain("history-receipt-node");
    expect(html).not.toContain("history-source-mark");
  });

  it("reveals real receipt paths once and disables the sequence for reduced motion", () => {
    const css = readFileSync(new URL("../app/ember-assistant.css", import.meta.url), "utf8");
    expect(css).toContain("animation: history-meter-in");
    expect(css).toContain("animation: history-receipt-in");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.history-receipt-spine > li,[\s\S]*?\.history-source-meter i \{ animation: none !important/);
  });
});
