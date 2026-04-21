"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, ShoppingCart, X, CreditCard, Sparkles } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { useStore } from "@/store";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function InteractiveCart() {
    const { cart, products, addToCart, removeFromCart, updateQuantity } = useStore();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );
    const recommendedProducts = products
        .filter((product) => product.id === "1" || product.id === "2" || product.model3d)
        .slice(0, 2);

    return (
        <div className="w-full max-w-4xl mx-auto py-32 px-6">
            <h1 className="text-4xl font-bold mb-8">{t('Cart')}</h1>

            {cart.length === 0 ? (
                <div className="text-center py-20 bg-surface-luxe rounded-[20px] border border-border-luxe">
                    <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-white/20" />
                    <h2 className="text-xl font-bold text-white mb-2">{t('Cart is empty')}</h2>
                    <p className="text-white/40 mb-6">{t("Looks like you haven't added anything yet.")}</p>
                    <Link to="/">
                        <Button className="rounded-full">{t('Continue Shopping')}</Button>
                    </Link>
                </div>
            ) : (
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                        <AnimatePresence initial={false} mode="popLayout">
                            {cart.map((item) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.96 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    transition={{
                                        opacity: { duration: 0.2 },
                                        layout: { duration: 0.2 },
                                    }}
                                    className="flex items-center gap-4 p-4 rounded-[20px] bg-surface-luxe border border-border-luxe"
                                >
                                    <div className="w-20 h-20 bg-black rounded-xl overflow-hidden flex items-center justify-center p-2">
                                        <img src={item.image} alt={item.name} className="w-full h-full object-contain filter drop-shadow-md" />
                                    </div>
                                    <div className="flex-1 flex flex-col justify-between ml-2">
                                        <div>
                                            <div className="flex items-start justify-between">
                                                <span className="text-base sm:text-lg font-bold text-white leading-tight">
                                                    {item.name}
                                                </span>
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="p-1 sm:p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white shrink-0 ml-2 mt-[-4px]"
                                                >
                                                    <X className="w-4 h-4" />
                                                </motion.button>
                                            </div>
                                            <p className="text-[10px] sm:text-xs text-white/40 uppercase tracking-widest mt-1">{item.category}</p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-3 gap-3">
                                            <div className="flex items-center gap-2 bg-black rounded-lg border border-white/10 p-1 w-max">
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => updateQuantity(item.id, -1)}
                                                    className="p-1 rounded-md hover:bg-white/10"
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </motion.button>
                                                <motion.span
                                                    layout
                                                    className="text-sm font-bold text-white w-6 text-center"
                                                >
                                                    {item.quantity}
                                                </motion.span>
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => updateQuantity(item.id, 1)}
                                                    className="p-1 rounded-md hover:bg-white/10"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </motion.button>
                                            </div>
                                            <motion.span
                                                layout
                                                className="font-bold text-accent-luxe"
                                            >
                                                {(item.price * item.quantity).toLocaleString()} DZD
                                            </motion.span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {recommendedProducts.length > 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 18 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-5 md:p-6"
                            >
                                <div className="mb-4 flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8">
                                        <Sparkles className="h-4 w-4 text-white/80" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{t("You can also add")}</h3>
                                        <p className="text-sm text-white/50">{t("Pick one more product directly from your cart.")}</p>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    {recommendedProducts.map((product) => (
                                        <div
                                            key={product.id}
                                            className="rounded-[20px] border border-white/8 bg-black/25 p-3"
                                        >
                                            <div className="mb-3 flex items-center gap-3">
                                                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/8 bg-black/40 p-2">
                                                    <img
                                                        src={product.image}
                                                        alt={product.name}
                                                        className="h-full w-full object-contain"
                                                        loading="lazy"
                                                        decoding="async"
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="line-clamp-2 text-sm font-bold text-white">{product.name}</h4>
                                                    <p className="mt-1 text-xs text-white/45">{t("Ready to add from here.")}</p>
                                                    <p className="mt-2 text-base font-bold text-white">{product.price.toLocaleString()} DZD</p>
                                                </div>
                                            </div>

                                            <Button
                                                onClick={() => addToCart(product)}
                                                disabled={product.stock === 0}
                                                className="w-full rounded-full bg-white text-black hover:bg-white/90"
                                            >
                                                <ShoppingCart className="mr-2 h-4 w-4" />
                                                {t("Add to Cart")}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ) : null}
                    </div>

                    <div className="w-full md:w-80 shrink-0">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-6 rounded-[20px] bg-surface-luxe border border-border-luxe md:sticky top-32"
                        >
                            <h2 className="text-xl font-bold mb-6">{t('Order Summary')}</h2>
                            <div className="space-y-4 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/60">{t('Items')} ({totalItems})</span>
                                    <span className="font-bold">{totalPrice.toLocaleString()} DZD</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/60">{t('Shipping')}</span>
                                    <span className="font-bold text-accent-luxe">{t('Calculated at Checkout')}</span>
                                </div>
                                <div className="border-t border-white/10 pt-4 flex justify-between">
                                    <span className="text-base font-bold">{t('Total')}</span>
                                    <span className="text-xl font-bold text-white">
                                        <NumberFlow value={totalPrice} /> <span className="text-sm">DZD</span>
                                    </span>
                                </div>
                            </div>
                            <Button 
                                onClick={() => navigate('/checkout')}
                                className="w-full rounded-full bg-white text-black hover:bg-white/90 font-bold py-6 text-base shadow-[0_4px_0_#ccc] active:translate-y-[2px] active:shadow-none transition-all"
                            >
                                <CreditCard className="w-5 h-5 mr-2" />
                                {t('Go to Checkout')}
                            </Button>
                        </motion.div>
                    </div>
                </div>
            )}
        </div>
    );
}
