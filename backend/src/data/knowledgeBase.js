// ShopWave Support Knowledge Base
// Structured for fast keyword + semantic search

const knowledgeBase = [
  {
    id: "kb-001",
    category: "return_policy",
    title: "Standard Return Window",
    content:
      "Most products have a 30-day return window from the date of delivery. Items must be unused, in original condition, and in original packaging. Proof of purchase (order ID) is required for all returns.",
    keywords: ["return", "window", "30 day", "original", "condition", "packaging"],
  },
  {
    id: "kb-002",
    category: "return_policy",
    title: "Category-Specific Return Windows",
    content:
      "Electronics accessories (laptop stands, cables, mounts): 60-day return window. High-value electronics (smart watches, tablets, laptops): 15-day return window only. Footwear: 30-day return window. Sports & fitness equipment: 30-day return window, non-returnable if used due to hygiene policy.",
    keywords: ["electronics", "accessories", "60 day", "smart watch", "15 day", "footwear", "sports", "fitness"],
  },
  {
    id: "kb-003",
    category: "return_policy",
    title: "Non-Returnable Items",
    content:
      "Items registered online after purchase (e.g. Bluetooth devices, smart devices with activation), perishable goods, downloadable software or digital content, and items marked as Final Sale at time of purchase are non-returnable.",
    keywords: ["non-returnable", "registered", "bluetooth", "digital", "final sale", "activation"],
  },
  {
    id: "kb-004",
    category: "return_policy",
    title: "Damaged or Defective on Arrival",
    content:
      "If an item arrives damaged or defective, the customer is eligible for a full refund or replacement regardless of return window. Photo evidence is required to process the claim. The customer is not required to return the damaged item in most cases.",
    keywords: ["damaged", "defective", "arrival", "doa", "broken", "cracked", "photo", "evidence"],
  },
  {
    id: "kb-005",
    category: "return_policy",
    title: "Wrong Item Delivered",
    content:
      "If the wrong item is delivered, ShopWave will arrange return pickup and ship the correct item at no cost. If the correct item is out of stock, a full refund is issued. This does not count against the standard return window.",
    keywords: ["wrong item", "wrong colour", "wrong size", "incorrect", "delivered wrong", "exchange"],
  },
  {
    id: "kb-006",
    category: "refund_policy",
    title: "Refund Eligibility",
    content:
      "Refunds are only issued after eligibility is confirmed via the check_refund_eligibility tool. Refunds are processed to the original payment method. Standard processing time is 5-7 business days after approval. Refunds cannot be reversed once issued.",
    keywords: ["refund", "eligibility", "5-7 days", "payment method", "processing time"],
  },
  {
    id: "kb-007",
    category: "refund_policy",
    title: "Refund Exceptions by Customer Tier",
    content:
      "Standard: Standard return and refund policy applies, no exceptions. Premium: Agents may use judgment to approve borderline cases (1-3 days outside return window), requires supervisor note. VIP: Extended leniency, management pre-approvals may be on file, always check customer notes before declining.",
    keywords: ["tier", "vip", "premium", "standard", "exception", "leniency", "borderline"],
  },
  {
    id: "kb-008",
    category: "warranty_policy",
    title: "Warranty Coverage and Periods",
    content:
      "Warranty covers manufacturing defects only. Does not cover physical damage caused by user, water damage, or unauthorised modifications. Warranty periods: Electronics (headphones, speakers, smart watches): 12 months. Home appliances (coffee makers): 24 months. Electronics accessories: 6 months. Footwear and sports products: No warranty.",
    keywords: ["warranty", "defect", "manufacturing", "12 months", "24 months", "6 months", "coverage"],
  },
  {
    id: "kb-009",
    category: "warranty_policy",
    title: "Warranty Claim Process",
    content:
      "Customer must provide order ID and description of defect. Agent should verify warranty period using order delivery date and product warranty duration. Warranty claims are escalated to the warranty team — agents do not resolve warranty claims directly.",
    keywords: ["warranty claim", "escalate", "warranty team", "defect description", "verify"],
  },
  {
    id: "kb-010",
    category: "cancellation_policy",
    title: "Order Cancellation Policy",
    content:
      "Orders in processing status can be cancelled free of charge at any time before shipment. Orders in shipped status cannot be cancelled — customer must wait for delivery and initiate a return. Orders in delivered status cannot be cancelled. Cancellations are confirmed via email within 1 hour.",
    keywords: ["cancel", "cancellation", "processing", "shipped", "delivered", "before shipment"],
  },
  {
    id: "kb-011",
    category: "exchange_policy",
    title: "Exchange Policy",
    content:
      "Exchanges are available for wrong size, wrong colour, or wrong item delivered. Exchange requests are fulfilled subject to stock availability. If the desired item is unavailable, a full refund is offered instead. Exchanges do not extend the original return window.",
    keywords: ["exchange", "swap", "size", "colour", "color", "wrong", "stock", "availability"],
  },
  {
    id: "kb-012",
    category: "escalation_guidelines",
    title: "Escalation Guidelines",
    content:
      "Escalate a ticket to a human agent when: the issue involves a warranty claim, customer is requesting a replacement for a damaged item, conflicting data between customer claims and system records, refund amount exceeds $200, signs of fraud or social engineering, resolution requires supervisor approval, or agent confidence score is below 0.6.",
    keywords: ["escalate", "human", "warranty", "replacement", "fraud", "supervisor", "confidence", "$200"],
  },
  {
    id: "kb-013",
    category: "faq",
    title: "How long does a refund take?",
    content:
      "Refunds are processed within 5-7 business days after approval. The time to appear in the customer account depends on their bank.",
    keywords: ["how long", "refund time", "5-7", "business days", "bank"],
  },
  {
    id: "kb-014",
    category: "faq",
    title: "Can I return a product I've used?",
    content:
      "Generally no. Products must be in original, unused condition. Exceptions apply for defective or damaged items.",
    keywords: ["used", "return used", "condition", "original"],
  },
  {
    id: "kb-015",
    category: "faq",
    title: "Free Returns Policy",
    content:
      "Free returns apply for wrong items delivered and damaged/defective items. Standard returns may incur a return shipping fee depending on the reason.",
    keywords: ["free return", "shipping fee", "return cost", "no cost"],
  },
];

/**
 * Search the knowledge base using keyword matching with relevance scoring.
 * Returns top matching articles sorted by relevance.
 */
function searchKnowledgeBase(query) {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

  const scored = knowledgeBase.map((article) => {
    let score = 0;

    // Title match — highest weight
    if (article.title.toLowerCase().includes(queryLower)) score += 10;

    // Content match
    const contentLower = article.content.toLowerCase();
    queryWords.forEach((word) => {
      if (contentLower.includes(word)) score += 3;
    });

    // Keyword match
    article.keywords.forEach((kw) => {
      const kwLower = kw.toLowerCase();
      if (queryLower.includes(kwLower)) score += 5;
      queryWords.forEach((word) => {
        if (kwLower.includes(word)) score += 2;
      });
    });

    return { ...article, relevance_score: score };
  });

  return scored
    .filter((a) => a.relevance_score > 0)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 3);
}

module.exports = { knowledgeBase, searchKnowledgeBase };
