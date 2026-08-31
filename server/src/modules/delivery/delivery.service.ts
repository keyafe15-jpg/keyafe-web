import { prisma } from "../../config/db.js";

type DeliveryDistrict = "KOLKATA" | "HOWRAH" | "HOOGHLY";

export interface PincodeUnserviceable {
  serviceable: false;
}

export interface PincodeServiceable {
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
}

export type PincodeCheck = PincodeServiceable | PincodeUnserviceable;

export async function checkPincode(pincode: string): Promise<PincodeCheck> {
  const zone = await prisma.deliveryPincode.findUnique({
    where: { pincode },
  });
  if (!zone || !zone.isActive) return { serviceable: false };

  return toPincodeServiceable(zone);
}

function toPincodeServiceable(zone: {
  pincode: string;
  city: string;
  area: string | null;
  district: DeliveryDistrict;
  deliveryFee: unknown;
  sameDayEligible: boolean;
  expressEligible: boolean;
  expressDeliveryFee: unknown | null;
  minOrderAmount: unknown | null;
  extraLeadHours: number;
}): PincodeServiceable {
  return {
    serviceable: true,
    pincode: zone.pincode,
    city: zone.city,
    area: zone.area,
    district: zone.district,
    deliveryFee: Number(zone.deliveryFee),
    sameDayEligible: zone.sameDayEligible,
    expressEligible: zone.expressEligible,
    expressDeliveryFee: zone.expressDeliveryFee
      ? Number(zone.expressDeliveryFee)
      : null,
    minOrderAmount: zone.minOrderAmount ? Number(zone.minOrderAmount) : null,
    extraLeadHours: zone.extraLeadHours,
  };
}
