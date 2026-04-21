import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Navbar } from "./Navbar";
import { useStore } from "../store";
import { apiFetch } from "../lib/api";
import { TicketConfirmationCard } from "./ui/ticket-confirmation-card";

interface WilayaOption {
  id: number;
  name: string;
}

interface CommuneOption {
  nom: string;
  has_stop_desk: number;
}

const GUELMA_HOME_ONLY_COMMUNES = new Set(["Guelma", "Oued Zenati"]);

export function CheckoutPage() {
  const { cart, clearCart, user } = useStore();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState({ 
    name: '', 
    phone: '', 
    wilaya_id: '', 
    commune: '', 
    is_stopdesk: false,
    address: '' 
  });
  
  const [ordered, setOrdered] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<{
    id: string;
    total: number;
    createdAt: string;
    customer: { name: string; phone: string };
    shipping: { is_stopdesk: boolean; commune: string; wilaya_id: number; address: string };
  } | null>(null);
  const [wilayas, setWilayas] = useState<WilayaOption[]>([]);
  const [communes, setCommunes] = useState<CommuneOption[]>([]);
  const [loadingCommunes, setLoadingCommunes] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [fees, setFees] = useState<Array<{ wilaya_id: string; tarif: string; tarif_stopdesk: string }> | null>(null);
  const [shippingCost, setShippingCost] = useState(0);
  const [ecotrackError, setEcotrackError] = useState<string | null>(null);

  const subTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const selectedWilaya = wilayas.find((wilaya) => String(wilaya.id) === form.wilaya_id);
  const isGuelmaHomeOnly =
    selectedWilaya?.name?.trim().toLowerCase() === "guelma" &&
    GUELMA_HOME_ONLY_COMMUNES.has(form.commune);

  useEffect(() => {
    if (!user) return;

    setForm((current) => ({
      ...current,
      name: current.name || user.fullName || user.name || '',
      phone: current.phone || user.phone || '',
    }));
  }, [user]);

  useEffect(() => {
    setEcotrackError(null);
    apiFetch<{ wilayas: WilayaOption[] }>('/ecotrack/wilayas')
      .then((data) => setWilayas(Array.isArray(data.wilayas) ? data.wilayas : []))
      .catch((err) => {
        setWilayas([]);
        setEcotrackError(err instanceof Error ? err.message : 'Unable to load Ecotrack wilayas');
      });

    apiFetch<any>('/ecotrack/fees').then(data => {
      if (data && data.livraison) {
         setFees(data.livraison);
      }
    }).catch((err) => {
      setFees(null);
      setEcotrackError(err instanceof Error ? err.message : 'Unable to load Ecotrack fees');
    });
  }, []);

  useEffect(() => {
    if (form.wilaya_id) {
       setLoadingCommunes(true);
       setEcotrackError(null);
       apiFetch<{ communes: CommuneOption[] }>(`/ecotrack/communes?wilaya_id=${parseInt(form.wilaya_id)}`).then(({ communes: data }) => {
         const sorted = Array.isArray(data) ? [...data].sort((a,b) => a.nom.localeCompare(b.nom)) : [];
         setCommunes(sorted);
         
         if (selectedWilaya?.name?.trim().toLowerCase() === "guelma" && GUELMA_HOME_ONLY_COMMUNES.has(form.commune)) {
            setShippingCost(0);
         } else if (fees) {
            const feeInfo = fees.find((f: any) => parseInt(f.wilaya_id) === parseInt(form.wilaya_id));
            if (feeInfo) {
              setShippingCost(form.is_stopdesk ? parseInt(feeInfo.tarif_stopdesk) : parseInt(feeInfo.tarif));
            } else {
              setShippingCost(0);
            }
         } else {
            setShippingCost(0);
         }
       }).catch((err) => {
          setCommunes([]);
          setForm((current) => ({ ...current, commune: '' }));
          setShippingCost(0);
          setEcotrackError(err instanceof Error ? err.message : 'Unable to load Ecotrack communes');
       }).finally(() => {
          setLoadingCommunes(false);
       });
    } else {
       setCommunes([]);
       setShippingCost(0);
    }
  }, [form.wilaya_id, form.is_stopdesk, form.commune, fees, selectedWilaya?.name]);

  useEffect(() => {
    if (!isGuelmaHomeOnly) return;
    if (!form.is_stopdesk) return;

    setForm((current) => ({
      ...current,
      is_stopdesk: false,
    }));
  }, [form.is_stopdesk, isGuelmaHomeOnly]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingOrder) return;

    try {
      setIsSubmittingOrder(true);
      const response = await apiFetch<{
        order: {
          id: string;
          total: number;
          createdAt: string;
          customer: { name: string; phone: string };
          shipping: { is_stopdesk: boolean; commune: string; wilaya_id: number; address: string };
        };
      }>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          userId: user?.uid ?? null,
          customer: {
            name: form.name,
            phone: form.phone,
          },
          shipping: {
            wilaya_id: Number(form.wilaya_id),
            commune: form.commune,
            is_stopdesk: form.is_stopdesk,
            address: form.address,
            cost: shippingCost,
          },
          items: cart,
        }),
      });

      setCreatedOrder(response.order);
      setOrdered(true);
      clearCart();
      
      setTimeout(() => {
        navigate("/");
      }, 5500);
    } catch(err) {
      alert(err instanceof Error ? err.message : "Error placing order");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="bg-bg-luxe min-h-screen text-white pt-28 pb-12 px-6 font-sans">
      <Navbar />

      {ordered && createdOrder && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm animate-in fade-in-0 duration-500">
          <TicketConfirmationCard
            orderId={createdOrder.id}
            amount={createdOrder.total}
            createdAt={new Date(createdOrder.createdAt)}
            customerName={createdOrder.customer.name}
            phone={createdOrder.customer.phone}
            deliveryLabel={createdOrder.shipping.is_stopdesk ? "Stopdesk Pickup" : "Home Delivery"}
            locationLabel={
              createdOrder.shipping.is_stopdesk
                ? `${createdOrder.shipping.commune} • Wilaya ${createdOrder.shipping.wilaya_id}`
                : createdOrder.shipping.address
            }
            barcodeValue={createdOrder.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18)}
          />
        </div>
      )}
      
      <div className="max-w-5xl mx-auto grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div className="order-2 space-y-6 lg:order-1">
          <h2 className="text-[2.5rem] font-[800] leading-none uppercase tracking-[-1px]">
            {t('Checkout')}
          </h2>
          
          {cart.length === 0 && !ordered && (
            <p className="text-white/60">{t('Your cart is empty.')}</p>
          )}

          <div className="space-y-4">
            {cart.map(item => (
              <div key={item.id} className="flex gap-4 p-4 border border-border-luxe rounded-[20px] bg-surface-luxe">
                <img src={item.image} alt={item.name} className="w-20 h-20 bg-black object-contain rounded-[15px] p-2" />
                <div className="flex-1 flex flex-col justify-center">
                  <h4 className="font-bold text-base">{item.name}</h4>
                  <p className="text-white/60 text-xs">{t('Qty')}: {item.quantity}</p>
                </div>
                <div className="flex flex-col items-end justify-center">
                  <p className="text-accent-luxe font-bold text-lg">{t('Price', { val: (item.price * item.quantity).toLocaleString() })}</p>
                </div>
              </div>
            ))}
          </div>
          
          {cart.length > 0 && (
            <div className="p-6 border-t-2 border-border-luxe mt-8 bg-surface-luxe rounded-[20px]">
              <div className="flex justify-between items-center mb-4">
                 <span className="text-sm uppercase tracking-[1px] text-white/60 font-bold">{t('Subtotal')}</span>
                 <span className="text-xl font-bold">{subTotal.toLocaleString()} DZD</span>
              </div>
              <div className="flex justify-between items-center mb-6">
                 <span className="text-sm uppercase tracking-[1px] text-white/60 font-bold">{t('Shipping Fees')}</span>
                 <span className="text-xl font-bold text-accent-luxe">
                   {form.commune && shippingCost === 0 ? t('Free Delivery') : shippingCost === 0 ? t('Calculated next step') : `${shippingCost.toLocaleString()} DZD`}
                 </span>
              </div>
              
              <div className="flex justify-between items-center pt-6 border-t border-border-luxe">
                <span className="text-sm uppercase tracking-[2px] text-white font-bold">{t('Total')}</span>
                <span className="text-3xl font-black">{(subTotal + shippingCost).toLocaleString()} DZD</span>
              </div>
            </div>
          )}
        </div>

        <div className="order-1 lg:order-2">
          <div className="bg-surface-luxe border border-border-luxe p-8 rounded-[30px] shadow-2xl relative overflow-hidden">
            <h2 className="text-2xl font-[800] uppercase tracking-[-1px] mb-8">{t('Shipping Info')}</h2>
            
            <div className="mb-8 p-4 border border-accent-luxe/30 bg-accent-luxe/10 text-accent-luxe rounded-[15px] flex items-center gap-3">
              <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <p className="text-sm font-bold uppercase tracking-[1px]">
                {t('Cash on Delivery Exact')}
              </p>
            </div>

            {ecotrackError && (
              <div className="mb-6 rounded-[15px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {ecotrackError}
              </div>
            )}

            <form onSubmit={handleCheckout} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs uppercase tracking-[1px] font-bold text-white/60 mb-2">{t('Full Name')}</label>
                  <input 
                    required
                    type="text" 
                    placeholder="John Doe"
                    className="w-full bg-bg-luxe border border-border-luxe rounded-[10px] px-4 py-4 text-white font-medium focus:outline-none focus:border-accent-luxe transition"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs uppercase tracking-[1px] font-bold text-white/60 mb-2">{t('Phone')}</label>
                  <input 
                    required
                    type="tel" 
                    placeholder="05XX XX XX XX"
                    className="w-full bg-bg-luxe border border-border-luxe rounded-[10px] px-4 py-4 text-white font-medium focus:outline-none focus:border-accent-luxe transition"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs uppercase tracking-[1px] font-bold text-white/60 mb-2">{t('Wilaya')}</label>
                  <select 
                    required
                    className="w-full bg-bg-luxe border border-border-luxe rounded-[10px] px-4 py-4 text-white font-medium focus:outline-none focus:border-accent-luxe transition appearance-none"
                    value={form.wilaya_id}
                    onChange={(e) => {
                      setForm({ ...form, wilaya_id: e.target.value, commune: '' });
                    }}
                  >
                    <option value="" disabled>{t('Select Wilaya...')}</option>
                    {wilayas.map((wilaya) => (
                      <option key={wilaya.id} value={wilaya.id}>{wilaya.id} - {wilaya.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs uppercase tracking-[1px] font-bold text-white/60 mb-2">
                    {t('Commune')} {loadingCommunes && <span className="animate-pulse text-accent-luxe capitalize text-[9px] ml-2">{t('Loading...')}</span>}
                  </label>
                  <select 
                    required
                    disabled={!form.wilaya_id || loadingCommunes || communes.length === 0}
                    className="w-full bg-bg-luxe border border-border-luxe rounded-[10px] px-4 py-4 text-white font-medium focus:outline-none focus:border-accent-luxe transition appearance-none disabled:opacity-50"
                    value={form.commune}
                    onChange={(e) => setForm({ ...form, commune: e.target.value })}
                  >
                    <option value="" disabled>{t('Select Commune...')}</option>
                    {communes.map((c, idx) => (
                      <option key={idx} value={c.nom}>{c.nom}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.commune && (
                <div className="p-4 border border-white/10 rounded-[15px] bg-bg-luxe space-y-3">
                   <p className="text-xs uppercase tracking-[1px] font-bold text-white/60 mb-2">{t('Delivery Method')}</p>
                   {!isGuelmaHomeOnly && (
                     <label className="flex items-center cursor-pointer group">
                        <div className="relative w-5 h-5 flex items-center justify-center border-2 border-white/20 rounded-full group-hover:border-accent-luxe transition">
                           {form.is_stopdesk && <div className="w-2.5 h-2.5 bg-accent-luxe rounded-full"></div>}
                        </div>
                        <input type="radio" className="hidden"
                          checked={form.is_stopdesk}
                          onChange={() => setForm({...form, is_stopdesk: true})}
                        />
                        <span className="ml-3 font-medium">{t('Stopdesk (Self-pickup)')}</span>
                        {communes.find((c:any) => c.nom === form.commune)?.has_stop_desk === 0 && (
                          <span className="ml-2 text-[10px] text-red-500 bg-red-500/10 px-2 py-1 rounded-full font-bold uppercase tracking-wider">{t('Not Available here')}</span>
                        )}
                     </label>
                   )}

                   <label className="flex items-center cursor-pointer group">
                      <div className="relative w-5 h-5 flex items-center justify-center border-2 border-white/20 rounded-full group-hover:border-accent-luxe transition">
                         {!form.is_stopdesk && <div className="w-2.5 h-2.5 bg-accent-luxe rounded-full"></div>}
                      </div>
                      <input type="radio" className="hidden" 
                        checked={!form.is_stopdesk} 
                        onChange={() => setForm({...form, is_stopdesk: false})} 
                      />
                      <span className="ml-3 font-medium">{t('Home Delivery')}</span>
                   </label>

                   {isGuelmaHomeOnly && (
                     <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                       {t('Guelma Delivery Rule')}
                     </div>
                   )}
                </div>
              )}

              {form.is_stopdesk && communes.find((c:any) => c.nom === form.commune)?.has_stop_desk === 0 && (
                <div className="text-red-500 text-xs font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                  {t('Stopdesk is not available in {{commune}}. Please select Home Delivery or another commune.', { commune: form.commune })}
                </div>
              )}

              {!form.is_stopdesk && (
                <div className="transition-all">
                  <label className="block text-xs uppercase tracking-[1px] font-bold text-white/60 mb-2">{t('Exact Delivery Address')}</label>
                  <textarea 
                    required={!form.is_stopdesk}
                    placeholder={t('Street name, building, apartment...')}
                    className="w-full bg-bg-luxe border border-border-luxe rounded-[10px] px-4 py-4 text-white font-medium focus:outline-none focus:border-accent-luxe transition h-24 resize-none"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              )}

              <button 
                type="submit" 
                disabled={
                  isSubmittingOrder ||
                  cart.length === 0 ||
                  !fees ||
                  wilayas.length === 0 ||
                  (form.is_stopdesk && communes.find((c:any) => c.nom === form.commune)?.has_stop_desk === 0)
                }
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-[15px] bg-gradient-to-b from-accent-luxe to-red-600 py-[1.2rem] font-bold uppercase tracking-tight text-white shadow-[0_4px_0_#991b1b,0_10px_20px_rgba(239,68,68,0.3)] transition-all hover:brightness-110 active:translate-y-[2px] active:shadow-[0_2px_0_#991b1b,0_5px_10px_rgba(239,68,68,0.3)] disabled:opacity-50 disabled:active:translate-y-0 disabled:shadow-none"
              >
                {isSubmittingOrder ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>Sending order...</span>
                  </>
                ) : (
                  t('Place Order')
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
