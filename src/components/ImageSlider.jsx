import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2 } from 'lucide-react';

const ImageSlider = ({ images, onNavigate }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  const goToNext = useCallback(() => {
    setCurrentIndex((prevIndex) => 
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
    setProgress(0);
  }, [images.length]);

  const goToPrevious = () => {
    setCurrentIndex(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
    setProgress(0);
  };

  const goToSlide = (index) => {
    setCurrentIndex(index);
    setProgress(0);
  };

  // Auto-play and Progress bar logic
  useEffect(() => {
    if (!isAutoPlaying) return;

    const intervalTime = 5000; // 5 seconds per slide
    const updateFrequency = 100; // update every 100ms
    const step = (updateFrequency / intervalTime) * 100;

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          goToNext();
          return 0;
        }
        return prev + step;
      });
    }, updateFrequency);

    return () => clearInterval(progressInterval);
  }, [isAutoPlaying, goToNext]);

  return (
    <div className="relative w-full h-[190px] sm:h-[230px] overflow-hidden rounded-2xl shadow-xl group border-2 border-white">
      {/* Background Glow Effect */}
      <div className="absolute inset-0 bg-indigo-600/10 blur-3xl -z-10 animate-pulse"></div>

      {/* Slider container */}
      <div className="relative w-full h-full bg-gray-900">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={`absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] ${
              index === currentIndex 
                ? 'opacity-100 scale-100 rotate-0 z-10' 
                : 'opacity-0 scale-110 rotate-1 z-0'
            }`}
          >
            <img
              src={image.url}
              alt={image.title}
              className="w-full h-full object-cover transform transition-transform duration-[10s] hover:scale-110"
              loading="lazy"
              onError={(e) => {
                e.target.style.display = 'none';
                const parent = e.target.parentElement;
                const placeholder = parent.querySelector('.image-placeholder');
                if (placeholder) placeholder.style.display = 'flex';
              }}
            />
            
            {/* Overlay Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent"></div>

            {/* Text overlay: folder name or title (bottom-left) */}
            <div className="absolute left-4 bottom-4 z-20 bg-black/60 text-white px-3 py-1 rounded-md text-sm font-semibold truncate max-w-[70%]">{image.folderName || image.title}</div>

            {/* Placeholder */}
            <div className="image-placeholder absolute inset-0 bg-gray-800 hidden items-center justify-center">
              <div className="text-gray-400 flex flex-col items-center">
                <ImageIcon className="h-12 w-12 mb-3 opacity-50" />
                <span className="text-sm font-medium">Image not available</span>
              </div>
            </div>

            {/* Content Info (overlay shown above) */}
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 z-30 flex gap-1 px-4 pt-2">
        {images.map((_, index) => (
          <div key={index} className="h-full flex-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
            <div 
              className={`h-full bg-white transition-all duration-100 ease-linear ${
                index === currentIndex ? '' : index < currentIndex ? 'w-full' : 'w-0'
              }`}
              style={{ width: index === currentIndex ? `${progress}%` : undefined }}
            ></div>
          </div>
        ))}
      </div>

      {/* Navigation arrows - Enhanced Glassmorphism */}
      <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3 z-20 pointer-events-none">
        <button
          onClick={goToPrevious}
          className="pointer-events-auto p-2 bg-black/20 backdrop-blur-md text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:text-indigo-600 hover:scale-110 shadow-xl border border-white/10"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={goToNext}
          className="pointer-events-auto p-2 bg-black/20 backdrop-blur-md text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:text-indigo-600 hover:scale-110 shadow-xl border border-white/10"
          aria-label="Next image"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Slide Counter */}
      <div className="absolute bottom-4 right-4 z-30 hidden sm:flex items-baseline gap-1 text-white/50 font-medium">
        <span className="text-white text-base font-bold">{(currentIndex + 1).toString().padStart(2, '0')}</span>
        <span className="text-[10px]">/</span>
        <span className="text-[10px]">{images.length.toString().padStart(2, '0')}</span>
      </div>

      {/* Auto-play status toggle */}
      <button
        onClick={() => setIsAutoPlaying(!isAutoPlaying)}
        className="absolute top-4 right-4 z-30 p-1.5 bg-black/20 backdrop-blur-md text-white rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
      >
        {isAutoPlaying ? (
          <div className="flex gap-0.5 items-center px-0.5">
            <div className="w-0.5 h-2.5 bg-white rounded-full animate-pulse"></div>
            <div className="w-0.5 h-2.5 bg-white rounded-full animate-pulse delay-75"></div>
          </div>
        ) : (
          <div className="w-0 h-0 border-t-[4px] border-b-[4px] border-transparent border-l-[7px] border-l-white ml-0.5"></div>
        )}
      </button>

      <style>{`
        @keyframes rotate-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ImageSlider;