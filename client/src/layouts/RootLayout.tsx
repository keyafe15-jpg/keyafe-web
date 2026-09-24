import { Outlet, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ShopClosedBanner } from "@/components/layout/ShopClosedBanner";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";

/**
 * Routes that must never be indexed. `/o/` links are tokenised order links, so
 * that one is a privacy matter rather than only an SEO preference.
 */
const PRIVATE_PATH_PREFIXES = [
  "/o/",
  "/cart",
  "/checkout",
  "/my-orders",
  "/saved-addresses",
  "/order/",
];

export function RootLayout() {
  const { pathname } = useLocation();
  const isPrivate = PRIVATE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isCustomLink = pathname.startsWith("/o/");
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      {/* React 19 hoists this into <head>. */}
      {isPrivate && <meta name="robots" content="noindex,nofollow" />}
      <ShopClosedBanner />
      <AnnouncementBar />
      <Header isCustomLink={isCustomLink} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
