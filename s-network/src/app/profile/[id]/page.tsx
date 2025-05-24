// Server Component wrapper
import { Suspense } from "react";
import ProfileClientPage from "./client";

export default function UserProfilePage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense fallback={<div>Loading profile...</div>}>
      <ProfileClientPage id={params.id} />
    </Suspense>
  );
}
