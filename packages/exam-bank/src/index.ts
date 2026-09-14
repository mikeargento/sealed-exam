// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * @mikeargento/exam-bank: the sealed exam's public item bank.
 *
 * The form is public and versioned; the difficulty is in the instance, which
 * is drawn from a slot commitment nobody could have before the slot existed.
 */
export type { Rng } from "./rng.js";
export { int, between, pick, shuffle, bigDigits } from "./rng.js";
export type { Family, Question } from "./family.js";
export { ANSWER_LINE, unwrap, sameList } from "./family.js";
export { FAMILIES, familyById } from "./families.js";
export { extractAnswer } from "./extract.js";
export { extractCode } from "./families/spec.js";
export { runSandboxed } from "./sandbox.js";
export {
  BANK_VERSION, K, PER_FAMILY,
  type Bank, type BankFamily,
  buildBank, computeBankDigest, generatorSourceTar, loadBank, isBank, packageRoot, writeTar, readTar, toB64,
} from "./bank.js";
