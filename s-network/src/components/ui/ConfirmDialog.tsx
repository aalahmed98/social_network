"use client";

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmDialogProps) {
  const variants = {
    danger: {
      icon: "🗑️",
      iconBg: "bg-gradient-to-r from-red-500 to-red-600",
      confirmBtn:
        "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
      titleColor: "text-red-800",
      messageColor: "text-red-700",
      bgGradient: "from-red-50 to-pink-50",
      borderColor: "border-red-200",
    },
    warning: {
      icon: "⚠️",
      iconBg: "bg-gradient-to-r from-yellow-500 to-orange-500",
      confirmBtn:
        "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600",
      titleColor: "text-yellow-800",
      messageColor: "text-yellow-700",
      bgGradient: "from-yellow-50 to-orange-50",
      borderColor: "border-yellow-200",
    },
    info: {
      icon: "ℹ️",
      iconBg: "bg-gradient-to-r from-blue-500 to-cyan-500",
      confirmBtn:
        "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600",
      titleColor: "text-blue-800",
      messageColor: "text-blue-700",
      bgGradient: "from-blue-50 to-cyan-50",
      borderColor: "border-blue-200",
    },
  };

  const currentVariant = variants[variant];

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`bg-gradient-to-br ${currentVariant.bgGradient} rounded-2xl shadow-2xl p-6 border-2 ${currentVariant.borderColor} backdrop-blur-sm mx-4`}
              >
                {/* Icon */}
                <div className="text-center mb-4">
                  <div
                    className={`${currentVariant.iconBg} rounded-full w-16 h-16 mx-auto flex items-center justify-center shadow-lg`}
                  >
                    <span className="text-2xl">{currentVariant.icon}</span>
                  </div>
                </div>

                {/* Title */}
                <Dialog.Title
                  className={`text-xl font-bold text-center ${currentVariant.titleColor} mb-3`}
                >
                  {title}
                </Dialog.Title>

                {/* Message */}
                <Dialog.Description
                  className={`text-center ${currentVariant.messageColor} mb-6 leading-relaxed`}
                >
                  {message}
                </Dialog.Description>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="flex-1 px-6 py-3 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 border-2 border-gray-200 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-md hover:shadow-lg"
                  >
                    {cancelText}
                  </button>
                  <button
                    onClick={onConfirm}
                    disabled={isLoading}
                    className={`flex-1 px-6 py-3 text-sm font-semibold text-white ${currentVariant.confirmBtn} rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl`}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      confirmText
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
