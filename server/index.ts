import cors from 'cors';
import express from 'express';
import type { Request, Response } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import type { AddressInfo } from 'node:net';

import { assertServerConfig, config } from './config';
import { productSeeds } from './constants';
import { adminDb } from './firebase-admin';
import { AuthedRequest, requireAdmin, requireAuth } from './middleware/auth';
import { ecotrackService } from './services/ecotrack';
import { createOrderAlertService } from './services/order-alerts';

assertServerConfig();

const app = express();
const asyncHandler =
  <T extends Request>(handler: (req: T, res: Response) => Promise<unknown>) =>
  (req: T, res: Response, next: express.NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };

app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  })
);
app.use(express.json());

const productsCollection = adminDb.collection('products');
const ordersCollection = adminDb.collection('orders');
const usersCollection = adminDb.collection('users');
const supportTicketsCollection = adminDb.collection('supportTickets');
const auditLogsCollection = adminDb.collection('adminAuditLogs');
const orderAlertService = createOrderAlertService(config.alerts);

const mapDoc = <T>(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) =>
  ({
    id: doc.id,
    ...doc.data(),
  } as T & { id: string });

const toIsoNow = () => new Date().toISOString();

const sanitizeValue = (value: unknown) => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeValue(entry)])
    );
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
};

const diffRecords = (before: Record<string, unknown>, after: Record<string, unknown>) => {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: Array<{ field: string; before: unknown; after: unknown }> = [];

  for (const key of keys) {
    const previous = sanitizeValue(before[key]);
    const next = sanitizeValue(after[key]);
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;

    changes.push({
      field: key,
      before: previous,
      after: next,
    });
  }

  return changes;
};

const getActor = (req?: AuthedRequest | Request, fallback?: Partial<{ uid: string; email: string | null; name: string | null; isAdmin: boolean }>) => {
  const authedReq = req as AuthedRequest | undefined;
  const actor = authedReq?.user;

  return {
    uid: actor?.uid ?? fallback?.uid ?? 'guest',
    email: actor?.email ?? fallback?.email ?? null,
    name: actor?.name ?? fallback?.name ?? null,
    role: actor?.isAdmin || fallback?.isAdmin ? 'admin' : 'user',
  };
};

const writeAuditLog = async ({
  actor,
  entityType,
  entityId,
  action,
  summary,
  changes,
  metadata,
}: {
  actor: ReturnType<typeof getActor>;
  entityType: 'order' | 'stock' | 'ticket';
  entityId: string;
  action: string;
  summary: string;
  changes?: Array<{ field: string; before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
}) => {
  const entryRef = auditLogsCollection.doc();
  await entryRef.set({
    id: entryRef.id,
    actor,
    entityType,
    entityId,
    action,
    summary,
    changes: (changes ?? []).map((change) => ({
      field: change.field,
      before: sanitizeValue(change.before),
      after: sanitizeValue(change.after),
    })),
    metadata: sanitizeValue(metadata ?? {}),
    createdAt: toIsoNow(),
  });
};

const getStockDiffs = async (items: Array<{ id?: string; qty?: number }>) => {
  const diffs: Array<{ field: string; before: unknown; after: unknown }> = [];

  for (const item of items) {
    const productId = String(item.id ?? '').trim();
    if (!productId) continue;

    const snapshot = await productsCollection.doc(productId).get();
    if (!snapshot.exists) continue;

    const product = mapDoc<any>(snapshot);
    const previousStock = Number(product.stock ?? 0);
    const qty = Number(item.qty ?? 0);

    diffs.push({
      field: `${product.name ?? productId}.stock`,
      before: previousStock,
      after: previousStock - qty,
    });
  }

  return diffs;
};

const getRestockDiffs = async (items: Array<{ id?: string; qty?: number }>) => {
  const diffs: Array<{ field: string; before: unknown; after: unknown }> = [];

  for (const item of items) {
    const productId = String(item.id ?? '').trim();
    if (!productId) continue;

    const snapshot = await productsCollection.doc(productId).get();
    if (!snapshot.exists) continue;

    const product = mapDoc<any>(snapshot);
    const previousStock = Number(product.stock ?? 0);
    const qty = Number(item.qty ?? 0);

    diffs.push({
      field: `${product.name ?? productId}.stock`,
      before: previousStock,
      after: previousStock + qty,
    });
  }

  return diffs;
};

const buildSupportMessage = ({
  senderRole,
  senderName,
  senderId,
  message,
}: {
  senderRole: 'admin' | 'user';
  senderName: string;
  senderId: string;
  message: string;
}) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  senderRole,
  senderName,
  senderId,
  message,
  createdAt: new Date().toISOString(),
});

const buildEcotrackOrderPayload = (payload: any, order: any) => {
  const shipping = payload.shipping ?? {};
  const customer = payload.customer ?? {};
  const itemNames = (order.items ?? [])
    .map((item: { name?: string; qty?: number }) => `${item.name ?? 'Product'} x${Number(item.qty ?? 1)}`)
    .join(', ');

  return {
    reference: order.id,
    nom_client: customer.name ?? '',
    telephone: customer.phone ?? '',
    adresse: shipping.is_stopdesk ? `Stopdesk - ${shipping.commune ?? ''}` : shipping.address ?? '',
    code_wilaya: Number(shipping.wilaya_id ?? 0),
    commune: shipping.commune ?? '',
    montant: Number(order.total ?? 0),
    type: 1,
    produit: itemNames || 'Order items',
    remarque: shipping.is_stopdesk ? 'Stopdesk order' : 'Home delivery order',
  };
};

const notifyOrderCreated = async (order: any) => {
  if (!orderAlertService.isConfigured()) {
    return;
  }

  if (order.source !== 'online') {
    return;
  }

  const itemCount = Array.isArray(order.items)
    ? order.items.reduce((sum: number, item: any) => sum + Number(item.qty ?? 0), 0)
    : 0;

  await orderAlertService.sendOrderCreated({
    orderId: String(order.id ?? ''),
    customerName: String(order.customer?.name ?? '').trim(),
    phone: String(order.customer?.phone ?? '').trim(),
    total: Number(order.total ?? 0),
    itemCount,
    commune: String(order.shipping?.commune ?? '').trim() || undefined,
    source: 'online',
  });
};

const computeStats = async () => {
  const [ordersSnapshot, productsSnapshot] = await Promise.all([
    ordersCollection.orderBy('createdAt', 'desc').get(),
    productsCollection.orderBy('name').get(),
  ]);

  const orders = ordersSnapshot.docs.map((doc) => mapDoc<any>(doc));
  const products = productsSnapshot.docs.map((doc) => mapDoc<any>(doc));

  const confirmedOrders = orders.filter((order) => order.status === 'confirmed');
  const totalRevenue = confirmedOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const totalProfit = confirmedOrders.reduce((sum, order) => {
    const orderProfit = (order.items ?? []).reduce((itemSum: number, item: any) => {
      const product = products.find((entry) => entry.id === item.id);
      if (!product) return itemSum;

      const buyPrice = Number(product.buyPrice ?? 0);
      return itemSum + (Number(product.price) - buyPrice) * Number(item.qty ?? 0);
    }, 0);

    return sum + orderProfit;
  }, 0);

  return {
    totalOrders: orders.length,
    pendingOrders: orders.filter((order) => order.status === 'pending').length,
    confirmedOrders: confirmedOrders.length,
    totalRevenue,
    totalProfit,
    lowStockProducts: products.filter((product) => Number(product.stock ?? 0) <= 10).length,
    totalUnits: products.reduce((sum, product) => sum + Number(product.stock ?? 0), 0),
  };
};

const requireEcotrackConfig = () => {
  if (!ecotrackService.isConfigured()) {
    const error = new Error('Ecotrack is not configured');
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }
};

const normalizeWilayas = (payload: unknown) => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const id = Number(record.wilaya_id ?? record.id ?? record.code ?? record.wilayaId);
      const name = record.wilaya_name ?? record.name ?? record.nom ?? record.label;

      if (!Number.isFinite(id) || typeof name !== 'string' || !name.trim()) {
        return null;
      }

      return {
        id,
        name: name.trim(),
      };
    })
    .filter((entry): entry is { id: number; name: string } => Boolean(entry))
    .sort((a, b) => a.id - b.id);
};

const normalizeCommunes = (payload: unknown) => {
  const rawCommunes = (() => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      if (Array.isArray(record.communes)) return record.communes;
      if (Array.isArray(record.data)) return record.data;
      return Object.values(record);
    }
    return [];
  })();

  return rawCommunes
    .map((entry) => {
      if (typeof entry === 'string') {
        return { nom: entry, has_stop_desk: 1 };
      }

      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const name =
        record.nom ??
        record.name ??
        record.nameFr ??
        record.commune_name ??
        record.commune ??
        record.label;

      if (typeof name !== 'string' || !name.trim()) {
        return null;
      }

      const rawStopDesk =
        record.has_stop_desk ?? record.hasStopDesk ?? record.stopdesk ?? record.stopDesk ?? record.is_stopdesk;

      return {
        nom: name.trim(),
        has_stop_desk: Number(rawStopDesk ?? 1) === 0 ? 0 : 1,
      };
    })
    .filter((entry): entry is { nom: string; has_stop_desk: number } => Boolean(entry));
};

const normalizeFees = (payload: unknown) => {
  const rawFees = (() => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      if (Array.isArray(record.livraison)) return record.livraison;
      if (Array.isArray(record.fees)) return record.fees;
      if (Array.isArray(record.data)) return record.data;
    }
    return [];
  })();

  const livraison = rawFees
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const wilayaId = Number(
        record.wilaya_id ?? record.wilayaId ?? record.id_wilaya ?? record.wilaya ?? record.code
      );

      if (!Number.isFinite(wilayaId) || wilayaId < 1) {
        return null;
      }

      const homeFee = record.tarif ?? record.price ?? record.home_fee ?? record.delivery_fee ?? '600';
      const stopDeskFee =
        record.tarif_stopdesk ?? record.stopdesk ?? record.stop_desk_fee ?? record.pickup_fee ?? homeFee;

      return {
        wilaya_id: String(wilayaId),
        tarif: String(homeFee),
        tarif_stopdesk: String(stopDeskFee),
      };
    })
    .filter(
      (entry): entry is { wilaya_id: string; tarif: string; tarif_stopdesk: string } => Boolean(entry)
    );

  return { livraison };
};

const seedProductsIfEmpty = async () => {
  if (!config.seedProducts) return;

  const snapshot = await productsCollection.limit(1).get();
  if (!snapshot.empty) return;

  const batch = adminDb.batch();
  for (const product of productSeeds) {
    batch.set(productsCollection.doc(product.id), product);
  }
  await batch.commit();
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/api/auth/me', requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const profileSnapshot = await usersCollection.doc(req.user!.uid).get();
  const profile = profileSnapshot.exists ? mapDoc<any>(profileSnapshot) : null;

  res.json({
    user: {
      ...req.user,
      fullName: profile?.fullName ?? req.user?.name ?? null,
      phone: profile?.phone ?? null,
    },
  });
}));

app.get('/api/account', requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const profileSnapshot = await usersCollection.doc(req.user!.uid).get();
  const profile = profileSnapshot.exists ? mapDoc<any>(profileSnapshot) : {};

  res.json({
    profile: {
      uid: req.user?.uid,
      email: req.user?.email ?? null,
      fullName: profile.fullName ?? req.user?.name ?? '',
      phone: profile.phone ?? '',
      updatedAt: profile.updatedAt ?? null,
    },
  });
}));

app.put('/api/account', requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const payload = req.body ?? {};
  const fullName = String(payload.fullName ?? '').trim();
  const phone = String(payload.phone ?? '').trim();

  await usersCollection.doc(req.user!.uid).set(
    {
      uid: req.user?.uid,
      email: req.user?.email ?? null,
      fullName,
      phone,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  res.json({
    profile: {
      uid: req.user?.uid,
      email: req.user?.email ?? null,
      fullName,
      phone,
    },
  });
}));

app.get('/api/ecotrack/wilayas', asyncHandler(async (_req, res) => {
  requireEcotrackConfig();

  const data = await ecotrackService.getWilayas();
  const wilayas = normalizeWilayas(data);
  res.json({ wilayas });
}));

app.get('/api/products', asyncHandler(async (_req, res) => {
  const snapshot = await productsCollection.orderBy('name').get();
  res.json({
    products: snapshot.docs.map((doc) => mapDoc(doc)),
  });
}));

app.post('/api/products', requireAuth, requireAdmin, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const payload = req.body ?? {};
  const id = String(payload.id ?? Date.now());
  const product = {
    ...payload,
    id,
    updatedAt: new Date().toISOString(),
    createdAt: payload.createdAt ?? new Date().toISOString(),
  };

  await productsCollection.doc(id).set(product, { merge: true });
  res.status(201).json({ product });
}));

app.patch('/api/products/:id', requireAuth, requireAdmin, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const id = req.params.id;
  const productRef = productsCollection.doc(id);
  const previousSnapshot = await productRef.get();

  if (!previousSnapshot.exists) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const previousProduct = mapDoc<any>(previousSnapshot);
  await productsCollection.doc(id).set(
    {
      ...req.body,
      updatedAt: toIsoNow(),
    },
    { merge: true }
  );

  const snapshot = await productsCollection.doc(id).get();
  const product = mapDoc<any>(snapshot);
  const changes = diffRecords(previousProduct, product).filter((change) =>
    ['stock', 'buyPrice', 'price', 'name'].includes(change.field)
  );

  if (changes.length > 0) {
    await writeAuditLog({
      actor: getActor(req),
      entityType: 'stock',
      entityId: id,
      action: 'product.updated',
      summary: `Updated product ${product.name ?? id}`,
      changes,
      metadata: {
        productId: id,
      },
    });
  }

  res.json({ product });
}));

app.get('/api/orders', requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const snapshot = await ordersCollection.orderBy('createdAt', 'desc').get();
  const orders = snapshot.docs
    .map((doc) => mapDoc<any>(doc))
    .filter((order) => req.user?.isAdmin || order.userId === req.user?.uid);

  res.json({ orders });
}));

app.post('/api/orders/:id/claim', requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const id = req.params.id;
  const orderRef = ordersCollection.doc(id);
  const orderSnapshot = await orderRef.get();

  if (!orderSnapshot.exists) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const order = mapDoc<any>(orderSnapshot);
  if (order.userId && order.userId !== req.user?.uid && !req.user?.isAdmin) {
    return res.status(403).json({ error: 'Order already belongs to another account' });
  }

  await orderRef.set(
    {
      userId: req.user?.uid ?? null,
      updatedAt: toIsoNow(),
    },
    { merge: true }
  );

  const updatedSnapshot = await orderRef.get();
  const updatedOrder = mapDoc<any>(updatedSnapshot);

  await writeAuditLog({
    actor: getActor(req),
    entityType: 'order',
    entityId: id,
    action: 'order.claimed_by_user',
    summary: `Attached order ${id} to account`,
    changes: [
      {
        field: 'userId',
        before: order.userId ?? null,
        after: req.user?.uid ?? null,
      },
    ],
    metadata: {
      orderId: id,
    },
  });

  res.json({ order: updatedOrder });
}));

app.get('/api/support-tickets', requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const snapshot = await supportTicketsCollection.orderBy('createdAt', 'desc').get();
  const tickets = snapshot.docs
    .map((doc) => mapDoc<any>(doc))
    .filter((ticket) => req.user?.isAdmin || ticket.userId === req.user?.uid);

  res.json({ tickets });
}));

app.post('/api/support-tickets', requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const payload = req.body ?? {};
  const subject = String(payload.subject ?? '').trim();
  const message = String(payload.message ?? '').trim();

  if (!subject || !message) {
    return res.status(400).json({ error: 'Missing support ticket data' });
  }

  const profileSnapshot = await usersCollection.doc(req.user!.uid).get();
  const profile = profileSnapshot.exists ? mapDoc<any>(profileSnapshot) : {};
  const ticketRef = supportTicketsCollection.doc();
  const ticket = {
    id: ticketRef.id,
    userId: req.user?.uid,
    email: req.user?.email ?? null,
    customerName: profile.fullName ?? req.user?.name ?? req.user?.email ?? 'Unknown customer',
    phone: profile.phone ?? '',
    subject,
    message,
    status: 'open',
    lastReplyAt: new Date().toISOString(),
    hasUnreadAdminReply: false,
    hasUnreadUserReply: true,
    replies: [
      buildSupportMessage({
        senderRole: 'user',
        senderName: profile.fullName ?? req.user?.name ?? req.user?.email ?? 'Customer',
        senderId: req.user!.uid,
        message,
      }),
    ],
    createdAt: new Date().toISOString(),
    updatedAt: toIsoNow(),
  };

  await ticketRef.set(ticket);
  await writeAuditLog({
    actor: getActor(req),
    entityType: 'ticket',
    entityId: ticket.id,
    action: 'ticket.created',
    summary: `Created support ticket ${ticket.subject}`,
    metadata: {
      status: ticket.status,
      customerName: ticket.customerName,
    },
  });
  res.status(201).json({ ticket });
}));

app.post('/api/support-tickets/:id/replies', requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const id = req.params.id;
  const message = String(req.body?.message ?? '').trim();
  if (!message) {
    return res.status(400).json({ error: 'Missing reply message' });
  }

  const ticketRef = supportTicketsCollection.doc(id);
  const ticketSnapshot = await ticketRef.get();

  if (!ticketSnapshot.exists) {
    return res.status(404).json({ error: 'Support ticket not found' });
  }

  const ticket = mapDoc<any>(ticketSnapshot);
  const isOwner = ticket.userId === req.user?.uid;
  if (!req.user?.isAdmin && !isOwner) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const profileSnapshot = await usersCollection.doc(req.user!.uid).get();
  const profile = profileSnapshot.exists ? mapDoc<any>(profileSnapshot) : {};
  const reply = buildSupportMessage({
    senderRole: req.user?.isAdmin ? 'admin' : 'user',
    senderName: req.user?.isAdmin
      ? (req.user?.name ?? req.user?.email ?? 'Admin')
      : (profile.fullName ?? req.user?.name ?? req.user?.email ?? 'Customer'),
    senderId: req.user!.uid,
    message,
  });

  const nextReplies = [...(Array.isArray(ticket.replies) ? ticket.replies : []), reply];

  await ticketRef.set(
    {
      replies: nextReplies,
      message: ticket.message ?? message,
      status: req.user?.isAdmin ? ticket.status ?? 'open' : 'open',
      hasUnreadAdminReply: req.user?.isAdmin,
      hasUnreadUserReply: !req.user?.isAdmin,
      lastReplyAt: reply.createdAt,
      updatedAt: toIsoNow(),
    },
    { merge: true }
  );

  const updatedSnapshot = await ticketRef.get();
  const updatedTicket = mapDoc<any>(updatedSnapshot);
  await writeAuditLog({
    actor: getActor(req),
    entityType: 'ticket',
    entityId: id,
    action: req.user?.isAdmin ? 'ticket.replied_admin' : 'ticket.replied_user',
    summary: `Added a reply to ticket ${updatedTicket.subject ?? id}`,
    metadata: {
      status: updatedTicket.status,
      senderRole: reply.senderRole,
    },
  });
  res.json({ ticket: updatedTicket });
}));

app.post('/api/orders', asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body ?? {};
  const cart = Array.isArray(payload.items) ? payload.items : [];

  if (!payload.customer?.name || !payload.customer?.phone || cart.length === 0) {
    return res.status(400).json({ error: 'Missing required order data' });
  }

  const total = cart.reduce(
    (sum: number, item: any) => sum + Number(item.price ?? 0) * Number(item.quantity ?? item.qty ?? 0),
    0
  );

  const orderRef = ordersCollection.doc();
  const shipping = payload.shipping ?? {};
  const order = {
    id: orderRef.id,
    userId: payload.userId ?? null,
    customer: payload.customer,
    items: cart.map((item: any) => ({
      id: item.id,
      name: item.name,
      image: item.image,
      price: Number(item.price ?? 0),
      qty: Number(item.quantity ?? item.qty ?? 1),
    })),
    shipping,
    total: total + Number(shipping?.cost ?? 0),
    subtotal: total,
    status: 'pending',
    paymentMethod: 'cash_on_delivery',
    source: 'online',
    ecotrack: {
      status: 'not_sent',
      sentAt: null,
      response: null,
    },
    createdAt: toIsoNow(),
    updatedAt: toIsoNow(),
  };

  await orderRef.set(order);

  if (payload.userId) {
    await usersCollection.doc(String(payload.userId)).set(
      {
        uid: String(payload.userId),
        fullName: payload.customer?.name ?? '',
        phone: payload.customer?.phone ?? '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  await writeAuditLog({
    actor: getActor(undefined, {
      uid: String(payload.userId ?? 'guest'),
      email: null,
      name: String(payload.customer?.name ?? '').trim() || null,
      isAdmin: false,
    }),
    entityType: 'order',
    entityId: order.id,
    action: 'order.created_online',
    summary: `Created online order ${order.id}`,
    metadata: {
      status: order.status,
      total: order.total,
      customerName: order.customer?.name ?? null,
    },
  });

  notifyOrderCreated(order).catch((error) => {
    console.error('Failed to send order notification', error);
  });

  res.status(201).json({
    order,
  });
}));

app.post(
  '/api/admin/local-sales',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const payload = req.body ?? {};
    const productId = String(payload.productId ?? '').trim();
    const quantity = Math.max(1, Number(payload.quantity ?? 1));
    const unitPrice = Number(payload.unitPrice ?? 0);
    const soldAt = String(payload.soldAt ?? '').trim() || toIsoNow();
    const customerName = String(payload.customerName ?? 'Local sale').trim() || 'Local sale';

    if (!productId || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return res.status(400).json({ error: 'Missing local sale data' });
    }

    const productRef = productsCollection.doc(productId);
    const productSnapshot = await productRef.get();
    if (!productSnapshot.exists) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = mapDoc<any>(productSnapshot);
    const currentStock = Number(product.stock ?? 0);
    if (currentStock < quantity) {
      return res.status(400).json({ error: 'Not enough stock for this local sale' });
    }

    const orderRef = ordersCollection.doc();
    const subtotal = unitPrice * quantity;
    const order = {
      id: orderRef.id,
      userId: req.user?.uid ?? null,
      customer: {
        name: customerName,
        phone: String(payload.phone ?? '').trim(),
      },
      items: [
        {
          id: product.id,
          name: product.name,
          image: product.image ?? '',
          price: unitPrice,
          qty: quantity,
        },
      ],
      shipping: {
        wilaya_id: null,
        commune: 'Local sale',
        is_stopdesk: false,
        address: 'Sold locally',
        cost: 0,
      },
      total: subtotal,
      subtotal,
      status: 'confirmed',
      paymentMethod: 'local_cash',
      source: 'local',
      localSale: {
        recordedBy: req.user?.email ?? req.user?.uid ?? null,
        soldAt,
      },
      ecotrack: {
        status: 'local_sale',
        sentAt: null,
        response: null,
      },
      createdAt: soldAt,
      updatedAt: toIsoNow(),
    };

    const batch = adminDb.batch();
    batch.set(orderRef, order);
    batch.update(productRef, {
      stock: FieldValue.increment(-quantity),
      updatedAt: toIsoNow(),
    });
    await batch.commit();

    await writeAuditLog({
      actor: getActor(req),
      entityType: 'order',
      entityId: order.id,
      action: 'order.created_local_sale',
      summary: `Recorded local sale for ${product.name ?? product.id}`,
      changes: [
        {
          field: 'status',
          before: null,
          after: 'confirmed',
        },
      ],
      metadata: {
        source: 'local',
        total: order.total,
        productId: product.id,
        quantity,
      },
    });
    await writeAuditLog({
      actor: getActor(req),
      entityType: 'stock',
      entityId: product.id,
      action: 'stock.deducted_local_sale',
      summary: `Deducted stock after local sale for ${product.name ?? product.id}`,
      changes: [
        {
          field: 'stock',
          before: currentStock,
          after: currentStock - quantity,
        },
      ],
      metadata: {
        orderId: order.id,
      },
    });

    res.status(201).json({ order });
  })
);

app.patch(
  '/api/orders/:id/status',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    const status = String(req.body?.status ?? '');
    const orderRef = ordersCollection.doc(id);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = mapDoc<any>(orderSnapshot);
    const previousStatus = order.status;
    const actor = getActor(req);

    if (status === 'confirmed' && previousStatus !== 'confirmed') {
      let ecotrackResponse: unknown = null;
      if (ecotrackService.isConfigured()) {
        ecotrackResponse = await ecotrackService.createOrder(buildEcotrackOrderPayload(order, order));
      }

      const batch = adminDb.batch();
      for (const item of order.items ?? []) {
        batch.update(productsCollection.doc(item.id), {
          stock: FieldValue.increment(-Number(item.qty ?? 0)),
          updatedAt: toIsoNow(),
        });
      }
      batch.update(orderRef, {
        status,
        ecotrack: ecotrackService.isConfigured()
          ? {
              status: 'sent',
              sentAt: new Date().toISOString(),
              response: ecotrackResponse,
            }
          : {
              status: 'skipped',
              sentAt: null,
              response: null,
            },
        updatedAt: toIsoNow(),
      });
      await batch.commit();
      await writeAuditLog({
        actor,
        entityType: 'stock',
        entityId: id,
        action: 'stock.deducted_order_confirmation',
        summary: `Deducted stock for confirmed order ${id}`,
        changes: await getStockDiffs(order.items ?? []),
        metadata: {
          orderId: id,
        },
      });
    } else if (status !== 'confirmed' && previousStatus === 'confirmed') {
      const batch = adminDb.batch();
      for (const item of order.items ?? []) {
        batch.update(productsCollection.doc(item.id), {
          stock: FieldValue.increment(Number(item.qty ?? 0)),
          updatedAt: toIsoNow(),
        });
      }
      batch.update(orderRef, {
        status,
        ...(status === 'rejected'
          ? {
              ecotrack: {
                status: 'rejected',
                sentAt: null,
                response: null,
              },
            }
          : {}),
        updatedAt: toIsoNow(),
      });
      await batch.commit();
      await writeAuditLog({
        actor,
        entityType: 'stock',
        entityId: id,
        action: 'stock.restored_order_status_change',
        summary: `Restored stock after changing order ${id} from confirmed`,
        changes: await getRestockDiffs(order.items ?? []),
        metadata: {
          orderId: id,
          nextStatus: status,
        },
      });
    } else {
      await orderRef.set(
        {
          status,
          ...(status === 'rejected'
            ? {
                ecotrack: {
                  status: 'rejected',
                  sentAt: null,
                  response: null,
                },
              }
            : {}),
          updatedAt: toIsoNow(),
        },
        { merge: true }
      );
    }

    const updatedSnapshot = await orderRef.get();
    const updatedOrder = mapDoc<any>(updatedSnapshot);
    await writeAuditLog({
      actor,
      entityType: 'order',
      entityId: id,
      action: 'order.status_changed',
      summary: `Changed order ${id} status`,
      changes: [
        {
          field: 'status',
          before: previousStatus,
          after: updatedOrder.status,
        },
      ],
      metadata: {
        orderId: id,
      },
    });
    res.json({ order: updatedOrder });
  })
);

app.delete(
  '/api/orders/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    const orderRef = ordersCollection.doc(id);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = mapDoc<any>(orderSnapshot);
    if (order.status === 'confirmed') {
      const batch = adminDb.batch();
      for (const item of order.items ?? []) {
        batch.update(productsCollection.doc(item.id), {
          stock: FieldValue.increment(Number(item.qty ?? 0)),
          updatedAt: toIsoNow(),
        });
      }
      batch.delete(orderRef);
      await batch.commit();
      await writeAuditLog({
        actor: getActor(req),
        entityType: 'stock',
        entityId: id,
        action: 'stock.restored_order_deleted',
        summary: `Restored stock after deleting order ${id}`,
        changes: await getRestockDiffs(order.items ?? []),
        metadata: {
          orderId: id,
        },
      });
    } else {
      await orderRef.delete();
    }
    await writeAuditLog({
      actor: getActor(req),
      entityType: 'order',
      entityId: id,
      action: 'order.deleted',
      summary: `Deleted order ${id}`,
      metadata: {
        previousStatus: order.status ?? null,
      },
    });
    res.json({ ok: true, id });
  })
);

app.patch(
  '/api/support-tickets/:id/status',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    const status = String(req.body?.status ?? '').trim() || 'open';
    const ticketRef = supportTicketsCollection.doc(id);
    const ticketSnapshot = await ticketRef.get();

    if (!ticketSnapshot.exists) {
      return res.status(404).json({ error: 'Support ticket not found' });
    }

    await ticketRef.set(
      {
        status,
        hasUnreadAdminReply: status === 'resolved' ? false : ticketSnapshot.data()?.hasUnreadAdminReply ?? false,
        hasUnreadUserReply: status === 'resolved' ? false : ticketSnapshot.data()?.hasUnreadUserReply ?? false,
        updatedAt: toIsoNow(),
      },
      { merge: true }
    );

    const updatedSnapshot = await ticketRef.get();
    const ticket = mapDoc<any>(updatedSnapshot);
    await writeAuditLog({
      actor: getActor(req),
      entityType: 'ticket',
      entityId: id,
      action: 'ticket.status_changed',
      summary: `Changed ticket ${ticket.subject ?? id} status`,
      changes: [
        {
          field: 'status',
          before: ticketSnapshot.data()?.status ?? null,
          after: status,
        },
      ],
      metadata: {
        ticketId: id,
      },
    });
    res.json({ ticket });
  })
);

app.delete(
  '/api/support-tickets/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    const ticketRef = supportTicketsCollection.doc(id);
    const ticketSnapshot = await ticketRef.get();

    if (!ticketSnapshot.exists) {
      return res.status(404).json({ error: 'Support ticket not found' });
    }

    const ticket = mapDoc<any>(ticketSnapshot);
    await ticketRef.delete();
    await writeAuditLog({
      actor: getActor(req),
      entityType: 'ticket',
      entityId: id,
      action: 'ticket.deleted',
      summary: `Deleted support ticket ${ticket.subject ?? id}`,
      metadata: {
        status: ticket.status ?? null,
      },
    });
    res.json({ ok: true, id });
  })
);

app.get('/api/admin/stats', requireAuth, requireAdmin, asyncHandler(async (_req: AuthedRequest, res: Response) => {
  res.json({
    stats: await computeStats(),
  });
}));

app.get('/api/admin/audit-logs', requireAuth, requireAdmin, asyncHandler(async (_req: AuthedRequest, res: Response) => {
  const snapshot = await auditLogsCollection.orderBy('createdAt', 'desc').limit(100).get();
  res.json({
    logs: snapshot.docs.map((doc) => mapDoc(doc)),
  });
}));

app.get('/api/ecotrack/communes', asyncHandler(async (req: Request, res: Response) => {
  requireEcotrackConfig();
  const wilayaId = req.query.wilaya_id ? Number(req.query.wilaya_id) : undefined;
  const data = await ecotrackService.getCommunes(wilayaId);
  const communes = normalizeCommunes(data);
  res.json({ communes });
}));

app.get('/api/ecotrack/fees', asyncHandler(async (_req: Request, res: Response) => {
  requireEcotrackConfig();

  const data = await ecotrackService.getFees();
  res.json(normalizeFees(data));
}));

app.get('/api/ecotrack/products', requireAuth, requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  if (!ecotrackService.isConfigured()) {
    return res.status(400).json({ error: 'Ecotrack is not configured' });
  }

  const data = await ecotrackService.getProducts();
  res.json(data);
}));

app.use((error: any, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error(error);
  const status =
    Number(error?.response?.status) ||
    Number(error?.statusCode) ||
    Number(error?.status) ||
    500;
  const externalMessage =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.statusText;

  res.status(status).json({
    error: externalMessage || error?.message || 'Internal server error',
    details: status >= 500 ? undefined : error?.response?.data,
  });
});

const checkExistingServer = async () => {
  try {
    const response = await fetch(`http://localhost:${config.port}/api/health`);
    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
};

const startServer = async () => {
  await seedProductsIfEmpty();

  const server = app.listen(config.port);

  server.on('listening', () => {
    const address = server.address() as AddressInfo | null;
    const port = address?.port ?? config.port;
    console.log(`API server listening on http://localhost:${port}`);
  });

  server.on('error', async (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      const existingServerIsHealthy = await checkExistingServer();

      if (existingServerIsHealthy) {
        console.log(`API server is already running on http://localhost:${config.port}`);
        process.exit(0);
      }

      console.error(
        `Port ${config.port} is already in use by another process. Stop that process or change API_PORT and VITE_API_URL.`
      );
      process.exit(1);
    }

    console.error('Failed to start API server', error);
    process.exit(1);
  });
};

startServer().catch((error) => {
  console.error('Failed to start API server', error);
  process.exit(1);
});
