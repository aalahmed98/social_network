// app/users/[id]/page.tsx
"use client";

import React from "react";
import ProfileViewOnly from "@/app/components/ProfileViewOnly";

export default function UserProfilePage({
  params,
}: {
  params: { id: string };
}) {
  // No need to unwrap params in client components
  return <ProfileViewOnly userId={Number(params.id)} />;
}
