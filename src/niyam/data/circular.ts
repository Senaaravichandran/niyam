/**
 * SYNTHETIC regulatory circular used by the demo.
 * It is written in the house style of an RBI circular so the pipeline has believable input,
 * but it is fictional: no such circular exists and none of its thresholds are real RBI limits.
 */

export interface CircularSource {
  ref: string;
  title: string;
  issuedOn: string;
  issuer: string;
  amends: string;
  synthetic: boolean;
  text: string;
}

export const CIRCULAR_REF = "RBI-SYN-2026-017";

export const CIRCULAR: CircularSource = {
  ref: CIRCULAR_REF,
  title:
    "Large Exposures and Credit Concentration: Revised Limits and Monitoring (SYNTHETIC)",
  issuedOn: "2026-09-15",
  issuer: "Reserve Bank of India, Department of Regulation (SYNTHETIC SAMPLE)",
  amends: "MD-SYN-LEF-2025 (Master Direction on Large Exposures, synthetic)",
  synthetic: true,
  text: `RBI/2026-27/SYN-017
DOR.CRE.REC.SYN-17/13.05.000/2026-27                                September 15, 2026

All Primary (Urban) Co-operative Banks
All Non-Banking Financial Companies in the Middle and Upper Layer

Madam / Sir,

Large Exposures and Credit Concentration: Revised Limits and Monitoring

THIS IS A SYNTHETIC CIRCULAR PREPARED FOR A DEMONSTRATION. IT IS NOT ISSUED BY THE RESERVE BANK OF INDIA.

1. Short title and commencement. These directions shall be called the Large Exposures (Amendment) Directions, 2026 and shall come into force on December 1, 2026.

2. Applicability. These directions shall apply to all Primary (Urban) Co-operative Banks and to Non-Banking Financial Companies in the Middle Layer and the Upper Layer, unless a paragraph states otherwise.

3. Definitions. For the purpose of these directions, exposure shall mean the sum of funded and non-funded credit facilities, and Tier 1 capital shall be reckoned as on March 31 of the previous financial year.

4. Exposure limits.
(a) A regulated entity shall not take an exposure to a single counterparty exceeding 10 per cent of its Tier 1 capital.
(b) A regulated entity shall flag for report any group of connected counterparties with an aggregate exposure exceeding 12 per cent of Tier 1 capital.
(c) The aggregate exposure of a regulated entity to its twenty largest borrowers shall not exceed 40 per cent of its total loans and advances.

5. Board oversight. Any exposure flagged under paragraph 4 shall be placed before the Board of Directors within 30 days, and no internal policy shall permit a group exposure above the limit in paragraph 4(b), including with the approval of the Board.

6. Upper Layer NBFCs. A Non-Banking Financial Company in the Upper Layer shall not take an exposure to a single counterparty exceeding 20 per cent of its Tier 1 capital.

7. Repeal and saving. Paragraphs 5.2 and 5.3 of MD-SYN-LEF-2025 stand withdrawn from the date these directions come into force.

Yours faithfully,

(Synthetic Signatory)
Chief General Manager (SYNTHETIC)`,
};
