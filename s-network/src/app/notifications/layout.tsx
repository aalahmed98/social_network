import { Sidebar, MinimalSidebar, Navbar } from "@/components/layout";

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Show minimal sidebar on mobile, full sidebar on desktop */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="md:hidden">
        <MinimalSidebar />
      </div>
      <div className="ml-16 md:ml-64">
        <Navbar />
        <main className="pt-16 pb-8 px-4">{children}</main>
      </div>
    </div>
  );
}
