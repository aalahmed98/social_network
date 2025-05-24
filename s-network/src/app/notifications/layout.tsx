import Sidebar from "@/app/components/Sidebar";
import Navbar from "@/app/components/Navbar";

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-64">
        <Navbar />
        <main className="pt-16 pb-8 px-4">{children}</main>
      </div>
    </div>
  );
}
