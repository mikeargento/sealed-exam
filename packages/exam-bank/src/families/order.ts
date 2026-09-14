// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * Family 5: ordering from generated facts. Five to seven labelled items, each
 * with a random date or quantity, stated in shuffled order; the answer is the
 * labels sorted the way the prompt asks.
 */
import { ANSWER_LINE, sameList, type Family, type Question } from "../family.js";
import { between, int, shuffle, type Rng } from "../rng.js";

const LABELS = ["Alder", "Birch", "Cedar", "Dogwood", "Elm", "Fir", "Ginkgo", "Hazel", "Ivy", "Juniper"] as const;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

interface Item { label: string; key: number; fact: string }

function drawItems(rng: Rng, n: number, mode: "dates" | "weights"): Item[] {
  const labels = shuffle(rng, LABELS).slice(0, n);
  const used = new Set<number>();
  const items: Item[] = [];
  for (const label of labels) {
    for (;;) {
      if (mode === "dates") {
        const y = between(rng, 1900, 2025);
        const m = between(rng, 1, 12);
        const d = between(rng, 1, 28);
        const key = y * 10_000 + m * 100 + d;
        if (used.has(key)) continue;
        used.add(key);
        items.push({ label, key, fact: `The ${label} file was registered on ${d} ${MONTHS[m - 1]} ${y}.` });
      } else {
        const kg = between(rng, 1_000, 99_999);
        if (used.has(kg)) continue;
        used.add(kg);
        items.push({ label, key: kg, fact: `The ${label} crate weighs ${kg.toLocaleString("en-US")} kg.` });
      }
      break;
    }
  }
  return items;
}

export const order: Family = {
  id: "order",
  title: "Ordering from facts",
  params: { items: [5, 7], modes: ["dates", "weights"], years: [1900, 2025], kilograms: [1000, 99999], directions: 2 },
  answerFormat: "Give the labels only, in the requested order, separated by commas.",
  generate(rng: Rng): Question {
    const n = between(rng, 5, 7);
    const mode = int(rng, 2) === 0 ? "dates" : "weights";
    const items = drawItems(rng, n, mode);
    const ascending = int(rng, 2) === 0;
    const ask = mode === "dates"
      ? (ascending ? "from the earliest registration to the latest" : "from the latest registration to the earliest")
      : (ascending ? "from the lightest crate to the heaviest" : "from the heaviest crate to the lightest");
    const sorted = items.slice().sort((a, b) => (ascending ? a.key - b.key : b.key - a.key));
    const facts = shuffle(rng, items).map((it) => it.fact).join("\n");
    return {
      prompt: `Facts:\n\n${facts}\n\nList the ${n} labels ${ask}.\n\n${this.answerFormat}\n${ANSWER_LINE}`,
      canonical: sorted.map((it) => it.label).join(", "),
    };
  },
  async check(answer: string, canonical: string): Promise<boolean> {
    return sameList(answer, canonical);
  },
  display: (canonical) => canonical,
};
