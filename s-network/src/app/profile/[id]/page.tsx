// app/users/[id]/page.tsx
"use client";

import ProfileViewOnly from "@/app/components/ProfileViewOnly";

export default function UserProfilePage({ params }: { params: { id: string } }) {
  return <ProfileViewOnly userId={Number(params.id)} />;
}
