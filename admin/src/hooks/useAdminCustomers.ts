import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface AdminCustomer {
  id: string;
  userId: string | null;
  name: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  isRegistered: boolean;
  isOrderOnly: boolean;
  phoneVerifiedAt: string | null;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  linkedOrderCount: number;
  totalOrderCount: number;
  guestCheckoutCount: number;
  totalSpent: number;
  nameVariants: string[];
  emailVariants: string[];
  phoneVariants: string[];
  hasMixedContactInfo: boolean;
}

export interface AdminCustomersPage {
  items: AdminCustomer[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type CustomerActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";
export type CustomerRegisteredFilter = "ALL" | "REGISTERED" | "GUEST";

export interface AdminCustomersFilter {
  page?: number;
  pageSize?: number;
  search?: string | null;
  active?: CustomerActiveFilter;
  registered?: CustomerRegisteredFilter;
}

export interface AdminCustomerAddress {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  mapSearchQuery: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface AdminCustomerOrderRow {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  fulfillment: string;
  deliveryAddress: unknown;
  subtotal: string;
  deliveryFee: string;
  total: string;
  status: string;
  paymentStatus: string;
  source: string;
  createdAt: string;
  itemCount: number;
  isGuestCheckout: boolean;
}

export interface AdminCustomerDetail {
  id: string;
  userId: string | null;
  isOrderOnly: boolean;
  profile: {
    name: string;
    phone: string;
    email: string | null;
    isActive: boolean;
    isRegistered: boolean;
    phoneVerifiedAt: string | null;
    emailVerifiedAt: string | null;
    lastLoginAt: string | null;
    createdAt: string;
  } | null;
  contactVariants: {
    names: string[];
    emails: string[];
    phones: string[];
  };
  addresses: AdminCustomerAddress[];
  stats: {
    totalOrders: number;
    linkedOrders: number;
    guestCheckoutOrders: number;
    totalSpent: number;
  };
  orders: AdminCustomerOrderRow[];
}

export function useAdminCustomers({
  page = 1,
  pageSize = 20,
  search = null,
  active = "ALL",
  registered = "ALL",
}: AdminCustomersFilter = {}) {
  const q = search?.trim() ?? "";
  const activeParam = active === "ACTIVE" ? "true" : active === "INACTIVE" ? "false" : null;
  const registeredParam =
    registered === "REGISTERED" ? "true" : registered === "GUEST" ? "false" : null;

  return useQuery<AdminCustomersPage>({
    queryKey: ["admin", "customers", page, pageSize, q, active, registered],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (q) params.set("search", q);
      if (activeParam) params.set("active", activeParam);
      if (registeredParam) params.set("registered", registeredParam);
      return api.get<AdminCustomersPage>(`/admin/customers?${params}`);
    },
    staleTime: 30_000,
  });
}

export interface OrderCustomerLookupAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  mapSearchQuery: string;
  city: string;
  state: string;
  pincode: string;
  deliveryFee?: number | null;
  deliveryPaidToRider?: boolean | null;
}

export interface OrderCustomerLookupHit {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  companyName: string | null;
  gstin: string | null;
  lastDeliveryFee?: number | null;
  lastDeliveryPaidToRider?: boolean | null;
  addresses: OrderCustomerLookupAddress[];
}

export function useOrderCustomerLookup(query: string) {
  const q = query.trim();
  const digits = q.replace(/\D/g, "");
  const enabled = q.length >= 3 || digits.length >= 6;

  return useQuery<OrderCustomerLookupHit[]>({
    queryKey: ["admin", "customers", "lookup", q],
    queryFn: () =>
      api.get<OrderCustomerLookupHit[]>(`/admin/customers/lookup?q=${encodeURIComponent(q)}`),
    enabled,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

export function useAdminCustomerDetail(id: string | null) {
  return useQuery<AdminCustomerDetail>({
    queryKey: ["admin", "customer", id],
    queryFn: () => api.get<AdminCustomerDetail>(`/admin/customers/${encodeURIComponent(id!)}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}
