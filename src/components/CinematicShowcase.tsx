import React, { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface Slide {
  image: string;
  name?: string;
}

interface CinematicShowcaseProps {
  slides: Slide[];
}

// Преміальний «відео-замінник»: повільний Ken Burns (зум + пан) з крос-фейдом між
// РЕАЛЬНИМИ фото товарів. Автентично й дорого, без AI-згенерованих кадрів.
// Підписи-цінності змінюються синхронно зі слайдами.
const CAPTIONS = [
  { kicker: 'Хатні Штучки', line: 'Естетика, що збирає дім' },
  { kicker: 'Тихий затишок', line: 'Речі, які поєднуються між собою' },
  { kicker: 'Зібрано з любов’ю', line: 'Кераміка, текстиль і декор для щоденного ритуалу' },
  { kicker: 'Ваш набір — ваш стиль', line: 'Зберіть власний комплект зі знижкою −12%' },
];

const SLIDE_MS = 4800;

export const CinematicShowcase = ({ slides }: CinematicShowcaseProps) => {
  const prefersReducedMotion = useReducedMotion();

  // Лишаємо тільки слайди з реальним зображенням, максимум 5 — щоб показ був щільним.
  const usableSlides = useMemo(
    () => slides.filter((slide) => typeof slide.image === 'string' && slide.image.trim()).slice(0, 5),
    [slides],
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion || usableSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % usableSlides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [prefersReducedMotion, usableSlides.length]);

  if (usableSlides.length === 0) return null;

  const caption = CAPTIONS[index % CAPTIONS.length];

  return (
    <section className="relative bg-slate-950">
      <div className="relative h-[70vh] min-h-[440px] w-full overflow-hidden">
        {/* Шар фотографій: активний плавно з'являється й повільно наближається (Ken Burns). */}
        {usableSlides.map((slide, slideIndex) => {
          const isActive = slideIndex === index;
          return (
            <div
              key={`${slide.image}-${slideIndex}`}
              aria-hidden={!isActive}
              className="absolute inset-0 transition-opacity duration-[1400ms] ease-out"
              style={{ opacity: isActive ? 1 : 0 }}
            >
              <img
                src={slide.image}
                alt={slide.name || 'Товар Хатні Штучки'}
                loading={slideIndex === 0 ? 'eager' : 'lazy'}
                decoding="async"
                referrerPolicy="no-referrer"
                className={`h-full w-full object-cover ${
                  isActive && !prefersReducedMotion ? 'animate-kenburns' : ''
                }`}
              />
            </div>
          );
        })}

        {/* Затемнення для читабельності тексту. */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 to-transparent" />

        {/* Контент. */}
        <div className="relative flex h-full items-end">
          <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16">
            <div className="max-w-2xl">
              <div
                key={`kicker-${index}`}
                className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.32em] text-tiffany transition-opacity duration-700"
              >
                <span aria-hidden="true" className="h-px w-10 bg-tiffany" />
                {caption.kicker}
              </div>
              <h2
                key={`line-${index}`}
                className="mt-4 font-serif text-4xl font-bold leading-[1.05] text-white drop-shadow-sm sm:text-5xl lg:text-6xl"
              >
                {caption.line}
              </h2>

              <div className="mt-8 flex flex-wrap items-center gap-6">
                <Link
                  to="/catalog"
                  className="group inline-flex items-center justify-center gap-3 rounded-lg bg-white px-8 py-4 font-bold text-slate-950 transition-colors hover:bg-tiffany hover:text-white hover:no-underline"
                >
                  Дивитись каталог <ArrowRight size={19} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/bundle-builder"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/35 px-8 py-4 font-bold text-white backdrop-blur-sm transition-colors hover:border-white hover:bg-white/10 hover:no-underline"
                >
                  Зібрати набір <span className="text-tiffany">−12%</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Індикатори слайдів. */}
        {usableSlides.length > 1 && (
          <div className="absolute bottom-6 right-6 flex gap-2 sm:right-8">
            {usableSlides.map((slide, dotIndex) => (
              <button
                key={`dot-${slide.image}-${dotIndex}`}
                type="button"
                aria-label={`Показати кадр ${dotIndex + 1}`}
                onClick={() => setIndex(dotIndex)}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  dotIndex === index ? 'w-8 bg-tiffany' : 'w-3 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
