import { useState } from 'react';
import ImageModal from './ImageModal';

const ImageCarousel = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div className="app-carousel">
      <div className="app-carousel__container">
        <img
          src={images[currentIndex]}
          alt={`Slide ${currentIndex + 1}`}
          className="app-carousel__image app-interactive"
          onClick={() => setSelectedImage({
            url: images[currentIndex],
            alt: `Slide ${currentIndex + 1}`
          })}
        />
      </div>
      
      {images.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="sb-button sb-button--alt app-carousel__nav-button app-carousel__nav-button--prev"
            aria-label="Previous slide"
          >
            ←
          </button>
          <button
            onClick={nextSlide}
            className="sb-button sb-button--alt app-carousel__nav-button app-carousel__nav-button--next"
            aria-label="Next slide"
          >
            →
          </button>
          <div className="app-carousel__indicators">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`app-carousel__indicator ${currentIndex === index ? 'app-carousel__indicator--active' : ''}`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}

      <ImageModal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageUrl={selectedImage?.url || ''}
        altText={selectedImage?.alt || ''}
      />
    </div>
  );
};

export default ImageCarousel; 