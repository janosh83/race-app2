import React, { useEffect } from 'react';

/**
 * Toast component for non-blocking notifications
 * @param {Object} props
 * @param {string} props.message - The message to display
 * @param {string} props.type - The type: 'error', 'warning', 'success', 'info'
 * @param {function} props.onClose - Callback when toast is dismissed
 * @param {number} props.duration - Auto-dismiss duration in ms (default: 5000, 0 for no auto-dismiss)
 */
function Toast({ message, type = 'info', onClose, duration = 5000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const bgColorMap = {
    error: '#dc3545',
    warning: '#ffc107',
    success: '#28a745',
    info: '#17a2b8'
  };

  const textColorMap = {
    error: '#fff',
    warning: '#000',
    success: '#fff',
    info: '#fff'
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: bgColorMap[type] || bgColorMap.info,
        color: textColorMap[type] || textColorMap.info,
        padding: '12px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 10000,
        maxWidth: '400px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      <div style={{ flex: 1 }}>{message}</div>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          fontSize: '20px',
          cursor: 'pointer',
          padding: '0 4px',
          lineHeight: 1
        }}
        aria-label="Close"
      >
        ×
      </button>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default Toast;
