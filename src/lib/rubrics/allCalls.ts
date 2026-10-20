import type { NaRule, Rubric } from "./types";

const LESS_APPLICABLE: NaRule = {
  when: "simpleTransactional",
  reason: 'Simple scheduling/billing call — "Understand" is less applicable (Office manual)',
};

/** Call Process Scorecard — All Calls (Office Call Manual, Sep/Oct 2026). 12 points. */
export const allCallsRubric: Rubric = {
  id: "all_calls",
  version: "all-calls-v1",
  name: "Call Process Scorecard — All Calls",
  maxScore: 12,
  thresholds: { gold: 12, green: 11 },
  items: [
    // 1st Quadrant: Validation
    {
      id: "validate",
      label: "Validate",
      quadrant: "validation",
      definition:
        "Validates the reason for calling with specific details and genuine empathy; sides with the customer.",
      examples: [
        "I am very sorry your technician was late for the appointment. I would be super frustrated too if I planned around that.",
        "Absolutely, thank you for calling in, I can definitely help get that scheduled for you.",
      ],
    },
    {
      id: "confidence",
      label: "Confidence Statement",
      quadrant: "validation",
      definition:
        "Builds the customer's confidence that the rep will handle it; establishes they're on the customer's team.",
      examples: [
        "Thank you for letting me know about this, I will definitely get this resolved for you.",
        "Thank you for calling and letting us know about this charge, I can definitely take care of this for you.",
      ],
    },
    {
      id: "expectation_1",
      label: "Expectation Statement",
      quadrant: "validation",
      definition: "Prepares the customer for what comes next.",
      examples: [
        "I'm just going to ask you a few questions about your service, so I can make sure this gets handled properly.",
        "Let me just double check our upcoming routes we already have scheduled...",
      ],
    },
    // 2nd Quadrant: Understand
    {
      id: "investigate",
      label: "Investigate",
      quadrant: "understand",
      definition: "Asks open-ended questions to fully understand the situation and its root cause.",
      examples: [
        "When did you start seeing ants in the kitchen?",
        "Where is the most prevalent area you're noticing those cobwebs?",
      ],
      allowNa: [LESS_APPLICABLE],
    },
    {
      id: "summary",
      label: "Summary Statement",
      quadrant: "understand",
      definition: "Repeats back what they heard (the customer's WINs) to confirm understanding.",
      examples: [
        "Got it. So it sounds like they're more recent, you've only started noticing them in the last couple weeks?",
      ],
      allowNa: [LESS_APPLICABLE],
    },
    {
      id: "expectation_2",
      label: "Expectation Statement",
      quadrant: "understand",
      definition: "Prepares the customer for the solution.",
      examples: [
        "Ok, perfect. I'm going to make notes about this and I'll give you a quick rundown of how we'll tackle those ants for you.",
      ],
      allowNa: [LESS_APPLICABLE],
    },
    // 3rd Quadrant: Solve
    {
      id: "present_solution",
      label: "Present Solution",
      quadrant: "solve",
      definition: "Paints a picture of the solution, tailored to the customer: what, how, and why.",
      examples: [
        "Your technician will come out and use 2 products, one is a bait and one is a treatment...",
        "Awesome. I got that rescheduled for you. Your technician will be there next Thursday, between 2-4pm.",
      ],
    },
    {
      id: "consensus",
      label: "Consensus",
      quadrant: "solve",
      definition: "Checks the customer agrees with / understands the solution.",
      examples: [
        "So we'll get that taken care of really well for you. Do you have any questions about any part of that?",
        "Is there anything else I can help with?",
      ],
    },
    {
      id: "close",
      label: "Close",
      quadrant: "solve",
      definition:
        "Closes the solution. If the solution has no cost (e.g., a re-service), the consensus also counts as the close.",
      examples: ["How does that all sound?"],
      mirrors: {
        itemId: "consensus",
        when: "solutionNoCost",
        reason: "No-cost solution — consensus counts as the close (Office manual)",
      },
    },
    // 4th Quadrant: Verify
    {
      id: "conclusion",
      label: "Provide a Conclusion",
      quadrant: "verify",
      definition:
        "Wraps up loose ends and sets expectations going forward (date/time, notes, what happens next).",
      examples: [
        "Perfect. You'll get a reminder text a couple days before we come out for you.",
        "Perfect, I got that in. Your technician will be there (day/time).",
      ],
    },
    {
      id: "thank",
      label: "Thank the Customer",
      quadrant: "verify",
      definition: "Genuinely thanks the customer.",
      examples: [
        "Thank you again for being a customer of ours. As a local family-owned company, your business means the world to us.",
      ],
    },
    {
      id: "final_info",
      label: "Offer Final Information",
      quadrant: "verify",
      definition:
        "Lets the customer know to call first for any need (one-stop shop), or gives final helpful info before ending.",
      examples: [
        "Don't hesitate to reach back out if you need anything. It's common for it to take a couple treatments before those ants really start going away.",
      ],
    },
  ],
};
