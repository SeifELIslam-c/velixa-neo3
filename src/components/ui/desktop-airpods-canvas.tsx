import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Center, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import airpodsModelPath from "../../assets/airpods1.glb?url";

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
  }, [modelScene]);

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

export function DesktopAirpodsCanvas({ liteMode = false }: { liteMode?: boolean }) {
  return (
    <Canvas
      className="!h-full !w-full"
      style={{ pointerEvents: "none" }}
      frameloop="always"
      camera={{
        position: [0, 0.08, 8.5],
        fov: 34,
        near: 0.001,
        far: 100,
      }}
      dpr={[1, 1.5]}
      resize={{ scroll: false, debounce: { resize: 0, scroll: 50 } }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: "high-performance" }}
    >
      <Environment preset="studio" />
      <Suspense fallback={null}>
        <AirpodsModel liteMode={liteMode} />
      </Suspense>
    </Canvas>
  );
}
