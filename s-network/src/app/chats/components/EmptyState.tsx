"use client";

import { FaComments } from "react-icons/fa";

interface EmptyStateProps {
  title: string;
  description: string;
}

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <FaComments size={40} />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-500">{description}</p>
      </div>
    </div>
  );
}
