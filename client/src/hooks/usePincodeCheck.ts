import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type PincodeCheckResult =
  | { serviceable: false }
  | {
      serviceable: true;
      pincode: string;
      city: string;
      area: string | null;
      district: "KOLKATA" | "HOWRAH" | "HOOGHLY";
      deliveryFee: number;
      sameDayEligible: boolean;
      expressEligible: boolean;
      expressDeliveryFee: number | null;
      minOrderAmount: number | null;
      extraLeadHours: number;
    };

export function usePincodeCheck() {
  return useMutation<PincodeCheckResult, Error, string>({
    mutationFn: (pincode: string) =>
      api.get<PincodeCheckResult>(`/delivery/check-pincode/${pincode}`),
  });
}
