'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Variants, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Battery,
  ChevronLeft,
  ChevronRight,
  Gem,
  ShieldCheck,
  Sparkles,
  Volume2,
  LucideIcon,
  GalleryHorizontalEnd,
  Circle,
} from 'lucide-react';

import { PixelImage } from '@/components/ui/pixel-image';

export type ProductId = 'left' | 'right';

export interface FeatureMetric {
  label: string;
  value: number;
  icon: LucideIcon;
}

export interface ProductData {
  id: ProductId;
  label: string;
  title: string;
  description: string;
  image: string;
  gallery: string[];
  colors: {
    gradient: string;
    glow: string;
    ring: string;
    bar: string;
  };
  stats: {
    connectionStatus: string;
    batteryLevel: number;
  };
  features: FeatureMetric[];
}

const PRODUCT_DATA: Record<ProductId, ProductData> = {
  left: {
    id: 'left',
    label: 'PRO 2.2',
    title: 'BLT Airpods PRO 2.2',
    description: 'showcase.left.description',
    image: 'https://ik.imagekit.io/sanqe8dszx/Velixa.neo/velixaBLT.png?updatedAt=1776727201454',
    gallery: [
      'https://ik.imagekit.io/sanqe8dszx/Velixa.neo/BLT1.png',
      'https://ik.imagekit.io/sanqe8dszx/Velixa.neo/BLT2.png',
      'https://ik.imagekit.io/sanqe8dszx/Velixa.neo/BLT3.png',
    ],
    colors: {
      gradient: 'from-red-600 to-red-950',
      glow: 'bg-red-500',
      ring: 'border-l-red-500/50',
      bar: 'bg-gradient-to-r from-red-500 via-red-400 to-red-200',
    },
    stats: { connectionStatus: 'showcase.left.status', batteryLevel: 92 },
    features: [
      { label: 'showcase.left.feature.finish', value: 96, icon: Gem },
      { label: 'showcase.left.feature.audio', value: 94, icon: Volume2 },
      { label: 'showcase.left.feature.durability', value: 91, icon: ShieldCheck },
    ],
  },
  right: {
    id: 'right',
    label: 'VRAK',
    title: 'Airpods Pro VRAK',
    description: 'showcase.right.description',
    image: 'https://ik.imagekit.io/kqmrslzuq/SOUND/right-earbud.png',
    gallery: [
      'https://ik.imagekit.io/sanqe8dszx/Velixa.neo/VRAK1.png',
      'https://ik.imagekit.io/sanqe8dszx/Velixa.neo/VRAK2.png',
      'https://ik.imagekit.io/sanqe8dszx/Velixa.neo/VRAK3.png?updatedAt=1776753959868',
    ],
    colors: {
      gradient: 'from-neutral-300 to-neutral-900',
      glow: 'bg-white',
      ring: 'border-r-white/50',
      bar: 'bg-gradient-to-r from-zinc-200 via-zinc-100 to-white',
    },
    stats: { connectionStatus: 'showcase.right.status', batteryLevel: 81 },
    features: [
      { label: 'showcase.right.feature.comfort', value: 84, icon: Sparkles },
      { label: 'showcase.right.feature.listening', value: 78, icon: Volume2 },
      { label: 'showcase.right.feature.value', value: 75, icon: ShieldCheck },
    ],
  },
};

const ANIMATIONS = {
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2 },
    },
  },
  item: {
    hidden: { opacity: 0, y: 20, filter: 'blur(10px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { type: 'spring' as const, stiffness: 100, damping: 20 },
    },
    exit: { opacity: 0, y: -10, filter: 'blur(5px)' },
  },
  image: (isLeft: boolean): Variants => ({
    initial: {
      opacity: 0,
      scale: 1.16,
      filter: 'blur(15px)',
      rotate: isLeft ? -10 : 10,
      x: isLeft ? -40 : 40,
    },
    animate: {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      rotate: 0,
      x: 0,
      transition: { type: 'spring', stiffness: 260, damping: 20 },
    },
    exit: {
      opacity: 0,
      scale: 0.86,
      filter: 'blur(10px)',
      transition: { duration: 0.25 },
    },
  }),
};

const BackgroundGradient = ({ isLeft }: { isLeft: boolean }) => {
  const shouldReduceMotion = useReducedMotion();

  return (
  <div className="absolute inset-0 pointer-events-none">
    <motion.div
      animate={
        shouldReduceMotion
          ? undefined
          : {
              background: isLeft
                ? 'radial-gradient(circle at 0% 50%, rgba(239,68,68,0.16), transparent 50%)'
                : 'radial-gradient(circle at 100% 50%, rgba(255,255,255,0.11), transparent 50%)',
            }
      }
      transition={shouldReduceMotion ? undefined : { duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0"
    />
  </div>
  );
};

const ProductVisual = ({ data, isLeft }: { data: ProductData; isLeft: boolean }) => {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div layout="position" className="relative group shrink-0">
      <motion.div
        animate={shouldReduceMotion ? undefined : { rotate: 360 }}
        transition={shouldReduceMotion ? undefined : { duration: 24, repeat: Infinity, ease: 'linear' }}
        className={`absolute inset-[-20%] rounded-full border border-dashed border-white/10 ${data.colors.ring}`}
      />
      <motion.div
        animate={shouldReduceMotion ? undefined : { scale: [1, 1.05, 1] }}
        transition={shouldReduceMotion ? undefined : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className={`absolute inset-0 rounded-full bg-gradient-to-br ${data.colors.gradient} blur-2xl opacity-40`}
      />

      <div className="relative h-80 w-80 md:h-[450px] md:w-[450px] rounded-full border border-white/5 shadow-2xl flex items-center justify-center overflow-hidden bg-black/20 backdrop-blur-sm">
        <motion.div
          animate={shouldReduceMotion ? undefined : { y: [-5, 5, -5] }}
          transition={shouldReduceMotion ? undefined : { repeat: Infinity, duration: 6, ease: 'easeInOut' }}
          className="relative z-10 w-full h-full flex items-center justify-center p-8"
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={data.id}
              src={data.image}
              alt={data.title}
              variants={ANIMATIONS.image(isLeft)}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full h-full object-cover rounded-full drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              draggable={false}
            />
          </AnimatePresence>
        </motion.div>
      </div>

      <motion.div layout="position" className="absolute -bottom-4 md:-bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-500 bg-zinc-950/80 px-4 py-2 rounded-full border border-white/5 backdrop-blur">
          <span className={`h-1.5 w-1.5 rounded-full ${data.colors.glow} animate-pulse`} />
        {t(data.stats.connectionStatus)}
        </div>
      </motion.div>
    </motion.div>
  );
};

interface ModelGalleryPopoverProps {
  data: ProductData;
  align: 'left' | 'right';
}

const ModelGalleryPopover = ({ data, align }: ModelGalleryPopoverProps) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);

  const currentImage = data.gallery[activeImageIndex];
  const shouldOpenLeft = i18n.language === 'ar' ? true : align !== 'left';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      if (!buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const width = window.innerWidth < 640 ? Math.min(window.innerWidth - 24, 352) : 416;
      const bottom = Math.max(16, window.innerHeight - rect.top + 16);
      const left = shouldOpenLeft
        ? Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width))
        : Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));

      setPopoverStyle({
        position: 'fixed',
        bottom,
        left,
        width,
        zIndex: 9999,
      });
    };

    const closeOnScroll = () => setIsOpen(false);

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', closeOnScroll, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [align, i18n.language, isOpen, shouldOpenLeft]);

  const goToPrevious = () => {
    setActiveImageIndex((current) => (current === 0 ? data.gallery.length - 1 : current - 1));
  };

  const goToNext = () => {
    setActiveImageIndex((current) => (current === data.gallery.length - 1 ? 0 : current + 1));
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="group flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300 hover:text-white transition-colors"
      >
        <GalleryHorizontalEnd size={14} />
        {t('View Model')}
        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </button>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {isOpen ? (
                <>
                  <motion.button
                    type="button"
                    aria-label={t('Close')}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsOpen(false)}
                    className="fixed inset-0 z-[9998] bg-black/30 backdrop-blur-[1px]"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.96 }}
                    transition={{ duration: 0.24 }}
                    style={popoverStyle}
                    className="overflow-hidden rounded-[2rem] border border-white/10 bg-[rgba(10,10,10,0.96)] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.26em] text-white/40">
                          {data.label} {t('Model')}
                        </p>
                        <h3 className="mt-2 text-lg font-bold text-white">{data.title}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/65 transition hover:bg-white/10 hover:text-white"
                      >
                        {t('Close')}
                      </button>
                    </div>

                    <div className="relative flex items-center justify-center rounded-[2rem] border border-white/8 bg-black/30 p-3">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${data.id}-${activeImageIndex}`}
                          initial={{ opacity: 0, x: 24 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -24 }}
                          transition={{ duration: 0.28 }}
                        >
                          <PixelImage src={currentImage} grid="6x4" grayscaleAnimation />
                        </motion.div>
                      </AnimatePresence>

                      <button
                        type="button"
                        onClick={goToPrevious}
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/60 p-2 text-white/80 transition hover:bg-black/80 hover:text-white"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={goToNext}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/60 p-2 text-white/80 transition hover:bg-black/80 hover:text-white"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-2">
                      {data.gallery.map((image, index) => (
                        <button
                          key={`${image}-${index}`}
                          type="button"
                          onClick={() => setActiveImageIndex(index)}
                          className="transition"
                        >
                          <Circle
                            size={10}
                            className={index === activeImageIndex ? 'fill-white text-white' : 'text-white/35'}
                          />
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.18em] text-white/55">
                      <span>{t('Slide through photos')}</span>
                      <span>{activeImageIndex + 1} / {data.gallery.length}</span>
                    </div>
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </>
  );
};

const ProductDetails = ({ data, isLeft }: { data: ProductData; isLeft: boolean }) => {
  const { t } = useTranslation();
  const alignClass = isLeft ? 'items-start text-left' : 'items-end text-right';
  const flexDirClass = isLeft ? 'flex-row' : 'flex-row-reverse';

  return (
    <motion.div
      variants={ANIMATIONS.container}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`flex flex-col ${alignClass}`}
    >
      <motion.h2 variants={ANIMATIONS.item} className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
        {data.label} {t('Model')}
      </motion.h2>
      <motion.h1 variants={ANIMATIONS.item} className="text-4xl md:text-5xl font-bold tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500">
        {data.title}
      </motion.h1>
      <motion.p variants={ANIMATIONS.item} className={`text-zinc-400 mb-8 max-w-sm leading-relaxed ${isLeft ? 'mr-auto' : 'ml-auto'}`}>
        {t(data.description)}
      </motion.p>

      <motion.div variants={ANIMATIONS.item} className="w-full space-y-6 bg-zinc-900/40 p-6 rounded-2xl border border-white/5 backdrop-blur-sm">
        {data.features.map((feature, idx) => (
          <div key={feature.label} className="group">
            <div className={`flex items-center justify-between mb-3 text-sm ${flexDirClass}`}>
              <div className="flex items-center gap-2 text-zinc-200">
                <feature.icon size={16} />
                <span>{t(feature.label)}</span>
              </div>
              <span className="font-mono text-xs text-zinc-500">{feature.value}%</span>
            </div>
            <div className="relative h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${feature.value}%` }}
                transition={{ duration: 1, delay: 0.35 + idx * 0.15 }}
                className={`absolute top-0 bottom-0 ${data.colors.bar}`}
              />
            </div>
          </div>
        ))}
        <div className={`pt-4 flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
          <ModelGalleryPopover data={data} align={isLeft ? 'left' : 'right'} />
        </div>
      </motion.div>

      <motion.div variants={ANIMATIONS.item} className={`mt-6 flex items-center gap-3 text-zinc-500 ${flexDirClass}`}>
        <Battery size={16} />
        <span className="text-sm font-medium">{data.stats.batteryLevel}% {t('Charge')}</span>
      </motion.div>
    </motion.div>
  );
};

const Switcher = ({
  activeId,
  onToggle,
}: {
  activeId: ProductId;
  onToggle: (id: ProductId) => void;
}) => {
  const options = Object.values(PRODUCT_DATA).map((product) => ({ id: product.id, label: product.label }));

  return (
    <div className="absolute top-12 md:bottom-12 md:top-auto inset-x-0 flex justify-center z-50 pointer-events-none">
      <motion.div layout className="pointer-events-auto flex items-center gap-1 p-1.5 rounded-full bg-zinc-900/80 backdrop-blur-2xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/5">
        {options.map((option) => (
          <motion.button
            key={option.id}
            onClick={() => onToggle(option.id)}
            whileTap={{ scale: 0.96 }}
            className="relative w-32 h-12 rounded-full flex items-center justify-center text-sm font-bold uppercase tracking-wider focus:outline-none"
          >
            {activeId === option.id ? (
              <motion.div
                layoutId="island-surface"
                className="absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-white/5 shadow-inner"
                transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              />
            ) : null}
            <span className={`relative z-10 transition-colors duration-300 ${activeId === option.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {option.label}
            </span>
            {activeId === option.id ? (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -bottom-1 h-1 w-6 rounded-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
              />
            ) : null}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
};

export default function SpatialProductShowcase() {
  const [activeSide, setActiveSide] = useState<ProductId>('left');
  const shouldReduceMotion = useReducedMotion();

  const currentData = useMemo(() => PRODUCT_DATA[activeSide], [activeSide]);
  const isLeft = activeSide === 'left';

  return (
    <section className="relative w-full pt-16 pb-10 md:pt-24 md:pb-20 bg-bg-luxe text-zinc-100 overflow-hidden flex flex-col items-center justify-center">
      <BackgroundGradient isLeft={isLeft} />
      <div className="relative z-10 w-full px-6 flex flex-col justify-center max-w-7xl mx-auto min-h-[520px] md:min-h-[600px] mt-12 md:mt-0">
        <motion.div
          layout
          transition={shouldReduceMotion ? { duration: 0.2 } : { type: 'spring', bounce: 0, duration: 0.9 }}
          className={`flex flex-col md:flex-row items-center justify-center gap-12 md:gap-24 lg:gap-32 w-full pb-8 md:pb-16 ${
            isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
          }`}
        >
          <ProductVisual data={currentData} isLeft={isLeft} />
          <motion.div layout="position" className="w-full max-w-md shrink-0">
            <AnimatePresence mode="wait">
              <ProductDetails key={activeSide} data={currentData} isLeft={isLeft} />
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
      <Switcher activeId={activeSide} onToggle={setActiveSide} />
    </section>
  );
}
