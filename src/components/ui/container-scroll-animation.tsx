"use client";
import React, { useRef } from "react";
import { useScroll, useTransform, motion, MotionValue } from "framer-motion";

export const ContainerScroll = ({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
  });
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const scaleDimensions = () => {
    return isMobile ? [0.92, 1] : [1.04, 1];
  };

  const rotate = useTransform(scrollYProgress, [0, 0.72], isMobile ? [13, 0] : [10, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 0.72], isMobile ? [24, -10] : [0, -28]);

  return (
    <div
      className="relative flex items-center justify-center px-2 py-4 md:px-8 md:py-10 min-h-[auto] md:min-h-[76rem]"
      ref={containerRef}
    >
      <div
        className="relative w-full py-8 md:py-20"
        style={{
          perspective: "1000px",
        }}
      >
        <div className="md:sticky md:top-12">
          <Header translate={translate} titleComponent={titleComponent} />
          <Card rotate={rotate} translate={translate} scale={scale}>
            {children}
          </Card>
        </div>
      </div>
    </div>
  );
};

export const Header = ({ translate, titleComponent }: any) => {
  return (
    <motion.div
      style={{
        translateY: translate,
      }}
      className="div max-w-5xl mx-auto pb-6 text-center md:pb-10"
    >
      {titleComponent}
    </motion.div>
  );
};

export const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  children: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      }}
      className="mx-auto mt-2 w-full max-w-6xl rounded-[30px] border-[3px] border-[#333] bg-[#121212] p-1 shadow-2xl md:mt-4 md:h-[50rem] md:p-6"
    >
      <div className="w-full overflow-hidden rounded-2xl bg-zinc-950 p-2 md:h-full md:rounded-[20px] md:p-4">
        {children}
      </div>
    </motion.div>
  );
};
