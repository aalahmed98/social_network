"use client";

import React from "react";
import { ProfileViewOnly } from "@/components/features/profile";

export default function ProfileClientPage({ id }: { id: string }) {
  const userId = Number(id);
  return <ProfileViewOnly userId={userId} />;
}
