'use client';

import { useState, useEffect } from 'react';
import { useStore } from "@/store";
import { useTranslation } from "react-i18next";
import { SpiralAnimation } from "@/components/ui/spiral-animation";

interface EntranceScreenProps {
  onEnter: () => void;
}

export function EntranceScreen({ onEnter }: EntranceScreenProps) {
  const [startVisible, setStartVisible] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const { setLanguage } = useStore();
  const { i18n, t } = useTranslation();

  const handleLanguageSelect = async (lang: string) => {
    if (isEntering) return;
    setIsEntering(true);
    setLanguage(lang);

    try {
      await i18n.changeLanguage(lang);
    } finally {
      onEnter();
    }
  };
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setStartVisible(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div id="entrance-container" className="fixed inset-0 z-[100] h-full w-full overflow-hidden bg-black transition-opacity duration-1000 ease-in-out">
      <div className="absolute inset-0">
        <SpiralAnimation />
      </div>

      <div 
        className={`
          absolute left-1/2 top-[31%] z-10 w-full -translate-x-1/2 -translate-y-1/2 px-4 text-center
          transition-all duration-[1500ms] ease-out
          ${startVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        `}
      >
        <h1 className="text-white text-3xl md:text-5xl font-black uppercase tracking-widest drop-shadow-2xl">
          {t('Choose Your Language')}
        </h1>
        <p className="text-white/60 mt-4 tracking-[0.2em] uppercase text-sm">
          {t('Please select a language to enter the experience')}
        </p>
      </div>

      <div 
        className={`
          absolute left-1/2 top-1/2 z-10 mt-[10vh] flex -translate-x-1/2 flex-col items-center gap-4 md:flex-row md:gap-6
          transition-all duration-[1500ms] ease-out delay-500
          ${startVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
        `}
      >
        {[
          { code: 'en', label: 'English' },
          { code: 'fr', label: 'Français' },
          { code: 'ar', label: 'العربية' }
        ].map((lang) => (
          <button 
            key={lang.code}
            type="button"
            onClick={() => handleLanguageSelect(lang.code)}
            disabled={isEntering}
            className="
              px-12 py-4 bg-transparent border border-white/20 rounded-full
              text-white text-lg tracking-[0.2em] font-bold uppercase backdrop-blur-md
              transition-all duration-300
              hover:bg-accent-luxe hover:border-transparent hover:scale-110 active:scale-95 disabled:pointer-events-none disabled:opacity-50
              shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)]
            "
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
