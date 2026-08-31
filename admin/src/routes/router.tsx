import { createBrowserRouter } from "react-router-dom";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { StubPage } from "@/pages/StubPage";
import { ProductsListPage } from "@/pages/products/ProductsListPage";
import { ProductFormPage } from "@/pages/products/ProductFormPage";
import { FlavoursPage } from "@/pages/flavours/FlavoursPage";
import { CakeSizesPage } from "@/pages/cake-sizes/CakeSizesPage";
import { CategoriesPage } from "@/pages/categories/CategoriesPage";
import { ToppingsPage } from "@/pages/toppings/ToppingsPage";
import { OrdersListPage } from "@/pages/orders/OrdersListPage";
import { OrderDetailPage } from "@/pages/orders/OrderDetailPage";
import { OrderLinksListPage } from "@/pages/order-links/OrderLinksListPage";
import { OrderLinkFormPage } from "@/pages/order-links/OrderLinkFormPage";
import { OfflineOrderDirectFormPage } from "@/pages/order-links/OfflineOrderDirectFormPage";
import { DeliveryPincodesPage } from "@/pages/delivery/DeliveryPincodesPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <AdminLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: "orders",
        element: <OrdersListPage />,
      },
      {
        path: "orders/:idOrNumber",
        element: <OrderDetailPage />,
      },
      {
        path: "offline-orders",
        element: <OrderLinksListPage />,
      },
      {
        path: "offline-orders/new",
        element: <OrderLinkFormPage />,
      },
      {
        path: "offline-orders/place",
        element: <OfflineOrderDirectFormPage />,
      },
      {
        path: "offline-orders/:id/edit",
        element: <OrderLinkFormPage />,
      },
      {
        path: "quotes",
        element: (
          <StubPage
            title="Quote Requests"
            subtitle="Custom-design requests from the storefront."
          />
        ),
      },
      {
        path: "products",
        element: <ProductsListPage />,
      },
      {
        path: "products/new",
        element: <ProductFormPage />,
      },
      {
        path: "products/:id",
        element: <ProductFormPage />,
      },
      {
        path: "categories",
        element: <CategoriesPage />,
      },
      {
        path: "flavours",
        element: <FlavoursPage />,
      },
      {
        path: "cake-sizes",
        element: <CakeSizesPage />,
      },
      {
        path: "toppings",
        element: <ToppingsPage />,
      },
      {
        path: "same-day",
        element: (
          <StubPage
            title="Same-Day Store"
            subtitle="Hours, kill switch, exceptions."
          />
        ),
      },
      {
        path: "same-day/categories",
        element: (
          <StubPage
            title="Same-Day Categories"
            subtitle="Ready-to-grab menu structure."
          />
        ),
      },
      {
        path: "coupons",
        element: <StubPage title="Coupons" subtitle="Discount codes." />,
      },
      {
        path: "delivery",
        element: <DeliveryPincodesPage />,
      },
      {
        path: "users",
        element: (
          <StubPage
            title="Users & Roles"
            subtitle="Staff accounts + permission grants."
          />
        ),
      },
      {
        path: "settings",
        element: (
          <StubPage title="Settings" subtitle="Business, GST, invoicing." />
        ),
      },
    ],
  },
]);
