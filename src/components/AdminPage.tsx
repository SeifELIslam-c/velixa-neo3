import React, { useEffect, useRef, useState } from "react";
import { Product, useStore } from "../store";
import { Menu, X, LayoutDashboard, ShoppingBag, PackageSearch, MessageSquareText, CheckCheck, Trash2, Copy, Sparkles, History, Store, RefreshCw, BellRing } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { subscribeToOrders, subscribeToSupportTickets } from "@/lib/realtime";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface OrderItem {
  id: string;
  name: string;
  image?: string;
  price: number;
  qty: number;
}

interface ShippingInfo {
  wilaya_id?: number | null;
  commune?: string;
  is_stopdesk?: boolean;
  address?: string;
  cost?: number;
}

interface OrderRecord {
  id: string;
  customer?: {
    name?: string;
    phone?: string;
  };
  items?: OrderItem[];
  shipping?: ShippingInfo;
  total?: number;
  subtotal?: number;
  status?: string;
  paymentMethod?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SupportTicketRecord {
  id: string;
  customerName?: string;
  email?: string | null;
  phone?: string;
  subject?: string;
  message?: string;
  status?: string;
  hasUnreadAdminReply?: boolean;
  hasUnreadUserReply?: boolean;
  createdAt?: string;
  updatedAt?: string;
  replies?: Array<{
    id: string;
    senderRole: "admin" | "user";
    senderName: string;
    senderId: string;
    message: string;
    createdAt: string;
  }>;
}

interface AuditLogRecord {
  id: string;
  action?: string;
  summary?: string;
  entityType?: "order" | "stock" | "ticket";
  entityId?: string;
  createdAt?: string;
  actor?: {
    uid?: string;
    email?: string | null;
    name?: string | null;
    role?: string;
  };
  changes?: Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
  metadata?: Record<string, unknown>;
}

interface LocalSaleFormState {
  productId: string;
  quantity: string;
  unitPrice: string;
  soldAt: string;
  customerName: string;
  phone: string;
}

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDateInputValue = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sameDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getOrderQuantity = (order: OrderRecord) =>
  (order.items ?? []).reduce((sum, item) => sum + Number(item.qty ?? 0), 0);

const getShippingLabel = (shipping?: ShippingInfo) =>
  shipping?.is_stopdesk ? "Stopdesk" : "Home Delivery";

const getShippingAddress = (shipping?: ShippingInfo) => {
  if (!shipping) return "No shipping info";
  if (shipping.is_stopdesk) {
    return [shipping.commune, shipping.wilaya_id ? `Wilaya ${shipping.wilaya_id}` : ""].filter(Boolean).join(", ");
  }
  return shipping.address?.trim() || "No address";
};

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

const formatChangeValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "empty";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const isWithinDateRange = (value: string | undefined, from: string, to: string) => {
  const date = toDate(value);
  if (!date) return false;

  if (from) {
    const fromDate = new Date(`${from}T00:00:00`);
    if (date < fromDate) return false;
  }

  if (to) {
    const toDateValue = new Date(`${to}T23:59:59`);
    if (date > toDateValue) return false;
  }

  return true;
};

const getLast7DaysSales = (orders: OrderRecord[]) => {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - (6 - index));
    return {
      key: sameDayKey(date),
      day: WEEK_DAYS[date.getDay()],
      value: 0,
      orders: 0,
    };
  });

  const byDay = new Map(days.map((day) => [day.key, day]));
  for (const order of orders) {
    const createdAt = toDate(order.createdAt);
    if (!createdAt) continue;

    const day = byDay.get(sameDayKey(createdAt));
    if (!day) continue;

    day.value += Number(order.total ?? 0);
    day.orders += 1;
  }

  return days;
};

const getLiveStats = (orders: OrderRecord[], products: Product[]) => {
  const confirmedOrders = orders.filter((order) => order.status === "confirmed");
  const totalRevenue = confirmedOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const totalProfit = confirmedOrders.reduce((sum, order) => {
    const profit = (order.items ?? []).reduce((itemSum, item) => {
      const product = products.find((entry) => entry.id === item.id);
      const buyPrice = Number(product?.buyPrice ?? 0);
      return itemSum + (Number(item.price ?? 0) - buyPrice) * Number(item.qty ?? 0);
    }, 0);

    return sum + profit;
  }, 0);

  return {
    totalOrders: orders.length,
    pendingOrders: orders.filter((order) => order.status === "pending").length,
    confirmedOrders: confirmedOrders.length,
    totalRevenue,
    totalProfit,
    lowStockProducts: products.filter((product) => Number(product.stock ?? 0) <= 10).length,
    totalUnits: products.reduce((sum, product) => sum + Number(product.stock ?? 0), 0),
  };
};

export function AdminPage() {
  const { products, user } = useStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDesktopSidebar, setIsDesktopSidebar] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderSourceFilter, setOrderSourceFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [localSaleSaving, setLocalSaleSaving] = useState(false);
  const latestOrderIdRef = useRef<string | null>(null);
  const latestTicketReplyRef = useRef<string | null>(null);
  const [localSaleForm, setLocalSaleForm] = useState<LocalSaleFormState>({
    productId: "",
    quantity: "1",
    unitPrice: "",
    soldAt: toDateInputValue(),
    customerName: "",
    phone: "",
  });

  useEffect(() => {
    const unsubscribeOrders = subscribeToOrders((snapshotOrders) => setOrders(snapshotOrders as OrderRecord[]));
    const unsubscribeTickets = subscribeToSupportTickets((snapshotTickets) =>
      setSupportTickets(snapshotTickets as SupportTicketRecord[])
    );

    return () => {
      unsubscribeOrders();
      unsubscribeTickets();
    };
  }, []);

  useEffect(() => {
    const onResize = () => setIsDesktopSidebar(window.innerWidth >= 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!adminNotice) return;
    const timeout = window.setTimeout(() => setAdminNotice(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [adminNotice]);

  useEffect(() => {
    const selectedProduct = products.find((product) => product.id === localSaleForm.productId);
    if (!selectedProduct) return;
    if (localSaleForm.unitPrice) return;

    setLocalSaleForm((current) => ({
      ...current,
      unitPrice: String(selectedProduct.price ?? ""),
    }));
  }, [localSaleForm.productId, localSaleForm.unitPrice, products]);

  useEffect(() => {
    if (!user?.isAdmin || orders.length === 0) return;

    const newestOrderId = orders[0]?.id ?? null;
    if (!latestOrderIdRef.current) {
      latestOrderIdRef.current = newestOrderId;
      return;
    }

    if (newestOrderId && newestOrderId !== latestOrderIdRef.current) {
      latestOrderIdRef.current = newestOrderId;
      setAdminNotice(`New order received: ${newestOrderId}`);
      refreshAuditLogs({ silent: true });
    }
  }, [orders, user]);

  useEffect(() => {
    if (!user?.isAdmin || supportTickets.length === 0) return;

    const newestTicketKey = `${supportTickets[0]?.id ?? ""}:${supportTickets[0]?.updatedAt ?? ""}`;
    if (!latestTicketReplyRef.current) {
      latestTicketReplyRef.current = newestTicketKey;
      return;
    }

    if (newestTicketKey !== latestTicketReplyRef.current && supportTickets[0]?.hasUnreadUserReply) {
      latestTicketReplyRef.current = newestTicketKey;
      setAdminNotice(`New support reply from ${supportTickets[0]?.customerName ?? "customer"}.`);
      refreshAuditLogs({ silent: true });
      return;
    }

    latestTicketReplyRef.current = newestTicketKey;
  }, [supportTickets, user]);

  const refreshAuditLogs = (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsRefreshingLogs(true);
    }

    apiFetch<{ logs: AuditLogRecord[] }>("/admin/audit-logs")
      .then((response) => {
        setAuditLogs(Array.isArray(response.logs) ? response.logs : []);
        setLastRefreshAt(new Date().toISOString());
      })
      .catch(() => undefined)
      .finally(() => {
        if (!options?.silent) {
          setIsRefreshingLogs(false);
        }
      });
  };

  useEffect(() => {
    if (!user?.isAdmin) return;
    refreshAuditLogs();
  }, [user]);

  useEffect(() => {
    if (!user?.isAdmin) return;

    const refresh = () => refreshAuditLogs({ silent: true });
    const interval = window.setInterval(refresh, 20000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);

  const confirmOrder = (orderId: string) => {
    apiFetch(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "confirmed" }),
    })
      .then(() => {
        setAdminNotice("Order confirmed and inventory updated.");
        refreshAuditLogs();
      })
      .catch(() => undefined);
  };

  const rejectOrder = (orderId: string) => {
    apiFetch(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected" }),
    })
      .then(() => {
        setAdminNotice("Order status updated.");
        refreshAuditLogs();
      })
      .catch(() => undefined);
  };

  const deleteOrder = (orderId: string) => {
    apiFetch(`/orders/${orderId}`, {
      method: "DELETE",
    })
      .then(() => {
        setAdminNotice("Order deleted.");
        refreshAuditLogs();
      })
      .catch(() => undefined);
  };

  const updateSupportTicket = (ticketId: string, status: "open" | "resolved") => {
    apiFetch<{ ticket: SupportTicketRecord }>(`/support-tickets/${ticketId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    })
      .then((response) => {
        setSupportTickets((current) =>
          current.map((ticket) => (ticket.id === ticketId ? response.ticket : ticket))
        );
        setAdminNotice(status === "resolved" ? "Ticket resolved and alert cleared." : "Ticket reopened.");
        refreshAuditLogs();
      })
      .catch(() => undefined);
  };

  const deleteSupportTicket = (ticketId: string) => {
    apiFetch(`/support-tickets/${ticketId}`, {
      method: "DELETE",
    })
      .then(() => {
        setSupportTickets((current) => current.filter((ticket) => ticket.id !== ticketId));
        setAdminNotice("Ticket deleted.");
        refreshAuditLogs();
      })
      .catch(() => undefined);
  };

  const replyToSupportTicket = (ticketId: string, options?: { resolveAfterReply?: boolean }) => {
    const message = String(replyDrafts[ticketId] ?? "").trim();
    if (!message) return;

    apiFetch<{ ticket: SupportTicketRecord }>(`/support-tickets/${ticketId}/replies`, {
      method: "POST",
      body: JSON.stringify({ message }),
    })
      .then(async (response) => {
        let nextTicket = response.ticket;
        if (options?.resolveAfterReply) {
          const resolved = await apiFetch<{ ticket: SupportTicketRecord }>(`/support-tickets/${ticketId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: "resolved" }),
          });
          nextTicket = resolved.ticket;
        }

        setSupportTickets((current) =>
          current.map((ticket) => (ticket.id === ticketId ? nextTicket : ticket))
        );
        setReplyDrafts((current) => ({ ...current, [ticketId]: "" }));
        setAdminNotice(options?.resolveAfterReply ? "Reply sent and ticket resolved." : "Reply sent to customer.");
        refreshAuditLogs();
      })
      .catch(() => undefined);
  };

  const applyTicketTemplate = (ticketId: string, template: string) => {
    setReplyDrafts((current) => ({ ...current, [ticketId]: template }));
    setAdminNotice("Template added to reply box.");
  };

  const copyOrderTemplate = async (order: OrderRecord, mode: "confirm" | "delay") => {
    const customer = order.customer?.name ?? "client";
    const delivery = getShippingLabel(order.shipping);
    const commune = order.shipping?.commune ?? "your area";
    const template =
      mode === "confirm"
        ? `Hello ${customer}, your Velixa Neo order ${order.id} is confirmed. Delivery: ${delivery}. Area: ${commune}. We will contact you shortly before dispatch.`
        : `Hello ${customer}, your Velixa Neo order ${order.id} is being prepared. Delivery to ${commune} is still in queue, and we will contact you as soon as it is ready.`;

    try {
      await copyText(template);
      setAdminNotice(mode === "confirm" ? "Confirmation template copied." : "Delay template copied.");
    } catch {
      setAdminNotice("Unable to copy template.");
    }
  };

  const updateProductField = async (productId: string, field: "buyPrice" | "stock", value: string) => {
    const numericValue = parseFloat(value);
    if (Number.isNaN(numericValue)) return;

    setSavingProductId(productId);
    try {
      await apiFetch(`/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: numericValue }),
      });
      setAdminNotice(field === "stock" ? "Stock updated." : "Product cost updated.");
      refreshAuditLogs();
    } finally {
      setSavingProductId(null);
    }
  };

  const submitLocalSale = async () => {
    const selectedProduct = products.find((product) => product.id === localSaleForm.productId);
    if (!selectedProduct) return;

    setLocalSaleSaving(true);
    try {
      await apiFetch("/admin/local-sales", {
        method: "POST",
        body: JSON.stringify({
          productId: localSaleForm.productId,
          quantity: Number(localSaleForm.quantity),
          unitPrice: Number(localSaleForm.unitPrice),
          soldAt: new Date(`${localSaleForm.soldAt}T12:00:00`).toISOString(),
          customerName: localSaleForm.customerName,
          phone: localSaleForm.phone,
        }),
      });
      setLocalSaleForm({
        productId: "",
        quantity: "1",
        unitPrice: "",
        soldAt: toDateInputValue(),
        customerName: "",
        phone: "",
      });
      setAdminNotice("Local sale recorded and stock updated.");
      refreshAuditLogs();
    } finally {
      setLocalSaleSaving(false);
    }
  };

  const openSupportCount = supportTickets.filter(
    (ticket) => ticket.status !== "resolved" && ticket.hasUnreadUserReply
  ).length;

  const menuItems = [
    { id: "dashboard", label: t("Dashboard"), icon: <LayoutDashboard size={18} /> },
    { id: "orders", label: t("Orders"), icon: <ShoppingBag size={18} /> },
    { id: "products", label: t("Products & Stock"), icon: <PackageSearch size={18} /> },
    { id: "support", label: t("Support"), icon: <MessageSquareText size={18} />, badge: openSupportCount },
    { id: "history", label: t("Audit History"), icon: <History size={18} /> },
  ];

  const orderStatusOptions = ["all", "pending", "confirmed", "rejected"];
  const selectedProduct = products.find((product) => product.id === localSaleForm.productId);
  const filteredOrders = orders.filter((order) => {
    const matchesStatus = orderStatusFilter === "all" || (order.status ?? "pending") === orderStatusFilter;
    const source = order.source === "local" ? "local" : "online";
    const matchesSource = orderSourceFilter === "all" || source === orderSourceFilter;
    const matchesDate = isWithinDateRange(order.createdAt, dateFrom, dateTo);
    return matchesStatus && matchesSource && matchesDate;
  });

  const filteredAuditLogs = auditLogs.filter((log) => isWithinDateRange(log.createdAt, dateFrom, dateTo));
  const liveStats = getLiveStats(filteredOrders, products);
  const pendingOrders = liveStats.pendingOrders;
  const lowStockProducts = products.filter((product) => product.stock <= 10);
  const totalUnits = liveStats.totalUnits;
  const totalRevenue = liveStats.totalRevenue;
  const totalProfit = liveStats.totalProfit;
  const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
  const weeklySales = getLast7DaysSales(filteredOrders);
  const maxWeeklySales = Math.max(...weeklySales.map((point) => point.value), 1);
  const localSalesCount = filteredOrders.filter((order) => order.source === "local" && order.status === "confirmed").length;
  const openUserTickets = supportTickets.filter((ticket) => ticket.status !== "resolved" && ticket.hasUnreadUserReply);
  const recentActivity = [
    ...filteredOrders.slice(0, 4).map((order) => ({
      id: `order-${order.id}`,
      title: `${order.source === "local" ? "Local sale" : "Order"} from ${order.customer?.name ?? "client"}`,
      detail: `${Number(order.total ?? 0).toLocaleString()} DZD • ${getOrderQuantity(order)} items`,
      createdAt: order.createdAt ?? new Date(0).toISOString(),
      tone: order.source === "local" ? "bg-emerald-400" : "bg-amber-300",
    })),
    ...supportTickets
      .filter((ticket) => ticket.hasUnreadUserReply)
      .slice(0, 3)
      .map((ticket) => ({
        id: `ticket-${ticket.id}`,
        title: `Support reply from ${ticket.customerName ?? "customer"}`,
        detail: ticket.subject ?? "Support ticket",
        createdAt: ticket.updatedAt ?? ticket.createdAt ?? new Date(0).toISOString(),
        tone: "bg-red-500",
      })),
    ...filteredAuditLogs.slice(0, 3).map((log) => ({
      id: `log-${log.id}`,
      title: log.summary ?? "Audit entry",
      detail: `${log.actor?.email ?? log.actor?.name ?? "Unknown"} • ${log.entityType ?? "entity"}`,
      createdAt: log.createdAt ?? new Date(0).toISOString(),
      tone: "bg-sky-400",
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const ticketTemplates = [
    "Hello, we received your ticket and we are checking it now. We will update you shortly.",
    "Hello, thank you for your message. The issue has been fixed from our side, please try again and let us know.",
    "Hello, your request is completed. If everything is okay now, we will close this ticket.",
  ];

  if (!user) {
    return (
      <div className="bg-bg-luxe min-h-screen text-white px-3 py-4 md:px-8 md:py-8 font-sans flex">
        <div className="mx-auto mt-16 max-w-xl rounded-3xl border border-amber-400/20 bg-amber-400/10 p-8 text-center text-amber-100">
          <p className="text-xl font-bold">Sign in required.</p>
          <p className="mt-3 text-sm text-amber-50/80">Use the approved admin email on the login page, then come back here.</p>
          <Link
            to="/admin/login"
            className="mt-6 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-5 py-3 text-sm font-bold uppercase tracking-widest text-amber-100 transition hover:bg-amber-300/20"
          >
            Open Admin Login
          </Link>
        </div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="bg-bg-luxe min-h-screen text-white px-3 py-4 md:px-8 md:py-8 font-sans flex">
        <div className="mx-auto mt-16 max-w-xl rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center text-red-200">
          <p className="text-xl font-bold">Admin access required.</p>
          <p className="mt-3 text-sm text-red-100/80">
            Signed in as <span className="font-semibold">{user.email ?? "unknown email"}</span>.
          </p>
          <p className="mt-2 text-sm text-red-100/70">This account is not in the backend admin email allowlist yet.</p>
          <Link
            to="/admin/login"
            className="mt-6 inline-flex rounded-full border border-red-300/30 bg-red-300/10 px-5 py-3 text-sm font-bold uppercase tracking-widest text-red-100 transition hover:bg-red-300/20"
          >
            Switch Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-luxe min-h-screen pb-24 text-white px-3 py-4 md:px-8 md:py-8 font-sans flex">
      <button
        onClick={() => setMenuOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 rounded-full border border-border-luxe bg-surface-luxe p-3 shadow-lg"
      >
        <Menu size={20} />
      </button>

      {(menuOpen || isDesktopSidebar) && (
        <div className={`fixed md:sticky top-0 left-0 h-screen md:h-[calc(100vh-2rem)] w-[18rem] bg-surface-luxe border-r border-border-luxe z-[60] p-5 flex flex-col pt-20 md:pt-6 ${menuOpen ? "block shadow-2xl" : "hidden md:flex"}`}>
          <button
            onClick={() => setMenuOpen(false)}
            className="md:hidden absolute top-6 right-6 rounded-full bg-black/50 p-2 text-white/50 hover:text-white"
          >
            <X size={24} />
          </button>
          <div className="mb-6 border-b border-white/10 pb-4">
            <p className="text-[11px] uppercase tracking-[0.35em] text-red-300">Velixa Neo</p>
            <h2 className="mt-3 text-xl font-bold uppercase tracking-widest text-white/80">{t("Admin Panel")}</h2>
          </div>
          <div className="flex flex-col gap-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMenuOpen(false);
                }}
                className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] transition-all ${
                  activeTab === item.id
                    ? "border border-accent-luxe/30 bg-accent-luxe/20 text-accent-luxe"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  {item.label}
                </span>
                {item.badge ? <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" /> : null}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 w-full max-w-6xl mx-auto md:ml-8 mt-16 md:mt-0">
        <div className="mb-8 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,18,0.98),rgba(9,9,9,0.98))] px-5 py-5 md:px-8 md:py-7 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-red-300">Velixa Neo</p>
              <h1 className="mt-3 text-[1.6rem] font-[800] uppercase tracking-[-1px] md:text-[3rem] md:tracking-[-2px]">
                {activeTab === "dashboard" && t("Admin Panel")}
                {activeTab === "orders" && t("Order Management")}
                {activeTab === "products" && t("Inventory System")}
                {activeTab === "support" && t("Support Tickets")}
                {activeTab === "history" && t("Audit History")}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-white/75">
                <BellRing size={14} />
                <span>{openUserTickets.length} open</span>
              </div>
              <button
                type="button"
                onClick={() => refreshAuditLogs()}
                disabled={isRefreshingLogs}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-white/75 transition hover:text-white disabled:opacity-50"
              >
                <RefreshCw size={14} className={isRefreshingLogs ? "animate-spin" : ""} />
                <span>{isRefreshingLogs ? "Refreshing" : "Refresh"}</span>
              </button>
            </div>
          </div>
          {adminNotice ? (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">
              <CheckCheck size={14} />
              {adminNotice}
            </div>
          ) : null}
          {lastRefreshAt ? (
            <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-white/35">
              Updated internally at {toDate(lastRefreshAt)?.toLocaleTimeString() ?? "--:--"}
            </p>
          ) : null}
        </div>

        <div className="space-y-8">
          {activeTab === "dashboard" && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
                {[
                  { label: "Total Orders", value: liveStats.totalOrders, accent: "from-red-500 to-red-300" },
                  { label: "Pending Orders", value: pendingOrders, accent: "from-amber-400 to-amber-200" },
                  { label: "Gross Revenue", value: `${totalRevenue.toLocaleString()} DZD`, accent: "from-emerald-500 to-emerald-300" },
                  { label: "Net Profit", value: `${totalProfit.toLocaleString()} DZD`, accent: "from-sky-500 to-sky-300" },
                  { label: "Local Completed", value: localSalesCount, accent: "from-fuchsia-500 to-fuchsia-300" },
                ].map((card) => (
                  <div key={card.label} className="bg-[linear-gradient(180deg,rgba(34,34,34,0.96),rgba(15,15,15,0.96))] border border-white/8 p-6 rounded-[24px] shadow-lg relative overflow-hidden">
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.accent}`} />
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">{t(card.label)}</p>
                    <p className="mt-5 text-3xl font-black">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
                <div className="rounded-[26px] border border-white/10 bg-surface-luxe p-6 shadow-2xl">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">{t("Sales Overview")}</p>
                      <h2 className="mt-2 text-2xl font-bold text-white">{totalRevenue.toLocaleString()} DZD</h2>
                    </div>
                    <div className="text-right text-sm text-white/50">
                      <p>{profitMargin}% {t("Profit margin")}</p>
                      <p>{liveStats.confirmedOrders} {t("Confirmed").toLowerCase()}</p>
                    </div>
                  </div>
                  <div className="mt-8 flex h-60 items-end gap-3">
                    {weeklySales.map((point) => (
                      <div key={point.key} className="flex flex-1 flex-col items-center gap-3">
                        <div className="relative flex w-full items-end justify-center rounded-t-2xl bg-white/5" style={{ height: "180px" }}>
                          <div
                            className="w-full rounded-t-2xl bg-gradient-to-t from-red-600 via-red-500 to-red-300 transition-all"
                            style={{ height: `${Math.max(12, (point.value / maxWeeklySales) * 100)}%` }}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">{point.day}</p>
                          <p className="mt-1 text-[11px] text-white/45">{point.orders}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[26px] border border-white/10 bg-surface-luxe p-6 shadow-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">{t("Inventory Health")}</p>
                      <h2 className="mt-2 text-2xl font-bold">{totalUnits} units</h2>
                    </div>
                    <div className="rounded-full border border-red-400/20 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-red-100">
                      {lowStockProducts.length} alerts
                    </div>
                  </div>
                  <div className="mt-6 space-y-3">
                    {lowStockProducts.slice(0, 5).map((product) => (
                      <div key={product.id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{product.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">
                            {product.stock <= 5 ? t("Needs restock") : t("Low Stock")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${product.stock <= 5 ? "bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.95)]" : "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]"}`} />
                          <span className="text-sm font-bold">{product.stock}</span>
                        </div>
                      </div>
                    ))}
                    {lowStockProducts.length === 0 ? (
                      <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-5 text-sm text-white/55">
                        {t("No low stock alerts right now.")}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-[26px] border border-white/10 bg-surface-luxe p-6 shadow-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">{t("Operations Feed")}</p>
                      <h2 className="mt-2 text-2xl font-bold">{recentActivity.length} live items</h2>
                    </div>
                    <Sparkles size={18} className="text-red-300" />
                  </div>
                  <div className="mt-6 space-y-3">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-4">
                        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${activity.tone}`} />
                        <div className="min-w-0">
                          <p className="font-semibold">{activity.title}</p>
                          <p className="mt-1 text-sm text-white/50">{activity.detail}</p>
                          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/35">
                            {toDate(activity.createdAt)?.toLocaleString() ?? "Unknown date"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[26px] border border-white/10 bg-surface-luxe p-6 shadow-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Local completed sale</p>
                      <h2 className="mt-2 text-2xl font-bold">Record an in-store sale</h2>
                    </div>
                    <Store size={18} className="text-red-300" />
                  </div>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <select
                      value={localSaleForm.productId}
                      onChange={(event) => setLocalSaleForm((current) => ({ ...current, productId: event.target.value, unitPrice: "" }))}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-red-400/50 md:col-span-2"
                    >
                      <option value="">Choose product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} • {product.stock} in stock
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={localSaleForm.quantity}
                      onChange={(event) => setLocalSaleForm((current) => ({ ...current, quantity: event.target.value }))}
                      placeholder="Quantity"
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-red-400/50"
                    />
                    <input
                      type="number"
                      min="0"
                      value={localSaleForm.unitPrice}
                      onChange={(event) => setLocalSaleForm((current) => ({ ...current, unitPrice: event.target.value }))}
                      placeholder="Custom sale price"
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-red-400/50"
                    />
                    <input
                      type="date"
                      value={localSaleForm.soldAt}
                      onChange={(event) => setLocalSaleForm((current) => ({ ...current, soldAt: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-red-400/50"
                    />
                    <input
                      type="text"
                      value={localSaleForm.customerName}
                      onChange={(event) => setLocalSaleForm((current) => ({ ...current, customerName: event.target.value }))}
                      placeholder="Customer label (optional)"
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-red-400/50"
                    />
                    <input
                      type="text"
                      value={localSaleForm.phone}
                      onChange={(event) => setLocalSaleForm((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="Phone (optional)"
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-red-400/50 md:col-span-2"
                    />
                  </div>
                  <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 px-4 py-4 text-sm text-white/60">
                    {selectedProduct ? (
                      <p>
                        Recording <span className="font-semibold text-white">{selectedProduct.name}</span> at{" "}
                        <span className="font-semibold text-white">{Number(localSaleForm.unitPrice || selectedProduct.price).toLocaleString()} DZD</span>.
                        This will deduct stock online and count inside the revenue chart.
                      </p>
                    ) : (
                      <p>Select a product to create a local completed order.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!localSaleForm.productId || !localSaleForm.quantity || !localSaleForm.unitPrice || localSaleSaving}
                    onClick={() => void submitLocalSale()}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-red-400/20 bg-red-500/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {localSaleSaving ? "Saving..." : "Save local completed sale"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "orders" && (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const expanded = expandedOrderId === order.id;
                return (
                  <div key={order.id} className="overflow-hidden rounded-[24px] border border-white/10 bg-surface-luxe shadow-2xl">
                    <button
                      type="button"
                      onClick={() => setExpandedOrderId((current) => (current === order.id ? null : order.id))}
                      className="w-full px-6 py-5 text-left"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="font-mono text-sm text-white/70">{order.id}</p>
                            <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                              order.status === "confirmed"
                                ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                                : order.status === "rejected"
                                  ? "border border-red-400/30 bg-red-500/10 text-red-300"
                                  : "border border-amber-300/30 bg-amber-400/10 text-amber-200"
                            }`}>
                              {order.status ?? "pending"}
                            </span>
                            <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                              order.source === "local"
                                ? "border border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200"
                                : "border border-sky-400/30 bg-sky-500/10 text-sky-200"
                            }`}>
                              {order.source === "local" ? "local sale" : "online"}
                            </span>
                          </div>
                          <p className="mt-3 text-xl font-bold">{order.customer?.name ?? "Unknown client"}</p>
                          <p className="mt-1 text-sm text-white/50">
                            {toDate(order.createdAt)?.toLocaleString() ?? "Unknown date"} • {getOrderQuantity(order)} items
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 xl:min-w-[330px]">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">{t("Total")}</p>
                            <p className="mt-2 font-semibold">{Number(order.total ?? 0).toLocaleString()} DZD</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Delivery</p>
                            <p className="mt-2 font-semibold">{order.source === "local" ? "Local completed" : getShippingLabel(order.shipping)}</p>
                          </div>
                        </div>
                      </div>
                    </button>

                    {expanded ? (
                      <div className="border-t border-white/10 bg-black/20 px-6 py-6">
                        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
                          <div className="rounded-[18px] border border-white/8 bg-black/20 p-5">
                            <h3 className="text-lg font-bold">Order details</h3>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-white/45 uppercase tracking-[0.18em] text-[10px]">Name</p>
                                <p className="mt-2 font-medium">{order.customer?.name ?? "Unknown"}</p>
                              </div>
                              <div>
                                <p className="text-white/45 uppercase tracking-[0.18em] text-[10px]">Phone</p>
                                <p className="mt-2 font-medium">{order.customer?.phone ?? "No phone"}</p>
                              </div>
                              <div>
                                <p className="text-white/45 uppercase tracking-[0.18em] text-[10px]">Delivery type</p>
                                <p className="mt-2 font-medium">{order.source === "local" ? "Local completed" : getShippingLabel(order.shipping)}</p>
                              </div>
                              <div>
                                <p className="text-white/45 uppercase tracking-[0.18em] text-[10px]">Commune</p>
                                <p className="mt-2 font-medium">{order.shipping?.commune ?? "No commune"}</p>
                              </div>
                              <div className="md:col-span-2">
                                <p className="text-white/45 uppercase tracking-[0.18em] text-[10px]">
                                  {order.shipping?.is_stopdesk ? "Stopdesk pickup point" : "Address"}
                                </p>
                                <p className="mt-2 font-medium">{getShippingAddress(order.shipping)}</p>
                              </div>
                              <div>
                                <p className="text-white/45 uppercase tracking-[0.18em] text-[10px]">Subtotal</p>
                                <p className="mt-2 font-medium">{Number(order.subtotal ?? 0).toLocaleString()} DZD</p>
                              </div>
                              <div>
                                <p className="text-white/45 uppercase tracking-[0.18em] text-[10px]">Shipping</p>
                                <p className="mt-2 font-medium">{Number(order.shipping?.cost ?? 0).toLocaleString()} DZD</p>
                              </div>
                              <div>
                                <p className="text-white/45 uppercase tracking-[0.18em] text-[10px]">Payment</p>
                                <p className="mt-2 font-medium">{order.paymentMethod ?? "cash_on_delivery"}</p>
                              </div>
                              <div>
                                <p className="text-white/45 uppercase tracking-[0.18em] text-[10px]">Created at</p>
                                <p className="mt-2 font-medium">{toDate(order.createdAt)?.toLocaleString() ?? "Unknown date"}</p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-[18px] border border-white/8 bg-black/20 p-5">
                            <h3 className="text-lg font-bold">Items</h3>
                            <div className="mt-4 space-y-3">
                              {(order.items ?? []).map((item) => (
                                <div key={`${order.id}-${item.id}`} className="flex items-center gap-4 rounded-2xl border border-white/6 bg-white/5 p-4">
                                  {item.image ? (
                                    <img src={item.image} alt={item.name} className="h-14 w-14 rounded-xl object-cover bg-black" />
                                  ) : (
                                    <div className="h-14 w-14 rounded-xl bg-black/40" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">{item.name}</p>
                                    <p className="text-sm text-white/50">Qty: {item.qty}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold">{Number(item.price ?? 0).toLocaleString()} DZD</p>
                                    <p className="text-sm text-white/50">
                                      {(Number(item.price ?? 0) * Number(item.qty ?? 0)).toLocaleString()} DZD
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-[18px] border border-white/8 bg-black/20 p-5">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <h3 className="text-lg font-bold">Order templates</h3>
                                <p className="mt-1 text-sm text-white/45">Fast customer messages for WhatsApp or SMS</p>
                              </div>
                              <Sparkles size={18} className="text-red-300" />
                            </div>
                            <div className="mt-4 space-y-3">
                              <button
                                type="button"
                                onClick={() => void copyOrderTemplate(order, "confirm")}
                                className="flex w-full items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-left"
                              >
                                <span>
                                  <span className="block text-sm font-semibold text-white">Confirmation template</span>
                                  <span className="mt-1 block text-xs text-white/55">For approved orders ready to dispatch</span>
                                </span>
                                <Copy size={16} className="text-emerald-200" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void copyOrderTemplate(order, "delay")}
                                className="flex w-full items-center justify-between rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-left"
                              >
                                <span>
                                  <span className="block text-sm font-semibold text-white">Delay/update template</span>
                                  <span className="mt-1 block text-xs text-white/55">For queued orders that still need prep</span>
                                </span>
                                <Copy size={16} className="text-amber-100" />
                              </button>
                            </div>
                          </div>

                          <div className="rounded-[18px] border border-white/8 bg-black/20 p-5">
                            <h3 className="text-lg font-bold">Actions</h3>
                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                onClick={() => confirmOrder(order.id)}
                                disabled={order.status === "confirmed"}
                                className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-40"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => rejectOrder(order.id)}
                                className="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-400/20"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => deleteOrder(order.id)}
                                className="rounded-full border border-red-400/20 bg-red-500/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-red-100 transition hover:bg-red-500/20"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <Trash2 size={14} />
                                  Delete
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {filteredOrders.length === 0 ? (
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-5 text-white/55">No matching orders.</div>
              ) : null}
            </div>
          )}

          {activeTab === "products" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:hidden">
                {products.map((product) => (
                  <div key={product.id} className="rounded-[22px] border border-white/10 bg-surface-luxe p-4 shadow-2xl">
                    <div className="flex items-center gap-4">
                      <img src={product.image} alt={product.name} className="h-14 w-14 rounded-[14px] bg-black object-cover" />
                      <div className="min-w-0">
                        <p className="truncate font-bold">{product.name}</p>
                        <p className="mt-1 text-sm font-bold text-accent-luxe">{product.price.toLocaleString()} DZD</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <label className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-xs uppercase tracking-[0.16em] text-white/45">
                        <span className="block">Cost</span>
                        <input
                          type="number"
                          defaultValue={product.buyPrice ?? ""}
                          placeholder="0"
                          onBlur={(e) => void updateProductField(product.id, "buyPrice", e.target.value)}
                          className="mt-2 w-full border-none bg-transparent p-0 text-sm font-bold text-white outline-none"
                        />
                      </label>
                      <label className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-xs uppercase tracking-[0.16em] text-white/45">
                        <span className="block">Stock</span>
                        <input
                          type="number"
                          defaultValue={product.stock}
                          min="0"
                          onBlur={(e) => void updateProductField(product.id, "stock", e.target.value)}
                          className="mt-2 w-full border-none bg-transparent p-0 text-sm font-bold text-white outline-none"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                      <span className="text-xs uppercase tracking-[0.16em] text-white/45">Profit</span>
                      <span className="text-sm font-bold text-emerald-300">
                        {product.buyPrice !== undefined ? (product.price - product.buyPrice).toLocaleString() : "---"} DZD
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden w-full overflow-x-auto rounded-[20px] border border-border-luxe bg-surface-luxe shadow-2xl md:block">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead className="border-b border-border-luxe bg-[#1a1a1a] text-[10px] font-bold uppercase tracking-[2px] text-white/50">
                    <tr>
                      <th className="p-6">{t("Product")}</th>
                      <th className="p-6">{t("Sell Price")}</th>
                      <th className="p-6">{t("Buy Price (Cost)")}</th>
                      <th className="p-6">Editable stock</th>
                      <th className="p-6">{t("Profit/Unit")}</th>
                      <th className="p-6">{t("Stock Level")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-luxe">
                    {products.map((product) => (
                      <tr key={product.id} className="transition-colors hover:bg-white/5">
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <img src={product.image} alt={product.name} className="h-12 w-12 rounded-[10px] bg-black object-cover" />
                            <span className="text-sm font-bold tracking-wide">{product.name}</span>
                          </div>
                        </td>
                        <td className="p-6 text-sm font-bold text-accent-luxe">{product.price.toLocaleString()} DZD</td>
                        <td className="p-6">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              defaultValue={product.buyPrice ?? ""}
                              placeholder="0"
                              onBlur={(e) => void updateProductField(product.id, "buyPrice", e.target.value)}
                              className="w-24 rounded border border-border-luxe bg-black px-3 py-1 text-sm text-white outline-none focus:border-accent-luxe"
                            />
                            <span className="text-xs font-bold uppercase text-white/50">DZD</span>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              defaultValue={product.stock}
                              min="0"
                              onBlur={(e) => void updateProductField(product.id, "stock", e.target.value)}
                              className="w-24 rounded border border-border-luxe bg-black px-3 py-1 text-sm text-white outline-none focus:border-accent-luxe"
                            />
                            <span className="text-xs font-bold uppercase text-white/50">
                              {savingProductId === product.id ? "Saving" : "Units"}
                            </span>
                          </div>
                        </td>
                        <td className="p-6 text-sm font-bold text-[#22c55e]">
                          {product.buyPrice !== undefined ? (product.price - product.buyPrice).toLocaleString() : "---"} DZD
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                product.stock > 10
                                  ? "bg-[#22c55e] shadow-[0_0_10px_#22c55e]"
                                  : product.stock > 0
                                    ? "bg-[#fbbf24] shadow-[0_0_10px_#fbbf24]"
                                    : "bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.95)]"
                              }`}
                            />
                            <span className="text-[11px] font-bold uppercase tracking-[1px]">{product.stock} {t("Available")}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "support" && (
            <div className="space-y-4">
              {supportTickets.length > 0 ? supportTickets.map((ticket) => (
                <div key={ticket.id} className="rounded-[22px] border border-white/10 bg-surface-luxe p-6 shadow-2xl">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">Client</p>
                        <p className="mt-2 font-semibold">{ticket.customerName ?? "Unknown customer"}</p>
                        <p className="text-sm text-white/55">{ticket.email ?? "No email"} {ticket.phone ? ` • ${ticket.phone}` : ""}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">Subject</p>
                        <p className="mt-2 font-semibold">{ticket.subject}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">Message</p>
                        <p className="mt-2 text-white/75">{ticket.message}</p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/35">{toDate(ticket.createdAt)?.toLocaleString() ?? "Unknown date"}</p>
                    </div>
                    <div className="flex flex-col items-start gap-3 lg:items-end">
                      <span className={`rounded-full px-3 py-1 text-[10px] uppercase font-bold tracking-[0.2em] ${
                        ticket.status === "resolved"
                          ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                          : "border border-amber-300/30 bg-amber-400/10 text-amber-200"
                      }`}>
                        {ticket.status ?? "open"}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => updateSupportTicket(ticket.id, "resolved")}
                          className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/20"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => updateSupportTicket(ticket.id, "open")}
                          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/75 transition hover:bg-white/10"
                        >
                          Reopen
                        </button>
                        <button
                          onClick={() => deleteSupportTicket(ticket.id)}
                          className="rounded-full border border-red-400/20 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-red-100 transition hover:bg-red-500/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  {ticket.replies && ticket.replies.length > 0 ? (
                    <div className="mt-5 space-y-3 border-t border-white/8 pt-5">
                      {ticket.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className={`rounded-2xl px-4 py-3 text-sm ${
                            reply.senderRole === "admin"
                              ? "border border-red-400/20 bg-red-500/10 text-red-100"
                              : "border border-white/8 bg-white/5 text-white/75"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold">{reply.senderRole === "admin" ? "Admin" : "Client"}</span>
                            <span className="text-[10px] uppercase tracking-[0.18em] opacity-60">{toDate(reply.createdAt)?.toLocaleString() ?? "Unknown date"}</span>
                          </div>
                          <p className="mt-2">{reply.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-5 space-y-3 border-t border-white/8 pt-5">
                    <div className="flex flex-wrap gap-2">
                      {ticketTemplates.map((template) => (
                        <button
                          key={`${ticket.id}-${template}`}
                          type="button"
                          onClick={() => applyTicketTemplate(ticket.id, template)}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/65 transition hover:bg-white/10 hover:text-white"
                        >
                          Quick template
                        </button>
                      ))}
                    </div>
                    <textarea
                      placeholder="Reply to this support ticket"
                      value={replyDrafts[ticket.id] ?? ""}
                      onChange={(event) =>
                        setReplyDrafts((current) => ({
                          ...current,
                          [ticket.id]: event.target.value,
                        }))
                      }
                      className="h-28 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-red-400/50"
                    />
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => replyToSupportTicket(ticket.id)}
                        className="rounded-full border border-red-400/20 bg-red-500/10 px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:bg-red-500/20"
                      >
                        Send Reply
                      </button>
                      <button
                        onClick={() => replyToSupportTicket(ticket.id, { resolveAfterReply: true })}
                        className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-500/20"
                      >
                        Reply & Resolve
                      </button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-5 text-white/55">No support tickets yet.</div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-4">
              {filteredAuditLogs.map((log) => (
                <div key={log.id} className="rounded-[22px] border border-white/10 bg-surface-luxe p-6 shadow-2xl">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                          log.entityType === "order"
                            ? "border border-sky-400/30 bg-sky-500/10 text-sky-200"
                            : log.entityType === "stock"
                              ? "border border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200"
                              : "border border-amber-400/30 bg-amber-500/10 text-amber-200"
                        }`}>
                          {log.entityType ?? "entity"}
                        </span>
                        <p className="text-sm text-white/45">{log.action}</p>
                      </div>
                      <h3 className="mt-3 text-xl font-bold">{log.summary ?? "Audit entry"}</h3>
                      <p className="mt-2 text-sm text-white/55">
                        {log.actor?.name ?? "Unknown"} • {log.actor?.email ?? "No email"} • {log.actor?.role ?? "user"}
                      </p>
                    </div>
                    <p className="text-sm text-white/45">{toDate(log.createdAt)?.toLocaleString() ?? "Unknown date"}</p>
                  </div>

                  {log.changes && log.changes.length > 0 ? (
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {log.changes.map((change, index) => (
                        <div key={`${log.id}-${change.field}-${index}`} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">{change.field}</p>
                          <p className="mt-3 text-sm text-white/45">Before: <span className="text-white/80">{formatChangeValue(change.before)}</span></p>
                          <p className="mt-1 text-sm text-white/45">After: <span className="text-white">{formatChangeValue(change.after)}</span></p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {filteredAuditLogs.length === 0 ? (
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-5 text-white/55">No audit history yet.</div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="fixed inset-x-3 bottom-3 z-50 md:hidden">
        <div className="grid grid-cols-5 gap-2 rounded-[28px] border border-white/10 bg-[#0b0b0c]/92 p-2 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          {menuItems.map((item) => (
            <button
              key={`mobile-${item.id}`}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMenuOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`flex min-h-[4.1rem] flex-col items-center justify-center gap-1 rounded-[22px] px-2 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                activeTab === item.id
                  ? "bg-red-500/14 text-white"
                  : "text-white/55"
              }`}
            >
              {item.icon}
              <span className="leading-tight">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
