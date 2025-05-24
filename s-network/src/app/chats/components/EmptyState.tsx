"use client";

import React from "react";
import { FiMessageSquare } from "react-icons/fi";

interface EmptyStateProps {
  title: string;
  description: string;
}

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 bg-gray-50">
      <div className="p-6 rounded-full bg-blue-50 mb-4">
        <FiMessageSquare className="h-12 w-12 text-blue-500" />
      </div>
      <h3 className="text-xl font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-center max-w-md">{description}</p>
    </div>
  );
}
