import { create } from "zustand";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";

export interface SavedAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  mapSearchQuery: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface AddressState {
  addresses: SavedAddress[];
  loading: boolean;
  error: string | null;
  fetchAddresses: () => Promise<void>;
  addAddress: (
    address: Omit<SavedAddress, "id" | "createdAt" | "updatedAt"> & {
      id?: string;
    },
  ) => Promise<SavedAddress | undefined>;
  removeAddress: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useSavedAddresses = create<AddressState>()((set, get) => ({
  addresses: [],
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchAddresses: async () => {
    const token = useAuth.getState().accessToken;
    if (!token) {
      set({ addresses: [], error: "Please log in to view saved addresses" });
      return;
    }

    set({ loading: true, error: null });
    try {
      const data = await api.get<SavedAddress[]>("/addresses", {
        headers: { Authorization: `Bearer ${token}` },
      });
      set({ addresses: data, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Unable to load addresses",
      });
    }
  },

  addAddress: async (address) => {
    const token = useAuth.getState().accessToken;
    if (!token) {
      set({ error: "Please log in to save an address" });
      return undefined;
    }

    set({ loading: true, error: null });
    try {
      const payload = {
        ...address,
        label: address.label || "Home",
        isDefault: address.isDefault ?? get().addresses.length === 0,
      };

      const created = await api.post<SavedAddress>("/addresses", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      set((state) => ({
        addresses: created.isDefault
          ? [
              created,
              ...state.addresses.filter((item) => item.id !== created.id),
            ]
          : [...state.addresses, created],
        loading: false,
      }));

      return created;
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Unable to save address",
      });
      return undefined;
    }
  },

  removeAddress: async (id) => {
    const token = useAuth.getState().accessToken;
    if (!token) return;

    set({ loading: true, error: null });
    try {
      await api.delete<{ success: boolean; id: string }>(`/addresses/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      set((state) => ({
        addresses: state.addresses.filter((address) => address.id !== id),
        loading: false,
      }));
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Unable to remove address",
      });
    }
  },

  setDefault: async (id) => {
    const token = useAuth.getState().accessToken;
    if (!token) return;

    set({ loading: true, error: null });
    try {
      const updated = await api.patch<SavedAddress>(
        `/addresses/${id}/default`,
        undefined,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      set((state) => ({
        addresses: state.addresses
          .map((address) => ({
            ...address,
            isDefault: address.id === updated.id,
          }))
          .sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
        loading: false,
      }));
    } catch (err) {
      set({
        loading: false,
        error:
          err instanceof Error
            ? err.message
            : "Unable to update default address",
      });
    }
  },
}));
