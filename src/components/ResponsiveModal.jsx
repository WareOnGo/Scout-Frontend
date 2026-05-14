import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useViewport } from '../hooks/useViewport';

/**
 * ResponsiveModal Component
 * 
 * A mobile-optimized modal component that automatically adjusts sizing and behavior
 * based on viewport dimensions. Provides proper scrolling, touch-friendly controls,
 * and responsive layout patterns.
 * 
 * Features:
 * - Automatic responsive sizing with proper margins
 * - Touch-friendly close buttons and navigation controls
 * - Proper scrolling behavior for content exceeding viewport height
 * - Keyboard navigation support
 * - Safe area handling for mobile devices
 */
const ResponsiveModal = ({
  visible = false,
  onClose,
  title,
  children,
  width = 'auto',
  maxWidth,
  height = 'auto',
  maxHeight,
  closable = true,
  maskClosable = true,
  className = '',
  style = {},
  bodyStyle = {},
  headerStyle = {},
  ...props
}) => {
  const { isMobile, isTablet } = useViewport();
  const modalRef = useRef(null);
  const contentRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Handle escape key and body scroll lock — only re-run when visible changes
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && onCloseRef.current) {
        onCloseRef.current();
      }
    };

    if (visible) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';

      // Reset scroll once on open
      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.scrollTop = 0;
        }
      }, 0);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [visible]);

  // Focus management for accessibility
  useEffect(() => {
    if (visible && contentRef.current) {
      // Focus the modal content for screen readers
      contentRef.current.focus();
    }
  }, [visible]);

  if (!visible) return null;

  // Calculate responsive dimensions
  const getResponsiveDimensions = () => {
    let modalWidth = width;
    let modalMaxWidth = maxWidth;
    let modalHeight = height;
    let modalMaxHeight = maxHeight;

    if (isMobile) {
      // Full width on mobile with safe margins
      modalWidth = '100%';
      modalMaxWidth = '100%';
      modalMaxHeight = '100vh';
    } else if (isTablet) {
      // Tablet sizing with comfortable margins
      modalWidth = width === 'auto' ? '90%' : width;
      modalMaxWidth = maxWidth || '700px';
      modalMaxHeight = maxHeight || '85vh';
    } else {
      // Desktop sizing
      modalWidth = width === 'auto' ? '95%' : width;
      modalMaxWidth = maxWidth || '900px';
      modalMaxHeight = maxHeight || '90vh';
    }

    return {
      width: modalWidth,
      maxWidth: modalMaxWidth,
      height: modalHeight,
      maxHeight: modalMaxHeight
    };
  };

  const dimensions = getResponsiveDimensions();

  // Modal overlay styles
  const overlayStyles = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 1000,
    overflowY: 'auto',
    // Handle safe areas on mobile devices
    padding: isMobile ? '0' : '40px 20px',
    paddingTop: isMobile ? 'env(safe-area-inset-top, 0)' : '40px',
    paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0)' : '40px',
    ...style
  };

  // Modal content styles
  const contentStyles = {
    width: dimensions.width,
    maxWidth: dimensions.maxWidth,
    height: dimensions.height,
    maxHeight: dimensions.maxHeight,
    background: 'var(--bg-secondary)',
    border: isMobile ? 'none' : '2px solid var(--border-primary)',
    borderRadius: isMobile ? '0' : 'var(--radius-brutal, 6px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    // Ensure modal doesn't exceed viewport on mobile
    minHeight: isMobile ? '100vh' : 'auto',
    // Flex-shrink 0 prevents the flex child from shrinking below its content size
    flexShrink: 0,
    // Remove focus outline
    outline: 'none'
  };

  // Header styles
  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isMobile ? '16px' : '24px',
    borderBottom: '2px solid var(--border-primary)',
    background: 'var(--bg-secondary)',
    // Sticky header on mobile for long content
    position: isMobile ? 'sticky' : 'static',
    top: 0,
    zIndex: 10,
    ...headerStyle
  };

  // Body styles
  const bodyStyles = {
    flex: 1,
    overflow: 'auto',
    padding: isMobile ? '20px' : '24px',
    // Smooth scrolling on mobile
    WebkitOverflowScrolling: 'touch',
    ...bodyStyle
  };

  // Handle mask click
  const handleMaskClick = (event) => {
    if (maskClosable && event.target === modalRef.current && onClose) {
      onClose();
    }
  };

  // Handle content click to prevent event bubbling
  const handleContentClick = (event) => {
    event.stopPropagation();
  };

  return createPortal(
    <div
      ref={modalRef}
      style={overlayStyles}
      onClick={handleMaskClick}
      className={`responsive-modal ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        ref={contentRef}
        style={contentStyles}
        onClick={handleContentClick}
        tabIndex={-1}
        {...props}
      >
        {/* Header */}
        {(title || closable) && (
          <div style={headerStyles}>
            {title && (
              <h3
                id="modal-title"
                style={{
                  margin: 0,
                  color: 'var(--text-primary)',
                  fontSize: isMobile ? '18px' : '20px',
                  fontWeight: 600,
                  flex: 1
                }}
              >
                {title}
              </h3>
            )}
            {closable && (
              <button
                type="button"
                className="responsive-modal__close"
                onClick={onClose}
                aria-label="Close modal"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div style={bodyStyles}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ResponsiveModal;