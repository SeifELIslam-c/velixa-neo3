import { useState, useRef, Suspense, useEffect, useMemo } from "react";
import { HeroFuturistic } from "./ui/hero-futuristic";
import { ContainerScroll } from "./ui/container-scroll-animation";
import { Spotlight } from "./ui/spotlight";
import { Card } from "./ui/card";
import { useStore } from "../store";
import { useTranslation } from "react-i18next";
import { Navbar } from "./Navbar";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Center, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ProductRevealCard } from "./ui/product-reveal-card";
import SpatialProductShowcase from "./ui/spatial-product-showcase";


import airpodsModelPath from "../assets/airpods1.glb?url";


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


function AirpodsModel() {
  const { scene } = useGLTF(airpodsModelPath);
  const { size } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const modelScene = useMemo(() => scene.clone(), [scene]);
  const finalXRef = useRef(0);
  const finalYRef = useRef(0);
  const finalScaleRef = useRef(1);


  const isMobile = size.width < 768;


  useEffect(() => {
    modelScene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;


      const materialList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];


      materialList.forEach((material: any) => {
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
  }, [modelScene]);


  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const finalX = isMobile ? 0 : -0.2;
    const finalY = isMobile ? -0.05 : -0.1;
    const finalScale = isMobile ? 0.76 : 1.15;
    finalXRef.current = finalX;
    finalYRef.current = finalY;
    finalScaleRef.current = finalScale;

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
    const t = state.clock.getElapsedTime();
    const idleY = Math.sin(t * 1.5) * 0.03;

    const animatedX = THREE.MathUtils.lerp(startX, finalX, progress);
    const animatedY = THREE.MathUtils.lerp(startY, finalY, progress);
    const animatedScale = THREE.MathUtils.lerp(startScale, finalScale, progress);

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, animatedX, 0.08);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, animatedY + idleY, 0.08);
    groupRef.current.scale.setScalar(
      THREE.MathUtils.lerp(groupRef.current.scale.x, animatedScale, 0.08)
    );
    groupRef.current.rotation.y += delta * 0.4;
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
      <spotLight position={[0, 5.5, 7]} intensity={16} angle={0.45} penumbra={0.8} distance={22} decay={1.4} color="#ffffff" />


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


  const handleAddToCartAnimation = (e: React.MouseEvent<HTMLElement>, product: any) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const event = new CustomEvent("triggerAddToCartAnimation", {
      detail: { product, startRect: rect },
    });
    window.dispatchEvent(event);
  };


  const addToCartLabel = i18n.language === "ar"
    ? "أضف إلى السلة"
    : i18n.language.startsWith("fr")
      ? "Ajouter au panier"
      : t("ADD TO CART");


  return (
    <div
      className="bg-bg-luxe min-h-screen text-white font-sans overflow-hidden relative"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.10),transparent_24%),radial-gradient(circle_at_80%_35%,rgba(255,255,255,0.05),transparent_18%)]" />
      <Navbar />


      <section id="main-page" className="relative w-full h-screen">
        <HeroFuturistic />
      </section>


      {featuredProduct && (
        <section className="px-4 pb-10 pt-28 md:px-6 md:pb-12 md:pt-36 max-w-7xl mx-auto relative z-50 h-[100vh]">
          <div className="sticky top-24 md:top-32 w-full h-auto">
            <Card className="w-full min-h-[34rem] md:min-h-[31rem] flex flex-col bg-[#18181b] border-4 border-[#333] rounded-[32px] md:rounded-[40px] relative overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)]">
              
              <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" size={500} />


              <div className="absolute left-4 right-4 top-4 z-20 md:left-auto md:right-8 md:top-8 md:w-auto">
                <div className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/65 px-4 py-3 text-center backdrop-blur md:justify-start">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.95)]" />
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-semibold uppercase text-white tracking-[0.2em] sm:tracking-widest leading-snug">
                    {t("Real-time Stock")}: {featuredProduct.stock} {t("Available")}
                  </span>
                </div>
              </div>


              <div className="relative z-10 flex flex-1 flex-col md:flex-row md:items-stretch">
                <div className="relative flex flex-1 flex-col justify-end p-6 pt-24 pb-10 md:p-12 md:pb-12">
                  <span className="text-white/60 text-[10px] uppercase tracking-[2px] mb-2 font-semibold">
                    {t("Limited Edition Model")}
                  </span>
                  <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 max-w-[12ch]">
                    {featuredProduct.name}
                  </h2>
                  <div className="mb-8 flex flex-wrap items-end gap-x-3 gap-y-2">
                    {featuredOriginalPrice > featuredProduct.price ? (
                      <span className="rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1 text-sm font-semibold text-red-200/90 line-through decoration-2 decoration-red-300/80">
                        {featuredOriginalPrice.toLocaleString()} DZD
                      </span>
                    ) : null}
          <p className="text-4xl md:text-5xl font-bold text-white leading-none">
                      {featuredProduct.price.toLocaleString()}
                    </p>
                    <span className="text-sm text-white/60 mb-1 ml-1 font-bold">DZD</span>
                  </div>
                  <button
                    onClick={(e) => handleAddToCartAnimation(e, featuredProduct)}
                    className="relative z-50 self-start uppercase text-[0.9rem] font-bold tracking-tight py-4 px-10 bg-linear-to-b from-[#FAFAFA] to-[#A0A0A0] text-black rounded-lg hover:brightness-110 active:translate-y-0.5 transition-all border-none shadow-[0_4px_0_#666,0_10px_20px_rgba(0,0,0,0.3)] flex items-center gap-2 cursor-pointer"
                  >
                    {addToCartLabel}
                  </button>
                </div>


                <div
                  id="3d-showcase-container"
                  className="relative flex min-h-[26rem] md:min-h-0 md:flex-1 items-center justify-center overflow-hidden border-t md:border-t-0 md:border-l border-white/5 bg-black/20"
                >
                  <div className="pointer-events-none absolute inset-x-4 bottom-3 h-24 rounded-full bg-red-500/12 blur-3xl md:inset-x-6 md:bottom-4" />
                  <div className="pointer-events-none absolute inset-x-10 top-5 h-16 rounded-full bg-white/8 blur-3xl md:inset-x-16 md:top-6" />


                  <div className="absolute inset-[-10%] md:inset-[-5%] z-50 flex items-center justify-center">
                    <Canvas
                      key={isMobile ? "mobile-canvas" : "desktop-canvas"}
                      className="!w-full !h-full"
                      style={{ pointerEvents: "none" }}
                      camera={{ 
                        position: [0, isMobile ? 0.08 : 0.08, isMobile ? 9.5 : 8.5], 
                        fov: isMobile ? 38 : 34, 
                        near: 0.001, 
                        far: 100 
                      }}
                      dpr={[1, 2]}
                      resize={{ scroll: false, debounce: { resize: 0, scroll: 50 } }}
                      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
                    >
                      <Environment preset="studio" />
                      <Suspense fallback={null}>
                        <AirpodsModel />
                      </Suspense>
                    </Canvas>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      )}


      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-[#0b0b0c] via-[#100d10]/50 to-transparent" />
        <SpatialProductShowcase />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-b from-transparent via-[#151114]/45 to-[#0b0b0c]" />
      </div>


   <section id="collection" className="bg-bg-luxe py-2 md:py-8 overflow-hidden relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-[#0b0b0c]/0 via-[#151114]/60 to-transparent" />
        <ContainerScroll
          titleComponent={
            <div className="mb-8 pt-3 md:mb-12 md:pt-5">
              <h1 className="text-4xl font-semibold text-white">
                {t("Explore our")} <br />
                <span className="text-5xl md:text-7xl font-bold mt-1 leading-none text-transparent bg-clip-text bg-linear-to-r from-neutral-200 to-neutral-600">
                  {t("Products")} {t("Collection")}
                </span>
              </h1>
            </div>
          }
        >
          <div className="flex justify-center gap-4 mb-4 flex-wrap z-50 relative pointer-events-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-2 rounded-full border transition-colors relative z-50 ${
                  activeCategory === cat
                    ? "bg-white text-black border-white"
                    : "bg-transparent text-white border-neutral-700 hover:border-white"
                }`}
              >
                {cat === "All" ? t("All") : t(`category.${cat}`)}
              </button>
            ))}
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-3 md:p-8 h-full overflow-y-auto pb-10 md:pb-20 relative z-50 auto-rows-max">
            {filteredProducts.map((product) => (
              <ProductRevealCard
                key={product.id}
                name={product.name}
                price={product.price}
                originalPrice={product.oldPrice ? String(product.oldPrice) : undefined}
                image={product.image}
                stock={product.stock}
                onAdd={(e) => handleAddToCartAnimation(e, product)}
              />
            ))}
          </div>
        </ContainerScroll>
      </section>
    </div>
  );
}
