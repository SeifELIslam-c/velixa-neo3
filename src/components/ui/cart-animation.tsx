'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { Product, useStore } from '@/store';

export interface AddToCartEvent {
  product: Product;
  startRect: DOMRect;
}

type ActiveFlight = AddToCartEvent & { id: number };

export function AddToCartAnimation() {
  const [events, setEvents] = useState<ActiveFlight[]>([]);
  const { addToCart } = useStore();

  useEffect(() => {
    const handleAddToCart = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<AddToCartEvent>;
      const newEvent = {
        ...event.detail,
        id: Date.now() + Math.floor(Math.random() * 1000),
      };

      setEvents((prev) => [...prev, newEvent]);

      window.setTimeout(() => {
        addToCart(event.detail.product);
      }, 520);

      window.setTimeout(() => {
        setEvents((prev) => prev.filter((entry) => entry.id !== newEvent.id));
      }, 900);
    };

    window.addEventListener('triggerAddToCartAnimation', handleAddToCart);
    return () => window.removeEventListener('triggerAddToCartAnimation', handleAddToCart);
  }, [addToCart]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      <AnimatePresence>
        {events.map((event) => {
          const cartElement = document.getElementById('cart-icon-target');
          const cartRect = cartElement?.getBoundingClientRect() || {
            top: 28,
            right: 28,
            bottom: 68,
            left: window.innerWidth - 68,
            width: 40,
            height: 40,
            x: window.innerWidth - 68,
            y: 28,
            toJSON: () => ({}),
          };

          const startX = event.startRect.left + event.startRect.width / 2;
          const startY = event.startRect.top + event.startRect.height / 2;
          const endX = cartRect.left + cartRect.width / 2;
          const endY = cartRect.top + cartRect.height / 2;
          const deltaX = endX - startX;
          const deltaY = endY - startY;
          const isMobile = window.innerWidth < 768;
          const arcLift = isMobile ? 18 : 26;

          return (
            <motion.div
              key={event.id}
              initial={{
                x: startX,
                y: startY,
                scale: 0.92,
                opacity: 0,
              }}
              animate={{
                x: [
                  startX,
                  startX + deltaX * 0.5,
                  endX,
                ],
                y: [
                  startY,
                  startY + deltaY * 0.5 - arcLift,
                  endY,
                ],
                scale: [0.96, 0.84, 0.42],
                opacity: [1, 1, 0.98],
              }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={{
                duration: isMobile ? 0.68 : 0.76,
                ease: [0.2, 0.8, 0.2, 1],
                times: [0, 0.55, 1],
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 will-change-transform"
            >
              <motion.div
                initial={{ opacity: 0.18, scale: 0.9 }}
                animate={{ opacity: [0.18, 0.24, 0], scale: [0.9, 1.08, 1.14] }}
                transition={{ duration: isMobile ? 0.62 : 0.7, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full bg-red-500/20 blur-xl"
              />

              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-black/85 shadow-[0_10px_30px_rgba(0,0,0,0.35)] sm:h-18 sm:w-18">
                <img
                  src={event.product.image}
                  alt={event.product.name}
                  className="h-full w-full object-cover"
                  loading="eager"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/10" />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
