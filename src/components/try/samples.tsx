import { CIRCULAR } from "@/niyam/data/circular";
import type { EntityType } from "@/niyam/data/bankProfile";

export interface Sample {
  id: string;
  label: string;
  note: string;
  entity: EntityType;
  text: string;
}

const UCB_EXCERPT = `RBI/2019-20/171
DOR (PCB).BPD.Cir.No.10/13.05.000/2019-20                                March 13, 2020

All Primary (Urban) Co-operative Banks

Madam / Sir,

Exposure norms for Primary (Urban) Co-operative Banks

PARAPHRASED EXCERPT FOR DEMONSTRATION. READ THE ORIGINAL CIRCULAR ON THE RBI WEBSITE FOR THE AUTHORITATIVE TEXT.

1. Applicability. These instructions shall apply to all Primary (Urban) Co-operative Banks.

2. Exposure ceilings.
(a) A bank shall not take an exposure to a single borrower exceeding 15 per cent of its Tier I capital.
(b) A bank shall not take an exposure to a group of connected borrowers exceeding 25 per cent of its Tier I capital.

3. Reckoning of capital. Tier I capital shall be reckoned as on March 31 of the previous financial year.

4. Glide path. A bank whose exposures are above these ceilings shall bring them within the revised limits by March 31, 2023.

Yours faithfully,

(Chief General Manager)`;

const NBFC_EXAMPLE = `ILLUSTRATIVE NBFC DIRECTION (SYNTHETIC, WRITTEN FOR THIS DEMONSTRATION)

All Non-Banking Financial Companies in the Middle Layer and the Upper Layer

1. Applicability. These directions shall apply to Non-Banking Financial Companies in the Middle Layer and the Upper Layer.

2. Capital adequacy. An NBFC shall maintain a capital ratio of not less than 15 per cent of its aggregate risk weighted assets.

3. Concentration.
(a) An NBFC shall not take an exposure to a single counterparty exceeding 20 per cent of its Tier 1 capital.
(b) The aggregate exposure of an NBFC to its twenty largest borrowers shall not exceed 35 per cent of its total loans and advances.

4. Reporting. Any exposure flagged under paragraph 3 shall be placed before the Board of Directors within 30 days.`;

export const SAMPLES: Sample[] = [
  {
    id: "synthetic",
    label: "NIYAM's synthetic circular",
    note: `${CIRCULAR.ref}, the fictional circular the console runs on. Its 10% and 12% limits are not RBI limits.`,
    entity: "UCB",
    text: CIRCULAR.text,
  },
  {
    id: "ucb",
    label: "RBI/2019-20/171, paraphrased",
    note: "A paraphrased excerpt of RBI's March 2020 exposure norms for UCBs: single borrower 15% and group of connected borrowers 25% of Tier I capital. Not the official wording.",
    entity: "UCB",
    text: UCB_EXCERPT,
  },
  {
    id: "nbfc",
    label: "NBFC example with a floor",
    note: "Illustrative and synthetic. Paragraph 2 sets a floor (\"not less than\"), which fires on <; paragraph 3 sets two ceilings.",
    entity: "NBFC-ML",
    text: NBFC_EXAMPLE,
  },
];
