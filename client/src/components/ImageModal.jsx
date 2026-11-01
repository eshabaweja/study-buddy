import { createPortal } from 'react-dom';

const ImageModal = ({ isOpen, onClose, imageUrl, altText }) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="app-modal-overlay"
      onClick={onClose}
    >
      <div
        className="app-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={altText}
          className="app-modal-image"
        />
        <button
          type="button"
          onClick={onClose}
          className="app-modal-close-button"
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default ImageModal;
