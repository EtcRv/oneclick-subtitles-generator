import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import '../../styles/settings/customModelDialog.css';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Custom Modal Dialog Component
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function called when modal is closed
 * @param {string} props.title - Modal title
 * @param {React.ReactNode} props.children - Modal content
 * @param {React.ReactNode} props.footer - Modal footer
 * @returns {JSX.Element|null} - Rendered component or null if not open
 */
const CustomModelDialog = ({ isOpen, onClose, title, children, footer }) => {
  const modalRef = useRef(null);

  // Handle click outside to close
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key to close
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();

      // Prevent scrolling of the body when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      // Re-enable scrolling when modal is closed
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Create a portal to render the modal at the root level of the DOM
  return ReactDOM.createPortal(
    <div className="custom-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="custom-modal"
        ref={modalRef}
        tabIndex="-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="custom-modal-header">
          <h4 className="custom-modal-title">{title}</h4>
          <button className="close-button" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="custom-modal-content">
          {children}
        </div>
        {footer && (
          <div className="custom-modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body // Render directly in the body element
  );
};

export default CustomModelDialog;
