// Copyright (c) Argento Computing Inc. Licensed under the MIT License. See LICENSE.

/**
 * @mikeargento/exam-verify: offline verification and grading of a sealed
 * exam folder, in three words: ACCEPT, REJECT, NO-EVIDENCE.
 */
export { verifyExam, floorStep, ceilingStep, commitmentOf, type CeilingReport, type ExamVerdict, type Verdict, type Line, type LineState, type Disagreed, type FloorReport, type PositionReport, type QuestionReport } from "./verify.js";
export { renderText, floorPhrase, bitgraphLines } from "./text.js";
export { renderReport } from "./report.js";
