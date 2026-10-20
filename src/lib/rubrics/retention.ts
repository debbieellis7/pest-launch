import type { NaRule, Rubric } from "./types";

const BYPASS: NaRule = {
  when: "bypassRetention",
  reason: "Moving out of area / customer passed away — manual allows bypassing save steps",
  auto: true,
};

/** Approved save offers ("Solution Bank") from the Retention Call Process. */
export const SAVE_OFFERS = [
  { id: "free_reservice", label: "Free re-service" },
  { id: "back_to_back", label: "Back-to-back services" },
  { id: "custom_plan", label: "Custom service plan" },
  { id: "waive_payment", label: "Waive next month's payment (max 3 months)" },
  { id: "set_schedule", label: "Set day/time/technician for future services" },
  { id: "account_hold", label: "Brief account hold (2–3 months max)" },
  { id: "service_manager", label: "Send Service Manager out" },
  { id: "branch_manager", label: "Send Branch Manager to talk" },
  { id: "price_drop_10", label: "Drop recurring price 10% (price-only, once)" },
] as const;

export type SaveOfferId = (typeof SAVE_OFFERS)[number]["id"];

/** Call Process Scorecard — Retention Calls (Office Call Manual). 12 points. */
export const retentionRubric: Rubric = {
  id: "retention",
  version: "retention-v1",
  name: "Call Process Scorecard — Retention Calls",
  maxScore: 12,
  thresholds: { gold: 12, green: 11 },
  items: [
    // 1st Quadrant: Validation
    {
      id: "validate_confidence",
      label: "Validate & Confidence Statement",
      quadrant: "validation",
      definition:
        "Validates the customer and gives assurance they'll be taken care of — WITHOUT confirming the account will be cancelled.",
      examples: [
        "Got it. Thank you for calling in, I can absolutely take a look at things for you.",
        "Hey, no problem. My name is ___. I want you to know I'll get you taken care of today.",
      ],
    },
    {
      id: "transition",
      label: "Transition Statement",
      quadrant: "validation",
      definition: "Transitions into looking up the account / gathering quick info.",
      examples: [
        "What's the address for the account? Awesome. Let me just take a quick look here.",
        "I'm just going to get some quick information from you...",
      ],
    },
    {
      id: "research",
      label: "Do Your Research",
      quadrant: "validation",
      definition:
        "Uses account details (tenure, contract, past re-services, last service) — evident when the rep references them.",
      examples: ["I see here you've been a customer for over 3 years, thank you!"],
    },
    // 2nd Quadrant: Understand
    {
      id: "investigate",
      label: "Investigate",
      quadrant: "understand",
      definition:
        "Asks just enough open-ended (or assumptive) questions to find the root reason for cancelling, without interrogating.",
      examples: [
        "If you don't mind, what's the reason you're unhappy with the service?",
        "I see we came and serviced your home last week, did something happen then that didn't go well?",
      ],
    },
    {
      id: "validate_summary",
      label: "Validate & Summary Statement",
      quadrant: "understand",
      definition: "Keeps validating and repeats back the root concern to confirm the full scope.",
      examples: [
        "Got it, that makes sense. So overall the service has been pretty good, but just the last couple months you've been noticing more ants than normal?",
      ],
    },
    {
      id: "validate_expectation",
      label: "Validate & Expectation Statement",
      quadrant: "understand",
      definition:
        "Stays on the customer's team and primes them for options before presenting solutions.",
      examples: [
        "Since we are a small family-owned company, we truly value you as a customer and I want to make this right for you. Let me give a couple of suggestions...",
      ],
    },
    // 3rd Quadrant: Solve
    {
      id: "present_solution",
      label: "Present Solution",
      quadrant: "solve",
      definition:
        "Offers a specific, tailored save solution from the Solution Bank that matches the root cause, building value.",
      examples: [
        "What I can do is, I'll send out my head technician to come do a free re-service for you...",
      ],
      allowNa: [BYPASS],
    },
    {
      id: "consensus",
      label: "Consensus",
      quadrant: "solve",
      definition: "Gets buy-in on the solution.",
      examples: ["Does that work for you?", "How does that sound?"],
      allowNa: [BYPASS],
    },
    {
      id: "repeat",
      label: "Repeat (when necessary)",
      quadrant: "solve",
      definition:
        "If the first offer is declined, asks more questions and offers a new solution (and brings up contract/fee only after solutions fail).",
      examples: [
        "Ask a few more open-ended questions... Offer a new/more solutions to the customer.",
      ],
      allowNa: [
        {
          when: "firstOfferAccepted",
          reason: "First offer accepted — no repeat needed",
          auto: true,
        },
        BYPASS,
      ],
    },
    // 4th Quadrant: Verify
    {
      id: "conclusion",
      label: "Provide a Conclusion",
      quadrant: "verify",
      definition: "Wraps up loose ends, sets expectations, and confirms what happens next.",
      examples: ["Name, address, date/time, special notes, technician's name..."],
    },
    {
      id: "thank",
      label: "Thank the Customer",
      quadrant: "verify",
      definition: "Genuinely thanks the customer.",
      examples: [
        "I just want to thank you for calling in and working with me today. As a local family-owned company, business from customers like you makes all the difference.",
      ],
    },
    {
      id: "teaser",
      label: "Leave a Teaser",
      quadrant: "verify",
      definition:
        "For cancellations: ends on a high note with an incentive to come back (e.g., a free initial service).",
      examples: [
        "If you ever want to try us again... I'm going to give you a FREE initial service. I'll put that in the notes in your account.",
      ],
      allowNa: [
        {
          when: "customerSaved",
          reason: "Customer was saved — teaser is for cancellations",
          auto: true,
        },
      ],
    },
  ],
};
