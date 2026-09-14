#!/usr/bin/env node
// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/** Writes bank.json from the code. Run after any change under src/; a test checks the two agree. */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildBank, generatorSourceTar, packageRoot } from "./bank.js";

const root = packageRoot();
const bank = buildBank(await generatorSourceTar(root));
await writeFile(join(root, "bank.json"), `${JSON.stringify(bank, null, 2)}\n`);
process.stdout.write(`bank.json written: ${bank.version}, ${bank.families.length} families, bank digest ${bank.bankDigestB64}\n`);
