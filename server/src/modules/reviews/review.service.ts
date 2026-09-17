import { z } from "zod";
import { Prisma, ProductReviewStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { phoneLookupVariants } from "../../lib/phone.js";

const MAX_BODY = 2000;
const MAX_TITLE = 100;

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z
    .string()
    .trim()
    .max(MAX_TITLE)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  body: z
    .string()
    .trim()
    .max(MAX_BODY)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  displayName: z.string().trim().min(2, "Name is required").max(80),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().email("Enter a valid email").optional(),
  ),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = z.object({
  status: z.nativeEnum(ProductReviewStatus),
});

export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

function serializeReview(
  review: {
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    displayName: string;
    email: string | null;
    status: ProductReviewStatus;
    verifiedPurchase: boolean;
    createdAt: Date;
    product?: { id: string; slug: string; name: string };
  },
  opts?: { includeStatus?: boolean; includeProduct?: boolean; includeEmail?: boolean },
) {
  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    verifiedPurchase: review.verifiedPurchase,
    createdAt: review.createdAt.toISOString(),
    authorName: review.displayName,
    ...(opts?.includeEmail ? { email: review.email } : {}),
    ...(opts?.includeStatus ? { status: review.status } : {}),
    ...(opts?.includeProduct && review.product
      ? {
          product: {
            id: review.product.id,
            slug: review.product.slug,
            name: review.product.name,
          },
        }
      : {}),
  };
}

async function hasPurchasedProduct(userId: string, productId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });
  if (!user) return false;

  const phones = phoneLookupVariants(user.phone);
  const found = await prisma.order.findFirst({
    where: {
      status: "DELIVERED",
      OR: [{ userId }, { customerPhone: { in: phones } }],
      items: { some: { productId } },
    },
    select: { id: true },
  });
  return Boolean(found);
}

export async function listPublicReviewsByProductSlug(
  slug: string,
  page = 1,
  pageSize = 10,
) {
  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!product) throw HttpError.notFound("Product not found");

  const safePage = Math.max(1, page);
  const safeSize = Math.min(50, Math.max(1, pageSize));
  const where: Prisma.ProductReviewWhereInput = {
    productId: product.id,
    status: "APPROVED",
  };

  const [aggregate, total, items] = await Promise.all([
    prisma.productReview.aggregate({
      where,
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.productReview.count({ where }),
    prisma.productReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeSize,
      take: safeSize,
    }),
  ]);

  const count = aggregate._count._all;
  const average = count > 0 ? Math.round((aggregate._avg.rating ?? 0) * 10) / 10 : 0;

  return {
    summary: { average, count },
    page: safePage,
    pageSize: safeSize,
    totalPages: Math.max(1, Math.ceil(total / safeSize)),
    items: items.map((r) => serializeReview(r)),
  };
}

export async function createProductReview(
  slug: string,
  userId: string | null,
  input: CreateReviewInput,
) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    select: { id: true },
  });
  if (!product) throw HttpError.notFound("Product not found");

  if (userId) {
    const existing = await prisma.productReview.findUnique({
      where: { productId_userId: { productId: product.id, userId } },
    });
    if (existing) {
      throw HttpError.conflict("You have already reviewed this product");
    }
  }

  const verifiedPurchase = userId ? await hasPurchasedProduct(userId, product.id) : false;

  // Prefer the account name when signed in and the form left display blank —
  // schema still requires displayName from the client.
  const review = await prisma.productReview.create({
    data: {
      productId: product.id,
      userId: userId ?? null,
      rating: input.rating,
      title: input.title,
      body: input.body,
      displayName: input.displayName,
      email: input.email,
      verifiedPurchase,
      status: "PENDING",
    },
  });

  return serializeReview(review, { includeStatus: true });
}

export async function listAdminReviews(status: ProductReviewStatus | null) {
  const reviews = await prisma.productReview.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      product: { select: { id: true, slug: true, name: true } },
    },
  });
  return reviews.map((r) =>
    serializeReview(r, { includeStatus: true, includeProduct: true, includeEmail: true }),
  );
}

export async function updateAdminReview(id: string, input: UpdateReviewInput) {
  const existing = await prisma.productReview.findUnique({ where: { id } });
  if (!existing) throw HttpError.notFound("Review not found");

  const review = await prisma.productReview.update({
    where: { id },
    data: { status: input.status },
    include: {
      product: { select: { id: true, slug: true, name: true } },
    },
  });
  return serializeReview(review, {
    includeStatus: true,
    includeProduct: true,
    includeEmail: true,
  });
}
