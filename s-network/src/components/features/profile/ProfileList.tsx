import React from "react";
import ProfileCard from "./ProfileCard";

interface User {
  id: number;
  first_name: string;
  last_name: string;
  nickname?: string;
  avatar?: string;
  email?: string;
  created_at?: string;
  is_public?: boolean;
  about_me?: string;
}

interface ProfileListProps {
  users: User[];
  title?: string;
  emptyMessage?: string;
  compact?: boolean;
}

const ProfileList: React.FC<ProfileListProps> = ({
  users,
  title = "Profiles",
  emptyMessage = "No profiles to display",
  compact = false,
}) => {
  if (!users || users.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        <p className="text-gray-500 text-center py-6">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="space-y-4">
        {users.map((user) => (
          <ProfileCard
            key={user.id}
            userId={user.id}
            firstName={user.first_name}
            lastName={user.last_name}
            nickname={user.nickname}
            avatar={user.avatar}
            email={user.email}
            joinDate={user.created_at}
            isPublic={user.is_public}
            aboutMe={user.about_me}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
};

export default ProfileList;
