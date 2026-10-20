import type { Rubric } from "./types";

const NO_OBJECTIONS = {
  when: "objectionsRaised" as const,
  equals: false,
  reason: "No objections raised — points awarded automatically (Sales manual)",
  auto: true,
};

/** Sales Call Scorecard — Sales Call Manual (Feb 2025). 17 points. */
export const salesRubric: Rubric = {
  id: "sales",
  version: "sales-v1",
  name: "Sales Call Scorecard",
  maxScore: 17,
  thresholds: { gold: 17, green: 14 },
  items: [
    // 1st Quadrant: Validation
    {
      id: "validate",
      label: "Validate",
      quadrant: "validation",
      definition:
        "Validates the reason for calling with specific details and genuine empathy (not vague or generic).",
      examples: [
        "I am so sorry to hear about your ant activity in your kitchen. If that was my kitchen, I would absolutely be going crazy.",
        "Awesome! Thank you for calling in. I know summer is heating up, so it's a really smart time to start thinking about pest control.",
      ],
    },
    {
      id: "confidence",
      label: "Confidence Statement",
      quadrant: "validation",
      definition:
        "Clearly and enthusiastically establishes they are there to help and on the customer's team.",
      examples: [
        "I am glad you called in today about those ants, I can definitely take care of this for you.",
        "Thank you for calling in! I can absolutely help out with that.",
      ],
    },
    {
      id: "expectation_1",
      label: "Expectation Statement",
      quadrant: "validation",
      definition:
        "Prepares the customer for what comes next (e.g., a few questions before the quote).",
      examples: [
        "I'm just going to ask you a few questions about that ant activity, so I can make sure we get you the quote you are looking for.",
      ],
    },
    // 2nd Quadrant: Understand
    {
      id: "investigate",
      label: "Investigate",
      quadrant: "understand",
      definition:
        "Asks mostly open-ended questions (who/what/when/where/why/how) to understand the situation and gather at least 3 WINs (wants, interests, needs).",
      examples: ["When did you start seeing ants in the kitchen?", "How long ago was that?"],
    },
    {
      id: "summary",
      label: "Summary Statement",
      quadrant: "understand",
      definition: "Reiterates the customer's WINs back to them and gets agreement.",
      examples: [
        "From what we've discussed so far, it sounds like you are looking for an affordable and thorough solution for the ant and spider activity, that is also people and pet-friendly. Does that sound right?",
      ],
    },
    {
      id: "expectation_2",
      label: "Expectation Statement",
      quadrant: "understand",
      definition: "Prepares the customer for the service walkthrough, then price, then scheduling.",
      examples: [
        "I'm going to walk you through our service from start to finish... I'll check in with you at the end to see if you have any questions before we talk about the price.",
      ],
    },
    // 3rd Quadrant: Solve
    {
      id: "present_solution",
      label: "Present Solution",
      quadrant: "solve",
      definition:
        "Paints a picture of the service in chronological order — what the technician does, how, and why it matters for this customer's WINs.",
      examples: [
        "Your technician will power treat the entire foundation of your home. This is a protective layer that will flush out the cracks and crevices, and protect your home from any pests trying to come inside.",
      ],
    },
    {
      id: "consensus",
      label: "Consensus",
      quadrant: "solve",
      definition: "Checks the customer is on the same page before moving to price.",
      examples: [
        "That's our service in a nutshell. I know I just threw a lot at you. Do you have any questions about anything I just covered, before we talk about the price?",
      ],
    },
    {
      id: "close",
      label: "Close",
      quadrant: "solve",
      definition:
        "Moves forward with a close after the price — typically a logistical option close (e.g., morning or afternoon?).",
      examples: [
        "I'm assuming you'd like to get this started as soon as possible. Which time of day usually works better for you for appointments: morning or afternoon?",
      ],
    },
    {
      id: "pricing",
      label: "Pricing",
      quadrant: "solve",
      definition:
        "Presents price correctly: anchor price first, then the sales price (discount/special), only using bottom-line price if needed.",
      examples: [
        "That initial inside and outside service is usually $299 for a home your size. But, we're doing a special this week... so it's just going to be $199 for the initial treatment, and then just $49 per month after that.",
      ],
    },
    // Objections (auto-awarded when none raised)
    {
      id: "agree",
      label: "Agree",
      quadrant: "solve",
      definition:
        "Agrees with the objection and shows they understand the customer's point of view — no debate.",
      examples: [
        "Yes, I totally understand. There are lots of great companies out there, and I think it's smart to consider your options first.",
      ],
      allowNa: [NO_OBJECTIONS],
    },
    {
      id: "restate_insinuate",
      label: "Restate & Insinuate",
      quadrant: "solve",
      definition:
        "Restates the objection in their own words and insinuates a possible reason, isolating the real concern.",
      examples: [
        "It sounds like you just want to run everything past your wife to make sure she's aware of our service and who will be coming out, is that right?",
      ],
      allowNa: [NO_OBJECTIONS],
    },
    {
      id: "resolve",
      label: "Resolve",
      quadrant: "solve",
      definition: "Addresses the concern, provides a solution, and builds more value.",
      examples: [
        "The biggest reason people use us is because we do a FULL property treatment every time...",
      ],
      allowNa: [NO_OBJECTIONS],
    },
    {
      id: "re_close",
      label: "Re-Close",
      quadrant: "solve",
      definition: "Confidently closes again after resolving the objection, low pressure.",
      examples: [
        "Would you prefer to be home for the service, or does any time of day work for you?",
        "What's the best email address for me to get everything sent over to?",
      ],
      allowNa: [NO_OBJECTIONS],
    },
    // 4th Quadrant: Verify
    {
      id: "conclusion",
      label: "Provide a Conclusion",
      quadrant: "verify",
      definition:
        "Wraps up loose ends and sets expectations: name, address, email, date/time, notes, pets, gate codes, etc.",
      examples: ["Alright great, I've got everything set up for your service."],
    },
    {
      id: "final_info",
      label: "Offer Final Information",
      quadrant: "verify",
      definition:
        "Mentions the company is a one-stop shop for all pest needs AND mentions the referral program.",
      examples: [
        "We are a one-stop shop for all pest control needs... Also, we have an amazing referral program. If someone you refer signs up, you will get your next month FREE.",
      ],
    },
    {
      id: "thank",
      label: "Thank the Customer",
      quadrant: "verify",
      definition: "Genuinely thanks the customer at the end of the call.",
      examples: [
        "I just want to thank you for calling in and working with me today. As a local family-owned company, business from customers like you makes all the difference.",
      ],
    },
  ],
};
