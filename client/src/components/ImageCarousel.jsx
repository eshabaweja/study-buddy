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
    <div className="ba-carousel">
      <div className="ba-carousel__container">
        <img
          src={images[currentIndex]}
          alt={`Slide ${currentIndex + 1}`}
          className="ba-carousel__image ba-interactive"
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
            className="bux-button bux-button--alt ba-carousel__nav-button ba-carousel__nav-button--prev"
            aria-label="Previous slide"
          >
            ←
          </button>
          <button
            onClick={nextSlide}
            className="bux-button bux-button--alt ba-carousel__nav-button ba-carousel__nav-button--next"
            aria-label="Next slide"
          >
            →
          </button>
          <div className="ba-carousel__indicators">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`ba-carousel__indicator ${currentIndex === index ? 'ba-carousel__indicator--active' : ''}`}
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