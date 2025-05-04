// app/users/[id]/page.tsx
"use client";

import React from "react";
import ProfileViewOnly from "@/app/components/ProfileViewOnly";

export default function UserProfilePage({
  params,
}: {
  params: { id: string };
}) {
  // Unwrap the params Promise using React.use()
  const unwrappedParams = React.use(params);

  return <ProfileViewOnly userId={Number(unwrappedParams.id)} />;
}
