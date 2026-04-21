"use client";

import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

type Grid = {
  rows: number;
  cols: number;
};

const DEFAULT_GRIDS: Record<string, Grid> = {
  "6x4": { rows: 4, cols: 6 },
  "8x8": { rows: 8, cols: 8 },
  "8x3": { rows: 3, cols: 8 },
  "4x6": { rows: 6, cols: 4 },
  "3x8": { rows: 8, cols: 3 },
};

type PredefinedGridKey = keyof typeof DEFAULT_GRIDS;

interface PixelImageProps {
  src: string;
  grid?: PredefinedGridKey;
  customGrid?: Grid;
  grayscaleAnimation?: boolean;
  pixelFadeInDuration?: number;
  maxAnimationDelay?: number;
  colorRevealDelay?: number;
  className?: string;
}

export const PixelImage = ({
  src,
  grid = "6x4",
  grayscaleAnimation = true,
  pixelFadeInDuration = 1000,
  maxAnimationDelay = 1200,
  colorRevealDelay = 1300,
  customGrid,
  className,
}: PixelImageProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showColor, setShowColor] = useState(false);

  const MIN_GRID = 1;
  const MAX_GRID = 16;

  const { rows, cols } = useMemo(() => {
    const isValidGrid = (value?: Grid) => {
      if (!value) return false;
      return (
        Number.isInteger(value.rows) &&
        Number.isInteger(value.cols) &&
        value.rows >= MIN_GRID &&
        value.cols >= MIN_GRID &&
        value.rows <= MAX_GRID &&
        value.cols <= MAX_GRID
      );
    };

    return isValidGrid(customGrid) ? customGrid : DEFAULT_GRIDS[grid];
  }, [customGrid, grid]);

  useEffect(() => {
    setIsVisible(false);
    setShowColor(false);

    const visibleTimer = window.setTimeout(() => setIsVisible(true), 30);
    const colorTimer = window.setTimeout(() => setShowColor(true), colorRevealDelay);

    return () => {
      window.clearTimeout(visibleTimer);
      window.clearTimeout(colorTimer);
    };
  }, [src, colorRevealDelay]);

  const pieces = useMemo(() => {
    const total = rows * cols;
    return Array.from({ length: total }, (_, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const clipPath = `polygon(
        ${col * (100 / cols)}% ${row * (100 / rows)}%,
        ${(col + 1) * (100 / cols)}% ${row * (100 / rows)}%,
        ${(col + 1) * (100 / cols)}% ${(row + 1) * (100 / rows)}%,
        ${col * (100 / cols)}% ${(row + 1) * (100 / rows)}%
      )`;

      return {
        clipPath,
        delay: Math.random() * maxAnimationDelay,
      };
    });
  }, [rows, cols, maxAnimationDelay, src]);

  return (
    <div className={cn("relative h-72 w-72 select-none md:h-96 md:w-96", className)}>
      {pieces.map((piece, index) => (
        <div
          key={`${src}-${index}`}
          className={cn("absolute inset-0 transition-all ease-out", isVisible ? "opacity-100" : "opacity-0")}
          style={{
            clipPath: piece.clipPath,
            transitionDelay: `${piece.delay}ms`,
            transitionDuration: `${pixelFadeInDuration}ms`,
          }}
        >
          <img
            src={src}
            alt={`Pixel image piece ${index + 1}`}
            className={cn(
              "h-full w-full object-cover rounded-[2rem]",
              grayscaleAnimation && (showColor ? "grayscale-0" : "grayscale")
            )}
            style={{
              transition: grayscaleAnimation
                ? `filter ${pixelFadeInDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`
                : "none",
            }}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
};
