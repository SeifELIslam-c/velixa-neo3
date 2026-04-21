import { useEffect, useState } from "react";
import { Navbar } from "./Navbar";
import { useStore } from "@/store";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface AccountProfile {
  uid: string;
  email: string | null;
  fullName: string;
  phone: string;
}

interface AccountOrder {
  id: string;
  total?: number;
  status?: string;
  createdAt?: string;
  customer?: { name?: string; phone?: string };
  shipping?: { commune?: string; is_stopdesk?: boolean; address?: string };
}

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  hasUnreadAdminReply?: boolean;
  hasUnreadUserReply?: boolean;
  createdAt?: string;
  replies?: Array<{
    id: string;
    senderRole: "admin" | "user";
    senderName: string;
    senderId: string;
    message: string;
    createdAt: string;
  }>;
}

const formatDate = (value?: string) => {
  if (!value) return "Unknown date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
};

export function AccountPage() {
  const { user, setUser } = useStore();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [supportForm, setSupportForm] = useState({ subject: "", message: "" });
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadAccountData = () =>
    Promise.all([
      apiFetch<{ profile: AccountProfile }>("/account"),
      apiFetch<{ orders: AccountOrder[] }>("/orders"),
      apiFetch<{ tickets: SupportTicket[] }>("/support-tickets"),
    ]).then(([profileResponse, ordersResponse, ticketsResponse]) => {
      setProfile(profileResponse.profile);
      setOrders(ordersResponse.orders);
      setTickets(ticketsResponse.tickets);
    });

  useEffect(() => {
    if (!user) return;

    loadAccountData()
      .catch(() => {
        setStatusMessage(t("Unable to load account data right now."));
      });
  }, [user, t]);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;

    const pendingOrderId = window.sessionStorage.getItem("velixa-last-order-id");
    const shouldClaimOrder = window.sessionStorage.getItem("velixa-post-order-created") === "true";
    if (!pendingOrderId || !shouldClaimOrder) return;

    apiFetch(`/orders/${pendingOrderId}/claim`, {
      method: "POST",
    })
      .then(() => loadAccountData())
      .then(() => {
        setStatusMessage("Your latest order ticket has been saved to your account.");
        window.sessionStorage.removeItem("velixa-last-order-id");
        window.sessionStorage.removeItem("velixa-post-order-created");
      })
      .catch(() => {
        setStatusMessage(t("Unable to load account data right now."));
      });
  }, [user, t]);

  if (!user) {
    return (
      <div className="bg-bg-luxe min-h-screen text-white pt-24 pb-12 px-6">
        <Navbar />
        <div className="mx-auto mt-24 max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-3xl font-black">{t("Client Account")}</h1>
          <p className="mt-3 text-white/60">{t("Sign in to view your orders, support tickets, and saved information.")}</p>
          <Link
            to="/login"
            className="mt-6 inline-flex rounded-full border border-red-400/20 bg-red-500/10 px-5 py-3 text-sm font-bold uppercase tracking-widest text-white"
          >
            {t("Open Login")}
          </Link>
        </div>
      </div>
    );
  }

  const saveProfile = async () => {
    if (!profile) return;

    const response = await apiFetch<{ profile: AccountProfile }>("/account", {
      method: "PUT",
      body: JSON.stringify({
        fullName: profile.fullName,
        phone: profile.phone,
      }),
    });

    setProfile(response.profile);
    setUser({
      ...user,
      fullName: response.profile.fullName,
      phone: response.profile.phone,
      name: response.profile.fullName || user.name,
    });
    setStatusMessage(t("Your information has been updated."));
  };

  const submitSupportTicket = async () => {
    const response = await apiFetch<{ ticket: SupportTicket }>("/support-tickets", {
      method: "POST",
      body: JSON.stringify(supportForm),
    });

    setTickets((current) => [response.ticket, ...current]);
    setSupportForm({ subject: "", message: "" });
    setStatusMessage(t("Your support ticket has been sent to admin."));
  };

  const replyToTicket = async (ticketId: string) => {
    const message = String(replyDrafts[ticketId] ?? "").trim();
    if (!message) return;

    const response = await apiFetch<{ ticket: SupportTicket }>(`/support-tickets/${ticketId}/replies`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });

    setTickets((current) => current.map((ticket) => (ticket.id === ticketId ? response.ticket : ticket)));
    setReplyDrafts((current) => ({ ...current, [ticketId]: "" }));
    setStatusMessage(t("Your reply has been sent."));
  };

  return (
    <div className="bg-bg-luxe min-h-screen text-white pt-24 pb-12 px-6">
      <Navbar />
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,20,0.98),rgba(9,9,9,0.98))] p-8 shadow-2xl">
          <p className="text-[11px] uppercase tracking-[0.35em] text-red-300">Velixa Neo</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">{t("Client Account")}</h1>
          <p className="mt-3 max-w-2xl text-white/60">
            {t("Track your orders, message support when you need help, and save your name and phone to make checkout faster.")}
          </p>
          {statusMessage && (
            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {statusMessage}
            </div>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
          <div className="rounded-[26px] border border-white/10 bg-surface-luxe p-6 shadow-2xl">
            <h2 className="text-2xl font-bold">{t("Profile")}</h2>
            <div className="mt-6 space-y-4">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/45">{t("Email")}</p>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white/70">
                  {profile?.email ?? user.email ?? "No email"}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/45">{t("Full name")}</p>
                <input
                  value={profile?.fullName ?? ""}
                  onChange={(e) => setProfile((current) => current ? { ...current, fullName: e.target.value } : current)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-red-400/50"
                />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/45">Phone</p>
                <input
                  value={profile?.phone ?? ""}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(e) => setProfile((current) => current ? { ...current, phone: e.target.value.replace(/\D/g, "").slice(0, 10) } : current)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-red-400/50"
                />
              </div>
              <button
                onClick={saveProfile}
                className="w-full rounded-full bg-red-500 px-5 py-3 font-bold uppercase tracking-[0.18em] text-white transition hover:bg-red-400"
              >
                {t("Save Information")}
              </button>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-surface-luxe p-6 shadow-2xl">
            <h2 className="text-2xl font-bold">{t("Support")}</h2>
            <div className="mt-6 space-y-4">
              <input
                placeholder={t("Ticket subject")}
                value={supportForm.subject}
                onChange={(e) => setSupportForm((current) => ({ ...current, subject: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-red-400/50"
              />
              <textarea
                placeholder={t("Describe your issue")}
                value={supportForm.message}
                onChange={(e) => setSupportForm((current) => ({ ...current, message: e.target.value }))}
                className="h-32 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-red-400/50"
              />
              <button
                onClick={submitSupportTicket}
                className="w-full rounded-full border border-red-400/20 bg-red-500/10 px-5 py-3 font-bold uppercase tracking-[0.18em] text-white transition hover:bg-red-500/20"
              >
                {t("Create Support Ticket")}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[26px] border border-white/10 bg-surface-luxe p-6 shadow-2xl">
            <h2 className="text-2xl font-bold">{t("Your Order Tickets")}</h2>
            <div className="mt-5 space-y-4">
              {orders.length > 0 ? orders.map((order) => (
                <div key={order.id} className="rounded-[22px] border border-white/8 bg-black/20 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">{t("Order ticket")}</p>
                      <p className="mt-2 font-mono text-sm">{order.id}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                      order.status === "confirmed"
                        ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                        : order.status === "rejected"
                          ? "border border-red-400/30 bg-red-500/10 text-red-300"
                          : "border border-amber-300/30 bg-amber-400/10 text-amber-200"
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Total</p>
                      <p className="mt-2 font-semibold">{Number(order.total ?? 0).toLocaleString()} DZD</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">{t("Date")}</p>
                      <p className="mt-2 font-semibold">{formatDate(order.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">{t("Delivery")}</p>
                      <p className="mt-2 font-semibold">{order.shipping?.is_stopdesk ? t("Office delivery") : t("Home delivery")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">{t("Location")}</p>
                      <p className="mt-2 font-semibold">{order.shipping?.is_stopdesk ? order.shipping?.commune : order.shipping?.address}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-white/55">{t("Your order has been posted successfully. You will be contacted soon for confirmation.")}</p>
                </div>
              )) : (
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-5 text-white/55">
                  {t("No order tickets yet.")}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-surface-luxe p-6 shadow-2xl">
            <h2 className="text-2xl font-bold">{t("Your Support Tickets")}</h2>
            <div className="mt-5 space-y-4">
              {tickets.length > 0 ? tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-[22px] border border-white/8 bg-black/20 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{ticket.subject}</p>
                        {ticket.hasUnreadAdminReply ? <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> : null}
                      </div>
                      <p className="mt-2 text-sm text-white/60">{ticket.message}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                      ticket.status === "resolved"
                        ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                        : "border border-amber-300/30 bg-amber-400/10 text-amber-200"
                    }`}>
                      {ticket.status}
                    </span>
                  </div>
                  {ticket.replies && ticket.replies.length > 0 && (
                    <div className="mt-4 space-y-3">
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
                            <span className="font-semibold">{reply.senderRole === "admin" ? t("Admin") : t("You")}</span>
                            <span className="text-[10px] uppercase tracking-[0.18em] opacity-60">{formatDate(reply.createdAt)}</span>
                          </div>
                          <p className="mt-2">{reply.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 space-y-3">
                    <textarea
                      placeholder={t("Reply to this ticket")}
                      value={replyDrafts[ticket.id] ?? ""}
                      onChange={(e) =>
                        setReplyDrafts((current) => ({
                          ...current,
                          [ticket.id]: e.target.value,
                        }))
                      }
                      className="h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition focus:border-red-400/50"
                    />
                    <button
                      onClick={() => replyToTicket(ticket.id)}
                      className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
                    >
                      {t("Send Reply")}
                    </button>
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/40">{formatDate(ticket.createdAt)}</p>
                </div>
              )) : (
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-5 text-white/55">
                  {t("No support tickets yet.")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
