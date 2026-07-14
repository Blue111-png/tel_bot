// Calls the Google Gemini API (free tier, no card required) to answer
// questions the keyword-based FAQ couldn't match — grounded in the same
// real FAQ content, so it answers from actual facts instead of guessing.
const { GEMINI_API_KEY } = require("./config");
const { FAQS } = require("./faq");

const MODEL = "gemini-3.5-flash"; // current free-tier model (2.5-flash was pulled early for new keys)

// EDIT THIS with your real business facts. The more specific and accurate
// this is, the less the AI has to guess. Anything not covered here or in
// the FAQ list should get "talk to a human" instead of an invented answer.
const BUSINESS_FACTS = `
- We are an online store selling electronics and home goods.
- We currently ship only within the United States and Canada. We do NOT ship internationally.
- Standard shipping: 3-5 business days. Express shipping: 1-2 business days.
- Returns accepted within 30 days of delivery, item must be unused in original packaging.
- Warranty: 1 year on all products, manufacturer defects only.
`.trim();

function buildSystemPrompt() {
  const faqText = FAQS.map(({ keywords, answer }) => `- ${answer}`).join("\n");

  return (
    "You are a friendly customer support assistant for an online store. " +
    "Answer briefly and helpfully in 2-4 sentences.\n\n" +
    "Only state facts that are explicitly listed below. Do not guess, assume, " +
    "or make up any policy, shipping region, price, or availability that isn't " +
    "stated here. If the answer isn't covered by these facts, say you're not " +
    "sure and tell the customer to tap \"Talk to a human\" below — never invent " +
    "a plausible-sounding answer.\n\n" +
    "BUSINESS FACTS:\n" + BUSINESS_FACTS + "\n\n" +
    "KNOWN FAQ ANSWERS:\n" + faqText
  );
}

// Pulled out as its own function so it can be tested without a real network call.
function extractText(apiResponseData) {
  const parts = apiResponseData?.candidates?.[0]?.content?.parts || [];
  const block = parts.find((p) => typeof p.text === "string");
  return block ? block.text : null;
}

async function askAI(question) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildSystemPrompt() }] },
      contents: [{ role: "user", parts: [{ text: question }] }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return extractText(data);
}

module.exports = { askAI, extractText, buildSystemPrompt };