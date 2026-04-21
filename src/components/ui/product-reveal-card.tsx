import { motion, useReducedMotion, Variants } from "framer-motion"
import { ShoppingCart } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import type { MouseEvent as ReactMouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

interface ProductRevealCardProps {
  name: string
  price: number
  originalPrice?: string
  image: string
  stock: number
  onAdd?: (event: React.MouseEvent<HTMLButtonElement>) => void
  enableAnimations?: boolean
  className?: string
}

export function ProductRevealCard({
  name,
  price,
  originalPrice,
  image,
  stock,
  onAdd,
  enableAnimations = true,
  className,
}: ProductRevealCardProps) {
  const { t } = useTranslation()
  const [isRevealed, setIsRevealed] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hoverQuery = window.matchMedia("(hover: none)")
    const pointerQuery = window.matchMedia("(pointer: coarse)")

    const updateTouchMode = () => {
      setIsTouchDevice(hoverQuery.matches || pointerQuery.matches)
    }

    updateTouchMode()
    hoverQuery.addEventListener("change", updateTouchMode)
    pointerQuery.addEventListener("change", updateTouchMode)

    return () => {
      hoverQuery.removeEventListener("change", updateTouchMode)
      pointerQuery.removeEventListener("change", updateTouchMode)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!cardRef.current) return
      if (!cardRef.current.contains(e.target as Node)) {
        setIsRevealed(false)
      }
    }

    if (isTouchDevice && isRevealed) {
      document.addEventListener("click", handleClickOutside)
    }

    return () => {
      document.removeEventListener("click", handleClickOutside)
    }
  }, [isTouchDevice, isRevealed])

  const shouldReduceMotion = useReducedMotion()
  const shouldAnimate = enableAnimations && !shouldReduceMotion

  const handleAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onAdd?.(e)
  }

  const optimizedImage = (() => {
    if (image.includes("ik.imagekit.io")) {
      return image.includes("?") ? `${image}&tr=q-100,f-auto` : `${image}?tr=q-100,f-auto`
    }

    if (image.includes("images.unsplash.com")) {
      return image.includes("?")
        ? `${image}&w=1600&q=100&auto=format&fit=max`
        : `${image}?w=1600&q=100&auto=format&fit=max`
    }

    return image
  })()

  const handleCardClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!isTouchDevice) return

    const target = e.target as HTMLElement
    if (target.closest("button, a, input, select, textarea, label")) {
      return
    }

    setIsRevealed((prev) => !prev)
  }

  const containerVariants: Variants = {
    rest: { scale: 1, y: 0 },
    hover: shouldAnimate
      ? {
          scale: 1.012,
          y: -4,
          transition: { type: "spring", stiffness: 260, damping: 25 },
        }
      : {},
  }

  const imageVariants: Variants = {
    rest: { scale: 1 },
    hover: shouldAnimate
      ? {
          scale: 1.018,
          transition: { duration: 0.28, ease: "easeOut" },
        }
      : {},
  }

  const overlayVariants: Variants = {
    rest: {
      y: "100%",
      opacity: 0,
    },
    hover: {
      y: "0%",
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 320,
        damping: 30,
        staggerChildren: 0.08,
        delayChildren: 0.05,
      },
    },
  }

  const contentVariants: Variants = {
    rest: { opacity: 0, y: 15 },
    hover: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25 },
    },
  }

  return (
    <motion.div
      ref={cardRef}
      initial="rest"
      animate={isRevealed ? "hover" : "rest"}
      whileInView={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: false, amount: 0.2 }}
      onHoverStart={() => {
        if (!isTouchDevice) setIsRevealed(true)
      }}
      onHoverEnd={() => {
        if (!isTouchDevice) setIsRevealed(false)
      }}
      onClick={handleCardClick}
      variants={containerVariants}
      className={cn(
        "relative w-full min-w-0 rounded-[20px] border border-border-luxe bg-surface-luxe text-white overflow-hidden shadow-lg cursor-pointer group",
        className
      )}
      style={{ opacity: 1 }}
    >
      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,#060606_0%,#0d0d0d_52%,#080808_100%)] px-3 pb-3 pt-4">
        {isTouchDevice ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex justify-center md:hidden">
            <div className="max-w-[calc(100%-1rem)] rounded-full border border-white/10 bg-black/65 px-3 py-1.5 text-center text-[9px] font-semibold leading-relaxed tracking-[0.12em] text-white/85 backdrop-blur">
              {t("Tap product image to open")}
            </div>
          </div>
        ) : null}
        <div className="relative flex h-[18.5rem] items-center justify-center overflow-hidden rounded-[1.4rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-2 md:h-[19.5rem] md:p-3">
          <div className="pointer-events-none absolute inset-x-10 top-5 h-8 rounded-full bg-white/5 blur-lg" />
          <motion.img
            src={optimizedImage}
            alt={name}
            className="relative z-10 h-full w-full object-contain [image-rendering:auto] drop-shadow-[0_16px_24px_rgba(0,0,0,0.26)]"
            variants={imageVariants}
            loading="lazy"
            decoding="async"
            draggable={false}
            style={{
              backfaceVisibility: "hidden",
              willChange: "transform",
            }}
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/24 via-transparent to-transparent" />

        {originalPrice && (
          <div className="absolute left-3 top-3 z-20 max-w-[calc(100%-1.5rem)] rounded-full bg-red-500 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(239,68,68,0.3)]">
            {t("Sale")}
          </div>
        )}

        {stock === 0 && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-10">
            <span className="text-white font-bold text-xl uppercase tracking-widest">
              {t("Out of Stock")}
            </span>
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col border-t border-white/10">
        <h3 className="mb-2 text-lg font-bold leading-snug text-white sm:text-xl">{name}</h3>

        <div className="mt-auto flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className="text-2xl font-bold leading-none text-accent-luxe">
            {price.toLocaleString()}
          </span>
          <span className="text-xs font-bold text-accent-luxe">DZD</span>

          {originalPrice && (
            <span className="text-[10px] font-bold text-white/40 line-through sm:ml-2">
              {originalPrice} DZD
            </span>
          )}
        </div>
      </div>

      <motion.div
        variants={overlayVariants}
        className={cn(
          "absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md flex flex-col justify-end z-30",
          isRevealed || !isTouchDevice ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div className="p-6 space-y-4">
          <motion.div variants={contentVariants}>
            <h4 className="mb-1 text-lg font-bold leading-snug">{name}</h4>
            <p className="text-xs leading-relaxed text-white/60">
              {t("Premium audio experience with ultimate comfort.")}
            </p>
          </motion.div>

          <motion.div
            variants={contentVariants}
            className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider font-bold"
          >
            <div className="bg-white/5 rounded-lg p-2 text-center border border-white/10">
              {t("Stock")}: {stock}
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center border border-white/10">
              {t("High Quality")}
            </div>
          </motion.div>

          <motion.div variants={contentVariants}>
            <button
              onClick={handleAdd}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={stock === 0}
              className="w-full h-12 flex items-center justify-center gap-2 bg-[#FAFAFA] text-black font-bold uppercase text-[11px] tracking-widest rounded-lg hover:bg-white active:scale-[0.98] transition-all duration-300 disabled:opacity-50 shadow-[0_10px_25px_rgba(255,255,255,0.08)]"
            >
              <ShoppingCart className="w-4 h-4" />
              {t("Add to Cart")}
            </button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}
