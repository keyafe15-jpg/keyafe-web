import type { DeliveryPincode } from "@prisma/client";
import { prisma } from "../../config/db.js";

type DeliveryDistrict = DeliveryPincode["district"];

const METRO_PREFIX: Record<string, { city: string; district: DeliveryDistrict }> = {
  "700": { city: "Kolkata", district: "KOLKATA" },
  "711": { city: "Howrah", district: "HOWRAH" },
  "712": { city: "Hooghly", district: "HOOGHLY" },
};

const METRO_PREFIXES = Object.keys(METRO_PREFIX);

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
  if (zone) {
    if (!zone.isActive) return { serviceable: false };
    return toPincodeServiceable(zone);
  }

  const meta = METRO_PREFIX[pincode.slice(0, 3)];
  if (!meta) return { serviceable: false };

  const nearest = await findNearestActiveMetro(pincode);
  if (!nearest) return { serviceable: false };

  const city =
    pincode.startsWith("712") && nearest.pincode.startsWith("712") ? nearest.city : meta.city;

  const saved = await prisma.deliveryPincode.upsert({
    where: { pincode },
    create: {
      pincode,
      city,
      area: null,
      district: meta.district,
      deliveryFee: nearest.deliveryFee,
      sameDayEligible: nearest.sameDayEligible,
      minOrderAmount: nearest.minOrderAmount,
      extraLeadHours: nearest.extraLeadHours,
      notes: `Auto-added; fee copied from ${nearest.pincode}. Confirm area/fee.`,
      isActive: true,
      expressEligible: nearest.expressEligible,
      expressDeliveryFee: nearest.expressDeliveryFee,
    },
    // A concurrent check or admin create won the race — keep that row as-is.
    update: {},
  });

  if (!saved.isActive) return { serviceable: false };
  return toPincodeServiceable(saved);
}

async function findNearestActiveMetro(pincode: string): Promise<DeliveryPincode | null> {
  const prefix = pincode.slice(0, 3);
  const samePrefix = await prisma.deliveryPincode.findMany({
    where: { isActive: true, pincode: { startsWith: prefix } },
  });
  const nearestSame = pickNearestPincode(pincode, samePrefix);
  if (nearestSame) return nearestSame;

  const metro = await prisma.deliveryPincode.findMany({
    where: {
      isActive: true,
      OR: METRO_PREFIXES.map((p) => ({ pincode: { startsWith: p } })),
    },
  });
  return pickNearestPincode(pincode, metro);
}

function pickNearestPincode<T extends { pincode: string }>(
  target: string,
  rows: T[],
): T | null {
  if (rows.length === 0) return null;
  const n = Number(target);
  return rows.reduce((best, row) => {
    const distance = Math.abs(Number(row.pincode) - n);
    const bestDistance = Math.abs(Number(best.pincode) - n);
    if (distance < bestDistance) return row;
    if (distance > bestDistance) return best;
    return Number(row.pincode) < Number(best.pincode) ? row : best;
  });
}

function toPincodeServiceable(zone: DeliveryPincode): PincodeServiceable {
  return {
    serviceable: true,
    pincode: zone.pincode,
    city: zone.city,
    area: zone.area,
    district: zone.district,
    deliveryFee: Number(zone.deliveryFee),
    sameDayEligible: zone.sameDayEligible,
    expressEligible: zone.expressEligible,
    expressDeliveryFee: zone.expressDeliveryFee ? Number(zone.expressDeliveryFee) : null,
    minOrderAmount: zone.minOrderAmount ? Number(zone.minOrderAmount) : null,
    extraLeadHours: zone.extraLeadHours,
  };
}
