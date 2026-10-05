import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "@/layouts/RootLayout";
import { HomePage } from "@/pages/HomePage";
import { CategoryPage } from "@/pages/CategoryPage";
import { StorePage } from "@/pages/StorePage";
import { ProductPage } from "@/pages/ProductPage";
import { CartPage } from "@/pages/CartPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { OrderSuccessPage } from "@/pages/OrderSuccessPage";
import { GetQuotePage } from "@/pages/GetQuotePage";
import { SameDayPage } from "@/pages/SameDayPage";
import { HealthyPage } from "@/pages/HealthyPage";
import { PanIndiaPage } from "@/pages/PanIndiaPage";
import { TagPage } from "@/pages/TagPage";
import { SearchPage } from "@/pages/SearchPage";
import { SavedAddressesPage } from "@/pages/SavedAddressesPage";
import { MyOrdersPage } from "@/pages/MyOrdersPage";
import { AboutPage } from "@/pages/AboutPage";
import { CancellationPolicyPage } from "@/pages/CancellationPolicyPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { OrderLinkPage } from "@/pages/OrderLinkPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "category/:slug", element: <CategoryPage /> },
      { path: "store/:slug", element: <StorePage /> },
      { path: "product/:slug", element: <ProductPage /> },
      { path: "cart", element: <CartPage /> },
      { path: "checkout", element: <CheckoutPage /> },
      { path: "order/:id/success", element: <OrderSuccessPage /> },
      { path: "get-quote", element: <GetQuotePage /> },
      { path: "same-day", element: <SameDayPage /> },
      { path: "healthy", element: <HealthyPage /> },
      { path: "pan-india", element: <PanIndiaPage /> },
      { path: "tag/:slug", element: <TagPage /> },
      { path: "search", element: <SearchPage /> },
      { path: "about", element: <AboutPage /> },
      { path: "cancellation-policy", element: <CancellationPolicyPage /> },
      { path: "privacy", element: <PrivacyPage /> },
      { path: "saved-addresses", element: <SavedAddressesPage /> },
      { path: "my-orders", element: <MyOrdersPage /> },
      { path: "o/:token", element: <OrderLinkPage /> },
      { path: "reset-password", element: <ResetPasswordPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
