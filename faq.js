// Simplest possible FAQ engine: keywords mapped to answers.
// First matching entry wins.
const FAQS = [
  {
    keywords: ["refund", "money back", "return"],
    answer: "Refunds are processed within 5-7 business days after we receive the " +
      "returned item. You can start a return from your Orders page.",
  },
  {
    keywords: ["shipping", "delivery time", "how long"],
    answer: "Standard shipping takes 3-5 business days. Express shipping (selected " +
      "at checkout) takes 1-2 business days.",
  },
  {
    keywords: ["cancel", "cancel order"],
    answer: "You can cancel an order within 1 hour of placing it from the Orders " +
      "page. After that, please contact us and we'll do our best to help.",
  },
  {
    keywords: ["payment", "card declined", "billing"],
    answer: "We accept all major credit cards, PayPal, and Apple Pay. If your " +
      "card was declined, double check the billing address matches your card statement exactly.",
  },
  {
    keywords: ["warranty", "broken", "defective"],
    answer: "All products include a 1-year manufacturer warranty. If an item " +
      "arrived damaged or stopped working, we'll replace it free of charge.",
  },
];

function matchFaq(message) {
  const text = message.toLowerCase();
  for (const { keywords, answer } of FAQS) {
    if (keywords.some(k => text.includes(k))) return answer;
  }
  return null;
}

function listTopics() {
  return "refunds, shipping, cancellations, payments, warranty";
}

module.exports = { matchFaq, listTopics, FAQS };