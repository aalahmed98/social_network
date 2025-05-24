"use client";

import { useState } from "react";
import { FaCalendarAlt, FaCheck, FaTimes, FaUsers } from "react-icons/fa";

interface EventProps {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  responses: {
    going: number;
    notGoing: number;
  };
  userResponse?: "going" | "notGoing" | null;
  onRespond: (eventId: string, response: "going" | "notGoing" | null) => void;
}

export default function GroupEvent({
  id,
  title,
  description,
  date,
  time,
  responses,
  userResponse,
  onRespond,
}: EventProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="border rounded-lg bg-white shadow-sm overflow-hidden mb-4">
      <div className="p-4">
        <div className="flex items-start">
          <div className="bg-indigo-100 p-3 rounded-lg text-indigo-600 mr-3">
            <FaCalendarAlt size={20} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold text-lg text-gray-900">{title}</h3>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {isExpanded ? "Show less" : "Show more"}
              </button>
            </div>
            <div className="mt-1 flex items-center text-sm text-gray-600">
              <span>{formatDate(date)}</span>
              <span className="mx-2">•</span>
              <span>{time}</span>
            </div>

            {isExpanded && <p className="mt-3 text-gray-700">{description}</p>}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  onRespond(id, userResponse === "going" ? null : "going")
                }
                className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                  userResponse === "going"
                    ? "bg-green-100 text-green-700 border border-green-300"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <FaCheck size={14} />
                <span>Going</span>
                <span className="ml-1 bg-white px-1.5 py-0.5 rounded-full text-xs">
                  {responses.going + (userResponse === "going" ? 1 : 0)}
                </span>
              </button>

              <button
                onClick={() =>
                  onRespond(id, userResponse === "notGoing" ? null : "notGoing")
                }
                className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                  userResponse === "notGoing"
                    ? "bg-red-100 text-red-700 border border-red-300"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <FaTimes size={14} />
                <span>Not Going</span>
                <span className="ml-1 bg-white px-1.5 py-0.5 rounded-full text-xs">
                  {responses.notGoing + (userResponse === "notGoing" ? 1 : 0)}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 py-3 bg-gray-50 border-t flex items-center">
          <div className="flex items-center text-sm text-gray-600">
            <FaUsers className="mr-2" size={14} />
            <span>{responses.going} people going</span>
          </div>
        </div>
      )}
    </div>
  );
}
