import { Outlet } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ShopClosedBanner } from "@/components/layout/ShopClosedBanner";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";

export function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ShopClosedBanner />
      <AnnouncementBar />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
