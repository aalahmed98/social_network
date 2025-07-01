"use client";

import React from "react";
import { motion } from "framer-motion";

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  padding?: "none" | "sm" | "md" | "lg";
  centerContent?: boolean;
  mobileFullWidth?: boolean;
  animation?: boolean;
}

const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  className = "",
  maxWidth = "lg",
  padding = "md",
  centerContent = false,
  mobileFullWidth = true,
  animation = true,
}) => {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    full: "max-w-full",
  };

  const paddingClasses = {
    none: "",
    sm: "p-2 md:p-4",
    md: "p-4 md:p-6",
    lg: "p-6 md:p-8",
  };

  const containerClasses = `
    ${maxWidthClasses[maxWidth]}
    ${paddingClasses[padding]}
    ${mobileFullWidth ? "w-full md:w-auto" : "w-auto"}
    ${centerContent ? "mx-auto" : ""}
    ${className}
  `;

  const content = <div className={containerClasses}>{children}</div>;

  if (animation) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={containerClasses}
      >
        {children}
      </motion.div>
    );
  }

  return content;
};

export default ResponsiveContainer;
