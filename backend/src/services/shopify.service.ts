import axios from 'axios';
import crypto from 'crypto';

const SHOPIFY_API_VERSION = '2024-01';

export interface ShopifyOrder {
  id: number;
  name: string; // #1001
  email: string;
  phone: string | null;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  currency: string;
  created_at: string;
  line_items: Array<{
    title: string;
    quantity: number;
    price: string;
    variant_title: string | null;
  }>;
  fulfillments: Array<{
    status: string;
    tracking_number: string | null;
    tracking_company: string | null;
    tracking_url: string | null;
  }>;
  shipping_address?: {
    city: string;
    country: string;
  };
  estimated_delivery?: string;
}

// ─── Shopify OAuth ─────────────────────────────────────────────────────────────

export function buildInstallUrl(shop: string, clientId: string, redirectUri: string, scopes: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
    'grant_options[]': 'per-user',
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
  shop: string,
  clientId: string,
  clientSecret: string,
  code: string
): Promise<string> {
  const res = await axios.post(`https://${shop}/admin/oauth/access_token`, {
    client_id: clientId,
    client_secret: clientSecret,
    code,
  });
  return (res.data as { access_token: string }).access_token;
}

export function verifyHmac(query: Record<string, string>, secret: string): boolean {
  const { hmac, ...rest } = query;
  if (!hmac) return false;
  const message = Object.entries(rest)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

// ─── Order Lookup ──────────────────────────────────────────────────────────────

export async function lookupOrderByName(shop: string, accessToken: string, orderName: string): Promise<ShopifyOrder | null> {
  // Normalize: #1234 or 1234
  const name = orderName.startsWith('#') ? orderName : `#${orderName}`;
  try {
    const res = await axios.get(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken },
        params: { name, status: 'any', limit: 1 },
      }
    );
    const orders = (res.data as { orders: ShopifyOrder[] }).orders;
    return orders[0] ?? null;
  } catch {
    return null;
  }
}

export async function lookupOrdersByPhone(shop: string, accessToken: string, phone: string): Promise<ShopifyOrder[]> {
  // Try both with and without country code
  const normalized = phone.replace(/\D/g, '');
  try {
    const res = await axios.get(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken },
        params: { phone: normalized, status: 'any', limit: 5 },
      }
    );
    return (res.data as { orders: ShopifyOrder[] }).orders;
  } catch {
    return [];
  }
}

export async function lookupOrdersByEmail(shop: string, accessToken: string, email: string): Promise<ShopifyOrder[]> {
  try {
    const res = await axios.get(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken },
        params: { email, status: 'any', limit: 5 },
      }
    );
    return (res.data as { orders: ShopifyOrder[] }).orders;
  } catch {
    return [];
  }
}

// ─── Format order for WhatsApp ─────────────────────────────────────────────────

export function formatOrderForWhatsApp(order: ShopifyOrder): string {
  const statusMap: Record<string, string> = {
    pending: 'Pending / Pending',
    authorized: 'Payment Authorized',
    partially_paid: 'Partially Paid',
    paid: 'Payment Received',
    partially_refunded: 'Partially Refunded',
    refunded: 'Refunded',
    voided: 'Cancelled',
  };

  const fulfillMap: Record<string, string> = {
    fulfilled: 'Shipped / Dispatched',
    partial: 'Partially Shipped',
    restocked: 'Returned',
    null: 'Processing',
  };

  const payStatus = statusMap[order.financial_status] ?? order.financial_status;
  const fulfillStatus = fulfillMap[order.fulfillment_status ?? 'null'] ?? 'Processing';

  const items = order.line_items
    .map(i => `${i.title}${i.variant_title ? ` (${i.variant_title})` : ''} x${i.quantity}`)
    .join(', ');

  const tracking = order.fulfillments[0];
  const trackingLine = tracking?.tracking_number
    ? `Tracking: ${tracking.tracking_company ?? ''} ${tracking.tracking_number}`
    : '';

  return [
    `Order ${order.name}`,
    `Items: ${items}`,
    `Amount: ${order.currency} ${order.total_price}`,
    `Payment: ${payStatus}`,
    `Delivery: ${fulfillStatus}`,
    trackingLine,
  ].filter(Boolean).join('\n');
}
