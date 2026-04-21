import { useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Center, Environment, useGLTF } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import * as THREE from "three";

import { Navbar } from "./Navbar";
import { ContainerScroll } from "./ui/container-scroll-animation";
import { Spotlight } from "./ui/spotlight";
import { Card } from "./ui/card";
import { ProductRevealCard } from "./ui/product-reveal-card";
import { useStore } from "../store";

import airpodsModelPath from "../assets/airpods1.glb?url";

const HeroFuturistic = lazy(() =>
  import("./ui/hero-futuristic").then((module) => ({ default: module.HeroFuturistic }))
);
const SpatialProductShowcase = lazy(() => import("./ui/spatial-product-showcase"));

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobile;
}

function AirpodsModel({ liteMode = false }: { liteMode?: boolean }) {
  const { scene } = useGLTF(airpodsModelPath);
  const { size } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const modelScene = useMemo(() => scene.clone(), [scene]);
  const isMobile = size.width < 768;

  useEffect(() => {
    modelScene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material: any) => {
        if (!material) return;
        if ("metalness" in material) material.metalness = 0.5;
        if ("roughness" in material) material.roughness = 0.2;
        if ("envMapIntensity" in material) material.envMapIntensity = 1.65;
        if ("clearcoat" in material) material.clearcoat = Math.max(material.clearcoat ?? 0, 0.75);
        if ("clearcoatRoughness" in material) material.clearcoatRoughness = 0.12;
        if ("emissiveIntensity" in material) material.emissiveIntensity = 0;
        material.needsUpdate = true;
      });
    });
  }, [liteMode, modelScene]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const finalX = isMobile ? 0 : -0.2;
    const finalY = isMobile ? -0.05 : -0.1;
    const finalScale = isMobile ? 0.76 : 1.15;

    const targetDiv = document.getElementById("3d-showcase-container");
    let progress = 0;

    if (targetDiv) {
      const rect = targetDiv.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const start = viewportHeight * 0.92;
      const end = viewportHeight * 0.56;
      const raw = 1 - (rect.top - end) / Math.max(1, start - end);
      progress = THREE.MathUtils.clamp(raw, 0, 1);
      progress = progress * progress * (3 - 2 * progress);
    }

    const startX = finalX + (isMobile ? 0 : 0.45);
    const startY = finalY + (isMobile ? 1.15 : 1.45);
    const startScale = finalScale * (isMobile ? 0.62 : 0.7);
    const idleY = Math.sin(state.clock.getElapsedTime() * 1.5) * 0.03;

    const animatedX = THREE.MathUtils.lerp(startX, finalX, progress);
    const animatedY = THREE.MathUtils.lerp(startY, finalY, progress);
    const animatedScale = THREE.MathUtils.lerp(startScale, finalScale, progress);

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, animatedX, 0.08);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, animatedY + idleY, 0.08);
    groupRef.current.scale.setScalar(
      THREE.MathUtils.lerp(groupRef.current.scale.x, animatedScale, 0.08)
    );
    groupRef.current.rotation.y += delta * (liteMode ? 0.28 : 0.4);
    groupRef.current.rotation.x = 0.15;
    groupRef.current.rotation.z = 0.05;
  });

  return (
    <>
      <ambientLight intensity={1.2} />
      <hemisphereLight args={["#ffffff", "#111111", 1.55]} />
      <directionalLight position={[5, 7, 8]} intensity={3.2} color="#ffffff" />
      <directionalLight position={[-4, 2, 6]} intensity={1.6} color="#dbeafe" />
      <directionalLight position={[0, -3, 4]} intensity={0.9} color="#ffffff" />
      <pointLight position={[0, 0.4, 6]} intensity={4.5} distance={14} color="#ffffff" />
      <spotLight
        position={[0, 5.5, 7]}
        intensity={16}
        angle={0.45}
        penumbra={0.8}
        distance={22}
        decay={1.4}
        color="#ffffff"
      />

      <group ref={groupRef} scale={isMobile ? 0.76 : 1.15}>
        <Center>
          <primitive object={modelScene} />
        </Center>
      </group>
    </>
  );
}

useGLTF.preload(airpodsModelPath);

export function HomePage() {
  const { products } = useStore();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const isMobile = useIsMobile();
  const shouldReduceMotion = useReducedMotion();
  const shouldUseLiteVisuals = shouldReduceMotion;

  const [activeCategory, setActiveCategory] = useState("All");
  const categories = ["All", ...Array.from(new Set(products.map((product) => product.category)))];

  const filteredProducts =
    activeCategory === "All"
      ? products
      : products.filter((product) => product.category === activeCategory);

  const featuredProduct = products.find((product) => product.model3d);
  const featuredOriginalPrice = featuredProduct?.oldPrice ?? 2300;

  useEffect(() => {
    if (!window.location.hash) return;
    const targetId = window.location.hash.replace("#", "");
    const target = document.getElementById(targetId);
    if (!target) return;

    const timeout = window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);

    return () => window.clearTimeout(timeout);
  }, []);

  const handleAddToCartAnimation = (event: React.MouseEvent<HTMLElement>, product: any) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    window.dispatchEvent(
      new CustomEvent("triggerAddToCartAnimation", {
        detail: { product, startRect: rect },
      })
    );
  };

  const addToCartLabel =
    i18n.language === "ar"
      ? "Add to cart"
      : i18n.language.startsWith("fr")
        ? "Ajouter au panier"
        : "Add to cart";

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg-luxe font-sans text-white" dir={isRtl ? "rtl" : "ltr"}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.10),transparent_24%),radial-gradient(circle_at_80%_35%,rgba(255,255,255,0.05),transparent_18%)]" />
      <Navbar />

      <section id="main-page" className="relative h-screen w-full">
        <Suspense fallback={<div className="h-full w-full bg-bg-luxe" />}>
          <HeroFuturistic />
        </Suspense>
      </section>

      {featuredProduct ? (
        <section className="relative z-50 mx-auto max-w-7xl px-4 pb-10 pt-28 md:px-6 md:pb-12 md:pt-36">
          <Card className="relative flex w-full flex-col overflow-hidden rounded-[32px] border-4 border-[#333] bg-[#18181b] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] md:min-h-[31rem] md:rounded-[40px]">
            <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" size={500} />

            <div className="absolute left-4 right-4 top-4 z-20 md:left-auto md:right-8 md:top-8 md:w-auto">
              <div className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/65 px-4 py-3 text-center backdrop-blur md:justify-start">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.95)]" />
                </span>
                <span className="text-[10px] font-semibold uppercase leading-snug tracking-[0.2em] text-white sm:text-[11px] sm:tracking-widest">
                  {t("Real-time Stock")}: {featuredProduct.stock} {t("Available")}
                </span>
              </div>
            </div>

            <div className="relative z-10 flex flex-1 flex-col md:flex-row md:items-stretch">
              <div className="relative flex flex-1 flex-col justify-end p-5 pb-8 pt-24 md:p-12 md:pb-12">
                <span className="mb-2 text-[10px] font-semibold uppercase tracking-[2px] text-white/60">
                  {t("Limited Edition Model")}
                </span>
                <h2 className="mb-4 max-w-full text-3xl font-bold leading-tight text-white md:max-w-[12ch] md:text-5xl">
                  {featuredProduct.name}
                </h2>
                <div className="mb-8 flex flex-wrap items-end gap-x-3 gap-y-2">
                  {featuredOriginalPrice > featuredProduct.price ? (
                    <span className="rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1 text-sm font-semibold text-red-200/90 line-through decoration-2 decoration-red-300/80">
                      {featuredOriginalPrice.toLocaleString()} DZD
                    </span>
                  ) : null}

                  <p className="text-4xl font-bold leading-none text-white md:text-5xl">
                    {featuredProduct.price.toLocaleString()}
                  </p>
                  <span className="mb-1 ml-1 text-sm font-bold text-white/60">DZD</span>
                </div>

                <button
                  onClick={(event) => handleAddToCartAnimation(event, featuredProduct)}
                  className="relative z-50 flex w-full cursor-pointer items-center justify-center gap-2 self-start rounded-lg border-none bg-linear-to-b from-[#FAFAFA] to-[#A0A0A0] px-6 py-4 text-center text-[0.82rem] font-bold uppercase tracking-tight text-black shadow-[0_4px_0_#666,0_10px_20px_rgba(0,0,0,0.3)] transition-all hover:brightness-110 active:translate-y-0.5 sm:w-auto sm:px-10 sm:text-[0.9rem]"
                >
                  {addToCartLabel}
                </button>
              </div>

              <div
                id="3d-showcase-container"
                className="relative flex min-h-[22rem] items-center justify-center overflow-hidden border-t border-white/5 bg-black/20 md:min-h-0 md:flex-1 md:border-l md:border-t-0"
              >
                <div className="pointer-events-none absolute inset-x-4 bottom-3 h-24 rounded-full bg-red-500/12 blur-3xl md:inset-x-6 md:bottom-4" />
                <div className="pointer-events-none absolute inset-x-10 top-5 h-16 rounded-full bg-white/8 blur-3xl md:inset-x-16 md:top-6" />

                <div className="absolute inset-[-10%] z-50 flex items-center justify-center md:inset-[-5%]">
                  {shouldUseLiteVisuals ? (
                    <img
                      src={featuredProduct.image}
                      alt={featuredProduct.name}
                      className="h-[78%] w-[78%] max-w-[22rem] object-contain drop-shadow-[0_18px_42px_rgba(0,0,0,0.42)] md:h-[82%] md:w-[82%]"
                      loading="eager"
                      decoding="async"
                    />
                  ) : (
                    <Canvas
                      className="!h-full !w-full"
                      style={{ pointerEvents: "none" }}
                      frameloop="always"
                      camera={{
                        position: [0, 0.08, isMobile ? 9.5 : 8.5],
                        fov: isMobile ? 38 : 34,
                        near: 0.001,
                        far: 100,
                      }}
                      dpr={isMobile ? [1, 1.2] : [1, 1.5]}
                      resize={{ scroll: false, debounce: { resize: 0, scroll: 50 } }}
                      gl={{ antialias: !isMobile, alpha: true, preserveDrawingBuffer: false, powerPreference: "high-performance" }}
                    >
                      <Environment preset="studio" />
                      <Suspense fallback={null}>
                        <AirpodsModel liteMode={isMobile} />
                      </Suspense>
                    </Canvas>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </section>
      ) : null}

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-[#0b0b0c] via-[#100d10]/50 to-transparent" />
        <Suspense fallback={<div className="min-h-[520px] bg-bg-luxe" />}>
          <SpatialProductShowcase />
        </Suspense>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-b from-transparent via-[#151114]/45 to-[#0b0b0c]" />
      </div>

      <section id="collection" className="relative overflow-hidden bg-bg-luxe py-2 md:py-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-[#0b0b0c]/0 via-[#151114]/60 to-transparent" />
        <ContainerScroll
          titleComponent={
            <div className="mb-8 pt-3 md:mb-12 md:pt-5">
              <h1 className="text-4xl font-semibold text-white">
                {t("Explore our")} <br />
                <span className="mt-1 bg-linear-to-r from-neutral-200 to-neutral-600 bg-clip-text text-5xl font-bold leading-none text-transparent md:text-7xl">
                  {t("Products")} {t("Collection")}
                </span>
              </h1>
            </div>
          }
        >
          <div className="relative z-50 mb-4 flex flex-wrap justify-center gap-4 pointer-events-auto">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`relative z-50 rounded-full border px-6 py-2 transition-colors ${
                  activeCategory === category
                    ? "border-white bg-white text-black"
                    : "border-neutral-700 bg-transparent text-white hover:border-white"
                }`}
              >
                {category === "All" ? t("All") : t(`category.${category}`)}
              </button>
            ))}
          </div>

          <div className="relative z-50 grid grid-cols-1 auto-rows-max gap-6 p-3 pb-10 md:max-h-[calc(50rem-10rem)] md:grid-cols-2 md:overflow-y-auto md:p-8 md:pb-20 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductRevealCard
                key={product.id}
                name={product.name}
                price={product.price}
                originalPrice={product.oldPrice ? String(product.oldPrice) : undefined}
                image={product.image}
                stock={product.stock}
                onAdd={(event) => handleAddToCartAnimation(event, product)}
              />
            ))}
          </div>
        </ContainerScroll>
      </section>
    </div>
  );
}
