import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import {
  buildInstallUrl,
  exchangeCodeForToken,
  verifyHmac,
} from '../services/shopify.service';

const CLIENT_ID = process.env['SHOPIFY_CLIENT_ID'] ?? '';
const CLIENT_SECRET = process.env['SHOPIFY_CLIENT_SECRET'] ?? '';
const BACKEND_URL = process.env['BACKEND_URL'] ?? 'https://whatsapp-production-c833.up.railway.app';
const REDIRECT_URI = `${BACKEND_URL}/shopify/callback`;
const SCOPES = 'read_orders,read_all_orders';

// Step 1 — redirect to Shopify OAuth
// Visit: /shopify/install?shop=s02kxa-mx.myshopify.com&org=<orgId>
export async function shopifyInstall(req: Request, res: Response): Promise<void> {
  const shop = String(req.query['shop'] ?? '');
  const orgId = String(req.query['org'] ?? '');

  if (!shop || !shop.includes('.myshopify.com')) {
    res.status(400).send('Missing or invalid shop parameter. Use: /shopify/install?shop=yourstore.myshopify.com&org=YOUR_ORG_ID');
    return;
  }

  const state = `${orgId}:${crypto.randomBytes(16).toString('hex')}`;
  const installUrl = buildInstallUrl(shop, CLIENT_ID, REDIRECT_URI, SCOPES, state);
  res.redirect(installUrl);
}

// Step 2 — Shopify redirects back here with code
export async function shopifyCallback(req: Request, res: Response): Promise<void> {
  const query = req.query as Record<string, string>;
  const { shop, code, state } = query;

  if (!shop || !code) {
    res.status(400).send('Missing shop or code parameter');
    return;
  }

  // Verify HMAC
  if (!verifyHmac(query, CLIENT_SECRET)) {
    res.status(401).send('Invalid HMAC signature');
    return;
  }

  try {
    // Exchange code for permanent access token
    const accessToken = await exchangeCodeForToken(shop, CLIENT_ID, CLIENT_SECRET, code);

    // Extract orgId from state (format: "orgId:randomhex")
    const orgId = state?.split(':')[0] ?? '';

    // Save to organization
    if (orgId) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { shopifyShop: shop, shopifyToken: accessToken },
      });
      console.log(`[Shopify] Connected store ${shop} to org ${orgId}`);
    } else {
      // Save to first org found (for single-org setups)
      const org = await prisma.organization.findFirst();
      if (org) {
        await prisma.organization.update({
          where: { id: org.id },
          data: { shopifyShop: shop, shopifyToken: accessToken },
        });
        console.log(`[Shopify] Connected store ${shop} to org ${org.id}`);
      }
    }

    res.send(`
      <html>
        <body style="font-family:sans-serif;text-align:center;padding:60px">
          <h1 style="color:#22c55e">✅ Shopify Connected!</h1>
          <p>Your store <strong>${shop}</strong> has been connected to Rexo Bot.</p>
          <p>The bot can now look up real order details for your customers.</p>
          <p style="color:#666;margin-top:40px">You can close this window.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('[Shopify] OAuth error:', err);
    res.status(500).send('Failed to connect Shopify store. Please try again.');
  }
}
