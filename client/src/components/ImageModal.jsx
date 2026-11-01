import { createPortal } from 'react-dom';

const ImageModal = ({ isOpen, onClose, imageUrl, altText }) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="ba-modal-overlay"
      onClick={onClose}
    >
      <div
        className="ba-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={altText}
          className="ba-modal-image"
        />
        <button
          type="button"
          onClick={onClose}
          className="ba-modal-close-button"
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default ImageModal;
