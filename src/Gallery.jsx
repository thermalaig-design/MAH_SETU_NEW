import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Image as ImageIcon, X, ChevronLeft, ChevronRight, Menu, Home as HomeIcon, FolderOpen, Play, Pause } from 'lucide-react';
import { fetchAllGalleryImages, fetchGalleryFolders, UNASSIGNED_FOLDER_ID } from './services/galleryService';
import Sidebar from './components/Sidebar';

export function Gallery({ onNavigate }) {
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [images, setImages] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const folderTabsRef = React.useRef(null);
  const paginationRef = React.useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const IMAGES_PER_PAGE = 30;
  const SLIDER_INTERVAL_MS = 2500; // medium-fast autoplay interval

  // Scroll locking when sidebar is open
  useEffect(() => {
    if (isMenuOpen) {
      const scrollY = window.scrollY;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.touchAction = 'none';
    } else {
      const scrollY = parseInt(document.body.style.top || '0') * -1;
      document.documentElement.style.overflow = 'unset';
      document.body.style.overflow = 'unset';
      document.body.style.position = 'unset';
      document.body.style.width = 'unset';
      document.body.style.top = 'unset';
      document.body.style.touchAction = 'auto';
      window.scrollTo(0, scrollY);
    }
    return () => {
      document.documentElement.style.overflow = 'unset';
      document.body.style.overflow = 'unset';
      document.body.style.position = 'unset';
      document.body.style.width = 'unset';
      document.body.style.top = 'unset';
      document.body.style.touchAction = 'auto';
    };
  }, [isMenuOpen]);

  // Handle folder tabs horizontal scroll
  const checkScroll = () => {
    if (folderTabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = folderTabsRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scrollTabs = (direction) => {
    if (folderTabsRef.current) {
      const scrollAmount = 200;
      folderTabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 300);
    }
  };

  useEffect(() => {
    checkScroll();
    const tabsElement = folderTabsRef.current;
    if (tabsElement) {
      tabsElement.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        tabsElement.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [folders]);

  // Auto-scroll to pagination when page changes
  useEffect(() => {
    if (paginationRef.current) {
      setTimeout(() => {
        paginationRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [currentPage]);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch both folders and all images
        const trustId = localStorage.getItem('selected_trust_id') || null;
        const allFolders = await fetchGalleryFolders(trustId);
        const all = await fetchAllGalleryImages(trustId);
        const hasUnassigned = all.some((img) => img.folderId === UNASSIGNED_FOLDER_ID);
        const mergedFolders = hasUnassigned && !allFolders.some((f) => f.id === UNASSIGNED_FOLDER_ID)
          ? [{ id: UNASSIGNED_FOLDER_ID, name: 'General', description: null }, ...allFolders]
          : allFolders;

        setFolders(mergedFolders);
        // Do not auto-select a folder - show folder collection grid first
        setImages(all);
        // Debug info removed for production UI
      } catch (err) {
        console.error('Error loading gallery images:', err);
        setError('Could not load gallery photos');
        setImages([]);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const currentFolderName = selectedFolder ?
    folders.find(f => f.id === selectedFolder)?.name : null;

  const filteredImages = useMemo(() => {
    // Only return images when a folder is selected
    if (!selectedFolder) return [];
    return images.filter(img => img.folderId === selectedFolder);
  }, [images, selectedFolder]);

  // Helper to get a cover image for a folder (first image found)
  const getFolderCover = (folder) => {
    return images.find(img => img.folderId === folder.id)?.url || null;
  };

  const totalPages = Math.ceil(filteredImages.length / IMAGES_PER_PAGE);

  const paginatedImages = useMemo(() => {
    const startIndex = (currentPage - 1) * IMAGES_PER_PAGE;
    const endIndex = startIndex + IMAGES_PER_PAGE;
    return filteredImages.slice(startIndex, endIndex);
  }, [filteredImages, currentPage]);

  const handleFolderClick = (folderId) => {
    setSelectedFolder(folderId);
    setCurrentPage(1);

    // Auto-scroll selected button into view
    setTimeout(() => {
      const buttons = folderTabsRef.current?.querySelectorAll('button');
      if (buttons) {
        buttons.forEach(btn => {
          if (btn.textContent.includes(folders.find(f => f.id === folderId)?.name)) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        });
      }
    }, 0);
  };

  const openLightbox = (image) => {
    setSelectedImage(image);
    setIsPlaying(true); // start autoplay when lightbox opens
  };

  const closeLightbox = () => {
    setSelectedImage(null);
    setIsPlaying(false);
  };

  const goToPrevious = () => {
    const currentIndex = filteredImages.findIndex(img => img.id === selectedImage.id);
    const prevIndex = currentIndex === 0 ? filteredImages.length - 1 : currentIndex - 1;
    setSelectedImage(filteredImages[prevIndex]);
  };

  const goToNext = () => {
    const currentIndex = filteredImages.findIndex(img => img.id === selectedImage.id);
    const nextIndex = currentIndex === filteredImages.length - 1 ? 0 : currentIndex + 1;
    setSelectedImage(filteredImages[nextIndex]);
  };

  // Auto-play slider effect
  useEffect(() => {
    if (!isPlaying || !selectedImage) return undefined;
    const id = setInterval(() => {
      // advance to next image
      try {
        goToNext();
      } catch (e) {
        // ignore
      }
    }, SLIDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, selectedImage, filteredImages]);

  const togglePlaying = (e) => {
    e?.stopPropagation();
    setIsPlaying(prev => !prev);
  };

  return (
    <div className={`bg-gradient-to-b from-gray-50 to-white min-h-screen relative${isMenuOpen ? ' overflow-hidden max-h-screen' : ''}`}>
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center justify-between sticky top-0 z-50 shadow-sm mt-6 pointer-events-auto">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors pointer-events-auto"
        >
          {isMenuOpen ? <X className="h-6 w-6 text-gray-700" /> : <Menu className="h-6 w-6 text-gray-700" />}
        </button>
        <h1 className="text-lg font-bold text-gray-800">Gallery</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center text-indigo-600"
            title="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center text-indigo-600"
          >
            <HomeIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="px-4 sm:px-6 pb-10 flex justify-center">
        <div className="w-full max-w-5xl">
          {/* Folder collection grid shown below; removed horizontal tabs per request */}

          {/* Folder Grid (Collections) - show when no folder is open */}
          {!isLoading && folders.length > 0 && !selectedFolder && (
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 mb-8 mt-4">
              {folders.map(folder => {
                const cover = getFolderCover(folder);
                const count = images.filter(img => img.folderId === folder.id).length;
                return (
                  <div
                    key={folder.id}
                    onClick={() => handleFolderClick(folder.id)}
                    className="bg-white rounded-2xl shadow-md overflow-hidden cursor-pointer transition-transform duration-300"
                  >
                    <div className="relative h-40 bg-gray-100 folder-card-cover overflow-hidden">
                      {cover ? (
                        <img src={cover} alt={folder.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <FolderOpen className="h-8 w-8" />
                        </div>
                      )}
                      <div className="folder-count-badge">{count} {count === 1 ? 'photo' : 'photos'}</div>
                    </div>
                    <div className="p-3">
                      <div className="font-semibold text-gray-800 truncate">{folder.name}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Current Folder Title with Image Count + Back */}
          {!isLoading && selectedFolder && currentFolderName && (
            <div className="mb-6 mt-8 flex items-center gap-4">
              <button onClick={() => setSelectedFolder(null)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200">
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-800 capitalize">{currentFolderName}</h2>
                <p className="text-gray-500 text-sm mt-1">{filteredImages.length} {filteredImages.length === 1 ? 'photo' : 'photos'} {totalPages > 1 && `• Page ${currentPage} of ${totalPages}`}</p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl sm:rounded-3xl bg-gray-100 animate-pulse aspect-[4/3]"
                />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="py-16 flex flex-col items-center justify-center">
              <div className="p-4 rounded-full bg-gray-100 mb-4">
                <ImageIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-semibold">{error}</p>
              <p className="text-gray-500 text-sm mt-1">Please try again later.</p>
            </div>
          )}

          {/* Debug panel removed */}

          {/* Images: only show when a folder is selected */}
          {!isLoading && !error && selectedFolder && filteredImages.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
                {paginatedImages.map((image, index) => (
                  <div
                    key={image.id}
                    className="group relative cursor-pointer overflow-hidden rounded-lg bg-gray-100 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 aspect-square animate-fadeIn"
                    style={{
                      animationDelay: `${index * 50}ms`
                    }}
                    onClick={() => openLightbox(image)}
                  >
                    <img
                      src={image.url}
                      alt={image.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.opacity = '0.15';
                      }}
                    />

                    {/* Folder name overlay on thumbnail (bottom-left) */}




                    {/* Mobile tap indicator */}
                    <div className="absolute inset-0 flex items-center justify-center sm:hidden">
                      <div className="p-2 rounded-full bg-white/20 backdrop-blur-sm opacity-0 group-active:opacity-100 transition-opacity">
                        <ImageIcon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div ref={paginationRef} className="flex items-center justify-center gap-2 mt-10 mb-6">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                    title="Previous page"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-lg font-medium transition-all ${currentPage === page
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                    title="Next page"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </>
          ) : (
            !isLoading && !error && selectedFolder && (
              <div className="py-16 flex flex-col items-center justify-center">
                <div className="p-4 rounded-full bg-gray-100 mb-4">
                  <ImageIcon className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-semibold">No photos in this folder</p>
              </div>
            )
          )}
        </div>
      </div>

      <Sidebar
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={onNavigate}
        currentPage="gallery"
      />

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={(e) => { e.stopPropagation(); togglePlaying(e); }}
            className="absolute top-4 left-4 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center"
            title={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>

          {/* Navigation Arrows */}
          <button
            onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Image Container */}
          <div
            className="relative max-w-4xl max-h-[80vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              key={selectedImage.id}
              src={selectedImage.url}
              alt="Gallery"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl transition-transform duration-700 ease-out transform-gpu lightbox-image"
            />

          </div>

          {/* Image Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm">
            <span className="text-white text-sm font-medium">
              {filteredImages.findIndex(img => img.id === selectedImage.id) + 1} / {filteredImages.length}
            </span>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
        .lightbox-image {
          opacity: 0;
          transform: scale(0.98);
          animation: lightboxFade 0.45s ease-out forwards;
        }

        @keyframes lightboxFade {
          from { opacity: 0; transform: scale(0.98) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .folder-card-cover {
          transition: transform 0.35s cubic-bezier(.2,.8,.2,1), box-shadow 0.35s;
        }

        .folder-card-cover:hover {
          transform: translateY(-6px) scale(1.02);
        }

        .folder-count-badge {
          position: absolute;
          right: 10px;
          bottom: 10px;
          background: rgba(0,0,0,0.6);
          color: white;
          padding: 6px 8px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 12px;
        }
        
      `}</style>
    </div>
  );
}

export default Gallery;
