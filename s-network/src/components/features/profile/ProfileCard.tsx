import React from "react";
import Image from "next/image";
import Link from "next/link";
import { FiUser, FiMail, FiCalendar } from "react-icons/fi";

interface ProfileCardProps {
  userId: number;
  firstName: string;
  lastName: string;
  nickname?: string;
  avatar?: string;
  email?: string;
  joinDate?: string;
  isPublic?: boolean;
  aboutMe?: string;
  compact?: boolean;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
  userId,
  firstName,
  lastName,
  nickname,
  avatar,
  email,
  joinDate,
  isPublic = true,
  aboutMe,
  compact = false,
}) => {
  const fullName = `${firstName} ${lastName}`;
  const displayName = nickname ? `${nickname} (${fullName})` : fullName;

  const getAvatarUrl = (path?: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    if (path.startsWith("/")) {
      return `${backendUrl}${path}`;
    }
    return `${backendUrl}/${path}`;
  };

  const createAvatarFallback = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-md overflow-hidden ${
        compact ? "p-3" : "p-5"
      }`}
    >
      <div className="flex items-center">
        <div
          className={`${
            compact ? "w-12 h-12" : "w-16 h-16"
          } relative rounded-full overflow-hidden bg-gray-200 mr-4`}
        >
          {avatar ? (
            <Image
              src={getAvatarUrl(avatar)}
              alt={fullName}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white text-lg font-semibold">
              {createAvatarFallback(fullName)}
            </div>
          )}
        </div>

        <div className="flex-1">
          <Link href={`/profile/${userId}`}>
            <h3
              className={`${
                compact ? "text-base" : "text-xl"
              } font-semibold text-gray-800 hover:text-blue-600`}
            >
              {displayName}
            </h3>
          </Link>

          {!compact && aboutMe && (
            <p className="text-gray-600 mt-1 line-clamp-2">{aboutMe}</p>
          )}

          {!compact && (
            <div className="mt-3 flex flex-wrap gap-y-2">
              {email && (
                <div className="flex items-center text-sm text-gray-500 mr-4">
                  <FiMail className="mr-1" />
                  <span>{email}</span>
                </div>
              )}

              {joinDate && (
                <div className="flex items-center text-sm text-gray-500">
                  <FiCalendar className="mr-1" />
                  <span>Joined {new Date(joinDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;
