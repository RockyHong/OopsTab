import React, { Fragment } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        ></div>

        {/* Modal content */}
        <div className="inline-block align-bottom bg-white rounded-xl p-6 text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {title && (
            <div className="mb-4">
              <h3 className="text-lg font-heading font-medium text-primary">
                {title}
              </h3>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
