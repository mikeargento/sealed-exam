// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

import { arith } from "./families/arith.js";
import { logic } from "./families/logic.js";
import { order } from "./families/order.js";
import { spec } from "./families/spec.js";
import { strings } from "./families/strings.js";
import type { Family } from "./family.js";

/** The five families of exam-bank/1, in bank order. The order is part of the bank: the paper draws family indices into this list. */
export const FAMILIES: readonly Family[] = Object.freeze([arith, logic, strings, spec, order]);

export function familyById(id: string): Family | undefined {
  return FAMILIES.find((f) => f.id === id);
}
