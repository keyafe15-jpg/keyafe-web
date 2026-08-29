import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "@/layouts/RootLayout";
import { HomePage } from "@/pages/HomePage";
import { CategoryPage } from "@/pages/CategoryPage";
import { ProductPage } from "@/pages/ProductPage";
import { CartPage } from "@/pages/CartPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { OrderSuccessPage } from "@/pages/OrderSuccessPage";
import { GetQuotePage } from "@/pages/GetQuotePage";
import { SameDayPage } from "@/pages/SameDayPage";
import { HealthyPage } from "@/pages/HealthyPage";
import { SavedAddressesPage } from "@/pages/SavedAddressesPage";
import { MyOrdersPage } from "@/pages/MyOrdersPage";
import { AboutPage } from "@/pages/AboutPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { OrderLinkPage } from "@/pages/OrderLinkPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "category/:slug", element: <CategoryPage /> },
      { path: "product/:slug", element: <ProductPage /> },
      { path: "cart", element: <CartPage /> },
      { path: "checkout", element: <CheckoutPage /> },
      { path: "order/:id/success", element: <OrderSuccessPage /> },
      { path: "get-quote", element: <GetQuotePage /> },
      { path: "same-day", element: <SameDayPage /> },
      { path: "healthy", element: <HealthyPage /> },
      { path: "about", element: <AboutPage /> },
      { path: "saved-addresses", element: <SavedAddressesPage /> },
      { path: "my-orders", element: <MyOrdersPage /> },
      { path: "o/:token", element: <OrderLinkPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
