import * as React from "react";
import { CheckCircle2, PackageCheck, Store } from "lucide-react";

import { cn } from "@/lib/utils";

const DashedLine = () => (
  <div className="w-full border-t-2 border-dashed border-white/10" aria-hidden="true" />
);

const Barcode = ({ value }: { value: string }) => {
  const hashCode = (input: string) =>
    input.split("").reduce((acc, char) => {
      acc = (acc << 5) - acc + char.charCodeAt(0);
      return acc & acc;
    }, 0);

  const seed = hashCode(value);
  const random = (source: number) => {
    const x = Math.sin(source) * 10000;
    return x - Math.floor(x);
  };

  const bars = Array.from({ length: 60 }).map((_, index) => {
    const rand = random(seed + index);
    const width = rand > 0.7 ? 2.5 : 1.5;
    return { width };
  });

  const spacing = 1.5;
  const totalWidth = bars.reduce((acc, bar) => acc + bar.width + spacing, 0) - spacing;
  const svgWidth = 250;
  const svgHeight = 70;
  let currentX = (svgWidth - totalWidth) / 2;

  return (
    <div className="flex flex-col items-center py-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        aria-label={`Barcode for value ${value}`}
        className="fill-current text-white"
      >
        {bars.map((bar, index) => {
          const x = currentX;
          currentX += bar.width + spacing;
          return <rect key={index} x={x} y="10" width={bar.width} height="50" />;
        })}
      </svg>
      <p className="mt-2 text-xs tracking-[0.35em] text-white/45">{value}</p>
    </div>
  );
};

const ConfettiExplosion = () => {
  const confettiCount = 90;
  const colors = ["#ef4444", "#ffffff", "#f59e0b", "#fb7185", "#fca5a5"];

  return (
    <>
      <style>
        {`
          @keyframes ticket-fall {
            0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
          }
        `}
      </style>
      <div className="pointer-events-none fixed inset-0 z-40" aria-hidden="true">
        {Array.from({ length: confettiCount }).map((_, index) => (
          <div
            key={index}
            className="absolute h-4 w-2"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${-20 + Math.random() * 10}%`,
              backgroundColor: colors[index % colors.length],
              transform: `rotate(${Math.random() * 360}deg)`,
              animation: `ticket-fall ${2.4 + Math.random() * 2.1}s ${Math.random() * 1.4}s linear forwards`,
            }}
          />
        ))}
      </div>
    </>
  );
};

export interface TicketConfirmationCardProps extends React.HTMLAttributes<HTMLDivElement> {
  orderId: string;
  amount: number;
  createdAt: Date;
  customerName: string;
  phone: string;
  deliveryLabel: string;
  locationLabel: string;
  barcodeValue: string;
}

const TicketConfirmationCard = React.forwardRef<HTMLDivElement, TicketConfirmationCardProps>(
  (
    {
      className,
      orderId,
      amount,
      createdAt,
      customerName,
      phone,
      deliveryLabel,
      locationLabel,
      barcodeValue,
      ...props
    },
    ref
  ) => {
    const [showConfetti, setShowConfetti] = React.useState(false);

    React.useEffect(() => {
      const mountTimer = setTimeout(() => setShowConfetti(true), 120);
      const unmountTimer = setTimeout(() => setShowConfetti(false), 5800);
      return () => {
        clearTimeout(mountTimer);
        clearTimeout(unmountTimer);
      };
    }, []);

    const formattedAmount = new Intl.NumberFormat("fr-DZ", {
      style: "currency",
      currency: "DZD",
      maximumFractionDigits: 0,
    }).format(amount);

    const formattedDate = new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(createdAt);

    return (
      <>
        {showConfetti && <ConfettiExplosion />}
        <div
          ref={ref}
          className={cn(
            "relative z-50 w-full max-w-[22rem] overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,13,13,0.98),rgba(28,16,16,0.98))] text-white shadow-[0_30px_120px_rgba(0,0,0,0.55)] sm:max-w-md sm:rounded-[28px]",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-8 duration-700",
            className
          )}
          {...props}
        >
          <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.26),transparent_70%)]" />
          <div className="absolute -left-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-[#090909]" />
          <div className="absolute -right-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-[#090909]" />

          <div className="relative p-5 text-center sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-red-400/20 bg-red-500/10 sm:h-20 sm:w-20">
              <CheckCircle2 className="h-8 w-8 text-red-400 sm:h-10 sm:w-10" />
            </div>
            <p className="mt-4 text-[10px] uppercase tracking-[0.32em] text-red-300 sm:mt-5 sm:text-[11px] sm:tracking-[0.45em]">Velixa Neo</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Order Received</h2>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Your order has been posted successfully. You will be contacted soon for confirmation.
            </p>
          </div>

          <div className="space-y-5 px-5 pb-5 sm:px-8 sm:pb-8 sm:space-y-6">
            <DashedLine />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">Order ID</p>
                <p className="mt-2 break-all font-mono text-sm leading-6">{orderId}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">Total</p>
                <p className="mt-2 text-lg font-bold leading-6">{formattedAmount}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">Customer</p>
                <p className="mt-2 font-medium leading-6">{customerName}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">Phone</p>
                <p className="mt-2 font-medium leading-6">{phone}</p>
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">Date & Time</p>
              <p className="mt-2 font-medium leading-6">{formattedDate}</p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
              <div className="flex items-start gap-3">
                <Store className="mt-0.5 h-5 w-5 text-red-300" />
                <div>
                  <p className="font-semibold">velixa.neo</p>
                  <p className="text-sm leading-6 text-white/55">Order channel: official website</p>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <PackageCheck className="mt-0.5 h-5 w-5 text-red-300" />
                <div>
                  <p className="font-semibold">Status: posted</p>
                  <p className="text-sm leading-6 text-white/55">Our team will contact you soon.</p>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <PackageCheck className="mt-0.5 h-5 w-5 text-red-300" />
                <div>
                  <p className="font-semibold">{deliveryLabel}</p>
                  <p className="text-sm leading-6 text-white/55 break-words">{locationLabel}</p>
                </div>
              </div>
            </div>

            <DashedLine />

            <Barcode value={barcodeValue} />
          </div>
        </div>
      </>
    );
  }
);

TicketConfirmationCard.displayName = "TicketConfirmationCard";

export { TicketConfirmationCard };
