/**
 * READ TOOLS
 *
 * These tools simulate read-only API calls to ShopWave's backend services.
 * Each tool can fail realistically via the mockFailures module.
 * The orchestrator calls these via withRetry() for resilience.
 *
 * Tools:
 *   1. get_order(order_id)               - fetch order details
 *   2. get_customer(email)               - fetch customer profile
 *   3. get_product(product_id)           - fetch product metadata
 *   4. search_knowledge_base(query)      - semantic-style KB search
 */

const path = require("path");
const { simulateTimeout, malformedResponse, getFailureMode } = require("./mockFailures");
const logger = require("../utils/logger");

// Load data once at startup (acts like an in-memory DB)
const orders = require("../data/orders.json");
const customers = require("../data/customers.json");
const products = require("../data/products.json");
const { searchKnowledgeBase } = require("../data/knowledgeBase");

// Build index maps for O(1) lookups
const ordersMap = Object.fromEntries(orders.map((o) => [o.order_id, o]));
const customersMap = Object.fromEntries(customers.map((c) => [c.email, c]));
const customersIdMap = Object.fromEntries(customers.map((c) => [c.customer_id, c]));
const productsMap = Object.fromEntries(products.map((p) => [p.product_id, p]));

/**
 * Apply mock failure based on deterministic seed.
 * Returns null if no failure, or throws/returns malformed data.
 */
async function applyMockFailure(toolName, inputKey) {
  const mode = getFailureMode(toolName, inputKey);

  if (mode === "timeout") {
    logger.warn(`[MockFailure] ${toolName}(${inputKey}) -> TIMEOUT`);
    await simulateTimeout(6000);
  }

  if (mode === "malformed") {
    logger.warn(`[MockFailure] ${toolName}(${inputKey}) -> MALFORMED RESPONSE`);
    return { __mock_failure: "malformed", data: null, status: "ok" };
  }

  if (mode === "partial") {
    logger.warn(`[MockFailure] ${toolName}(${inputKey}) -> PARTIAL DATA`);
    return { __mock_failure: "partial" }; // signal to caller
  }

  return null; // no failure
}

// ─────────────────────────────────────────────
// Tool 1: get_order
// ─────────────────────────────────────────────
async function get_order(order_id) {
  logger.info(`[Tool] get_order called`, { order_id });

  const failure = await applyMockFailure("get_order", order_id);
  if (failure && failure.__mock_failure === "malformed") return failure;

  const order = ordersMap[order_id];

  if (!order) {
    return {
      success: false,
      error: `Order ${order_id} not found in the system.`,
      order_id,
    };
  }

  // Partial data: return order without notes and refund_status
  if (failure && failure.__mock_failure === "partial") {
    return {
      success: true,
      order_id: order.order_id,
      customer_id: order.customer_id,
      product_id: order.product_id,
      amount: order.amount,
      status: order.status,
      // Deliberately omitting: order_date, delivery_date, return_deadline, refund_status, notes
    };
  }

  return { success: true, ...order };
}

// ─────────────────────────────────────────────
// Tool 2: get_customer
// ─────────────────────────────────────────────
async function get_customer(email) {
  logger.info(`[Tool] get_customer called`, { email });

  const failure = await applyMockFailure("get_customer", email);
  if (failure && failure.__mock_failure === "malformed") return failure;

  const customer = customersMap[email];

  if (!customer) {
    return {
      success: false,
      error: `No customer account found for email: ${email}`,
      email,
    };
  }

  if (failure && failure.__mock_failure === "partial") {
    // Return customer without notes and total_spent (partial response)
    return {
      success: true,
      customer_id: customer.customer_id,
      name: customer.name,
      email: customer.email,
      tier: customer.tier,
      member_since: customer.member_since,
      total_orders: customer.total_orders,
      // Deliberately omitting: total_spent, address, notes
    };
  }

  return { success: true, ...customer };
}

// ─────────────────────────────────────────────
// Tool 3: get_product
// ─────────────────────────────────────────────
async function get_product(product_id) {
  logger.info(`[Tool] get_product called`, { product_id });

  const failure = await applyMockFailure("get_product", product_id);
  if (failure && failure.__mock_failure === "malformed") return failure;

  const product = productsMap[product_id];

  if (!product) {
    return {
      success: false,
      error: `Product ${product_id} not found.`,
      product_id,
    };
  }

  if (failure && failure.__mock_failure === "partial") {
    return {
      success: true,
      product_id: product.product_id,
      name: product.name,
      category: product.category,
      price: product.price,
      returnable: product.returnable,
      // Deliberately omitting: warranty_months, return_window_days, notes
    };
  }

  return { success: true, ...product };
}

// ─────────────────────────────────────────────
// Tool 4: search_knowledge_base
// ─────────────────────────────────────────────
async function search_knowledge_base(query) {
  logger.info(`[Tool] search_knowledge_base called`, { query });

  // KB search is stable — no random failures (it's a local function)
  const results = searchKnowledgeBase(query);

  if (results.length === 0) {
    return {
      success: true,
      query,
      results: [],
      message: "No matching knowledge base articles found.",
    };
  }

  return {
    success: true,
    query,
    results: results.map((r) => ({
      id: r.id,
      category: r.category,
      title: r.title,
      content: r.content,
      relevance_score: r.relevance_score,
    })),
  };
}

// Helper used by orchestrator to look up customer by order
function getCustomerById(customer_id) {
  return customersIdMap[customer_id] || null;
}

module.exports = {
  get_order,
  get_customer,
  get_product,
  search_knowledge_base,
  getCustomerById,
};
