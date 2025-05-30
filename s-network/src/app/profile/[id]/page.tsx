// Server Component wrapper
import { Suspense } from "react";
import ProfileClientPage from "./client";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={<div>Loading profile...</div>}>
      <ProfileClientPage id={id} />
    </Suspense>
  );
}
