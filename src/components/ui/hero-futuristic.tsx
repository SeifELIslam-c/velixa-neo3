'use client';

import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import { useAspect, useTexture } from '@react-three/drei';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three/webgpu';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { Mesh } from 'three';

import {
  abs,
  blendScreen,
  float,
  mod,
  mx_cell_noise_float,
  oneMinus,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  pass,
  mix,
  add
} from 'three/tsl';

const TEXTUREMAP = { src: 'https://i.postimg.cc/XYwvXN8D/img-4.png' };
const DEPTHMAP = { src: 'https://i.postimg.cc/2SHKQh2q/raw-4.webp' };

extend(THREE as any);

const PostProcessing = ({
  strength = 1,
  threshold = 1,
  fullScreenEffect = true,
}: {
  strength?: number;
  threshold?: number;
  fullScreenEffect?: boolean;
}) => {
  const { gl, scene, camera } = useThree();
  const progressRef = useRef({ value: 0 });

  const render = useMemo(() => {
    const postProcessing = new THREE.PostProcessing(gl as any);
    const scenePass = pass(scene, camera);
    const scenePassColor = scenePass.getTextureNode('output');
    const bloomPass = bloom(scenePassColor, strength, 0.5, threshold);

    const uScanProgress = uniform(0);
    progressRef.current = uScanProgress;

    const scanPos = float(uScanProgress.value);
    const uvY = uv().y;
    const scanWidth = float(0.05);
    const scanLine = smoothstep(0, scanWidth, abs(uvY.sub(scanPos)));
    const redOverlay = vec3(1, 0, 0).mul(oneMinus(scanLine)).mul(0.4);

    const withScanEffect = mix(
      scenePassColor,
      add(scenePassColor, redOverlay),
      fullScreenEffect ? smoothstep(0.9, 1.0, oneMinus(scanLine)) : 1.0
    );

    const final = withScanEffect.add(bloomPass);

    postProcessing.outputNode = final;

    return postProcessing;
  }, [camera, gl, scene, strength, threshold, fullScreenEffect]);

  useFrame(({ clock }) => {
    progressRef.current.value = (Math.sin(clock.getElapsedTime() * 0.5) * 0.5 + 0.5);
    render.renderAsync();
  }, 1);

  return null;
};

const WIDTH = 300;
const HEIGHT = 300;

const Scene = () => {
  const [rawMap, depthMap] = useTexture([TEXTUREMAP.src, DEPTHMAP.src]);

  const meshRef = useRef<Mesh>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (rawMap && depthMap) {
      setVisible(true);
    }
  }, [rawMap, depthMap]);

  const { material, uniforms } = useMemo(() => {
    const uPointer = uniform(new THREE.Vector2(0));
    const uProgress = uniform(0);

    const strength = 0.01;

    const tDepthMap = texture(depthMap);

    const tMap = texture(
      rawMap,
      uv().add(tDepthMap.r.mul(uPointer).mul(strength))
    );

    const aspect = float(WIDTH).div(HEIGHT);
    const tUv = vec2(uv().x.mul(aspect), uv().y);

    const tiling = vec2(120.0);
    const tiledUv = mod(tUv.mul(tiling), 2.0).sub(1.0);

    const brightness = mx_cell_noise_float(tUv.mul(tiling).div(2));

    const dist = float(tiledUv.length());
    const dot = float(smoothstep(0.5, 0.49, dist)).mul(brightness);

    const depth = tDepthMap.r;

    const flow = oneMinus(smoothstep(0, 0.02, abs(depth.sub(uProgress))));

    const mask = dot.mul(flow).mul(vec3(10, 0, 0));

    const final = blendScreen(tMap as any, mask as any);

    const material = new THREE.MeshBasicNodeMaterial({
      colorNode: final as any,
      transparent: true,
      opacity: 0,
    });

    return {
      material,
      uniforms: {
        uPointer,
        uProgress,
      },
    };
  }, [rawMap, depthMap]);

  const [w, h] = useAspect(WIDTH, HEIGHT);

  useFrame(({ clock }) => {
    uniforms.uProgress.value = (Math.sin(clock.getElapsedTime() * 0.5) * 0.5 + 0.5);
    if (meshRef.current && 'material' in meshRef.current && meshRef.current.material) {
      const mat = meshRef.current.material as any;
      if ('opacity' in mat) {
        mat.opacity = THREE.MathUtils.lerp(
          mat.opacity,
          visible ? 1 : 0,
          0.07
        );
      }
    }
  });

  useFrame(({ pointer }) => {
    uniforms.uPointer.value = pointer;
  });

  const scaleFactor = 0.40;
  return (
    <mesh ref={meshRef} scale={[w * scaleFactor, h * scaleFactor, 1]} material={material}>
      <planeGeometry />
    </mesh>
  );
};

import { useTranslation } from 'react-i18next';

export const HeroFuturistic = () => {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const titleString = t('Level Up Your Gear');
  const titleWords = titleString.split(' ');
  const subtitle = t('Ultra Premium Audio Experience.');
  const [visibleWords, setVisibleWords] = useState(0);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [delays, setDelays] = useState<number[]>([]);
  const [subtitleDelay, setSubtitleDelay] = useState(0);

  useEffect(() => {
    setDelays(titleWords.map(() => Math.random() * 0.07));
    setSubtitleDelay(Math.random() * 0.1);
  }, [titleWords.length]);

  useEffect(() => {
    if (visibleWords < titleWords.length) {
      const timeout = setTimeout(() => setVisibleWords(visibleWords + 1), 600);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => setSubtitleVisible(true), 800);
      return () => clearTimeout(timeout);
    }
  }, [visibleWords, titleWords.length]);

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  const shouldUseLightMode = shouldReduceMotion;

  return (
    <div className="h-screen w-full relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(5,5,5,0.12),rgba(5,5,5,0.62)_58%,rgba(5,5,5,0.88)_100%)] z-20" />
      <div className="absolute z-60 flex h-screen w-full flex-col justify-center px-4 uppercase pointer-events-none md:px-10">
        <div className="mx-auto w-full max-w-5xl rounded-[2rem] border border-white/10 bg-black/25 px-4 py-6 text-center backdrop-blur-xl shadow-[0_25px_80px_rgba(0,0,0,0.35)] md:px-10 md:py-8">
        <div className="text-3xl font-black tracking-tight drop-shadow-[0_12px_40px_rgba(0,0,0,0.65)] md:text-5xl xl:text-6xl 2xl:text-7xl">
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-2 overflow-hidden text-white md:gap-x-4">
            {titleWords.map((word, index) => (
              <div
                key={index}
                className={`${index < visibleWords ? 'fade-in' : ''} max-w-full break-words`}
                style={{ animationDelay: `${index * 0.13 + (delays[index] || 0)}s`, opacity: index < visibleWords ? undefined : 0, textShadow: '0 8px 28px rgba(0,0,0,0.55)' }}
              >
                {word}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 flex justify-center overflow-hidden text-white">
          <div
            className={subtitleVisible ? 'fade-in-subtitle' : ''}
            style={{ animationDelay: `${titleWords.length * 0.13 + 0.2 + subtitleDelay}s`, opacity: subtitleVisible ? undefined : 0 }}
          >
            <span className="inline-flex max-w-full items-center rounded-full border border-red-400/35 bg-red-500/16 px-4 py-2 text-center text-[11px] font-bold uppercase leading-relaxed tracking-[0.2em] shadow-[0_12px_36px_rgba(239,68,68,0.18)] md:text-xl xl:text-2xl md:tracking-[0.35em]">
              {subtitle}
            </span>
          </div>
        </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-6 md:bottom-10 z-60 flex justify-center pointer-events-none">
        <button
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
          className="explore-btn pointer-events-auto w-28 h-28 bg-transparent border border-white/20 rounded-full text-white text-[10px] uppercase tracking-[2px] font-bold hover:border-red-500 active:border-red-500 hover:shadow-[0_0_30px_rgba(239,68,68,0.35)] active:shadow-[0_0_30px_rgba(239,68,68,0.35)] transition-all flex flex-col items-center justify-center gap-1 backdrop-blur-md cursor-pointer group animate-[fadeIn_2s_ease-in_forwards]"
          style={{ animationDelay: '2.2s', opacity: 0 }}
        >
          <span className="text-center leading-tight">
            {t('Scroll')}
            <br />
            {t('To')}
            <br />
            {t('Explore')}
          </span>
          <span className="group-hover:translate-y-1 transition-transform mt-1">↓</span>
        </button>
      </div>

      {shouldUseLightMode ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(239,68,68,0.18),transparent_26%),radial-gradient(circle_at_50%_60%,rgba(255,255,255,0.08),transparent_22%),linear-gradient(180deg,#050505_0%,#090909_44%,#050505_100%)]" />
      ) : (
        <Canvas
          flat
          className="w-full h-full bg-bg-luxe"
          dpr={isMobile ? [1, 1.2] : [1, 1.5]}
          gl={async (props) => {
            const renderer = new THREE.WebGPURenderer(props as any);
            await renderer.init();
            return renderer;
          }}
        >
          <PostProcessing fullScreenEffect={true} />
          <Scene />
        </Canvas>
      )}
    </div>
  );
};

export default HeroFuturistic;
