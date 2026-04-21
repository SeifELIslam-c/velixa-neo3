import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ShoppingCart, LogIn, LogOut, Settings, UserCircle2, Menu, X } from "lucide-react";
import { useStore } from "../store";
import { authApi } from "@/lib/auth";
import { useEffect, useState } from "react";

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { cart, user } = useStore();
  const cartCount = cart.reduce((a, c) => a + c.quantity, 0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setMenuOpen(false);
  };

  const primaryLinks = [
    { to: "/", label: t("Home") },
    { to: "/cart", label: t("Track Order") },
    ...(user ? [{ to: "/account", label: t("Account") }] : [{ to: "/login", label: t("Login") }]),
    ...(user?.isAdmin ? [{ to: "/admin", label: t("Inventory") }] : []),
  ];

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-[300] px-3 pt-3 sm:px-5 sm:pt-4 lg:px-8 lg:pt-6">
      <div className="relative mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[26px] border border-white/10 bg-black/55 px-4 py-4 shadow-[0_24px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:px-6 sm:py-5 lg:gap-6 lg:rounded-[32px] lg:px-8 lg:py-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-transparent via-red-500 to-transparent sm:h-2" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.16),transparent_34%)]" />

        <Link to="/" className="relative z-10 text-[1.35rem] sm:text-[1.7rem] lg:text-[2.15rem] font-black text-white tracking-[-2px] uppercase leading-none">
          Velixa<span className="text-accent-luxe">.NEO</span>
        </Link>

        <div className="relative z-10 order-3 hidden w-full items-center justify-center gap-3 rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] uppercase tracking-[0.22em] sm:order-2 sm:flex sm:w-auto sm:justify-start sm:gap-4 sm:px-4 lg:gap-5">
          <button onClick={() => changeLanguage("en")} className={`${i18n.language === "en" ? "text-white font-bold" : "text-white/60 hover:text-white transition-colors"}`}>EN</button>
          <button onClick={() => changeLanguage("fr")} className={`${i18n.language === "fr" ? "text-white font-bold" : "text-white/60 hover:text-white transition-colors"}`}>FR</button>
          <button onClick={() => changeLanguage("ar")} className={`${i18n.language === "ar" ? "text-white font-bold" : "text-white/60 hover:text-white transition-colors"}`}>AR</button>
        </div>

        <div className="relative z-10 flex items-center gap-2 sm:order-3 sm:gap-3 lg:gap-4">
          <Link id="cart-icon-target" to="/cart" className="group relative flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-3 text-[11px] sm:px-4 sm:text-[12px] uppercase tracking-[0.16em] text-white/75 hover:text-white transition">
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden md:inline">{t("Track Order")}</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-luxe px-1 text-[10px] font-bold text-white shadow-[0_0_14px_#ef4444]">
                {cartCount}
              </span>
            )}
          </Link>

          {user?.isAdmin && (
            <Link to="/admin" className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-3 text-[11px] sm:px-4 sm:text-[12px] uppercase tracking-[0.16em] text-white/75 hover:text-white transition">
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden lg:inline">{t("Inventory")}</span>
            </Link>
          )}

          {user && (
            <Link to="/account" className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-3 text-[11px] sm:px-4 sm:text-[12px] uppercase tracking-[0.16em] text-white/75 hover:text-white transition">
              <UserCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden lg:inline">{t("Account")}</span>
            </Link>
          )}

          {user ? (
            <button
              onClick={() => authApi.signOut()}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-3 text-[11px] sm:px-4 sm:text-[12px] uppercase tracking-[0.16em] text-white/75 hover:text-white transition"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden lg:inline">{t("Logout")}</span>
            </button>
          ) : (
            <Link to="/login" className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-3 text-[11px] sm:px-4 sm:text-[12px] uppercase tracking-[0.16em] text-white/75 hover:text-white transition">
              <LogIn className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden md:inline">{t("Login")}</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 transition hover:text-white sm:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </nav>
    {menuOpen ? (
      <div className="fixed inset-0 z-[310] sm:hidden">
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />
        <div className="absolute right-3 top-3 bottom-3 w-[min(88vw,22rem)] overflow-hidden rounded-[30px] border border-white/10 bg-[#0b0b0c]/95 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-red-300">Velixa Neo</p>
              <p className="mt-2 text-xl font-black uppercase tracking-[-1px] text-white">{t("Menu")}</p>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {primaryLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white/80 transition hover:bg-white/[0.06]"
              >
                <span>{link.label}</span>
                <span className="text-white/35">/</span>
              </Link>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.26em] text-white/45">{t("Language")}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {["en", "fr", "ar"].map((lng) => (
                <button
                  key={lng}
                  type="button"
                  onClick={() => changeLanguage(lng)}
                  className={`rounded-full px-3 py-3 text-xs font-bold uppercase tracking-[0.2em] transition ${
                    i18n.language === lng
                      ? "bg-red-500 text-white"
                      : "border border-white/10 bg-black/20 text-white/65"
                  }`}
                >
                  {lng}
                </button>
              ))}
            </div>
          </div>

          {user ? (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                authApi.signOut();
              }}
              className="mt-6 flex w-full items-center justify-center rounded-full border border-red-400/25 bg-red-500/12 px-5 py-4 text-xs font-bold uppercase tracking-[0.22em] text-white"
            >
              {t("Logout")}
            </button>
          ) : null}
        </div>
      </div>
    ) : null}
    </>
  );
}
