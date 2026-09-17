import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { ProductReviewStatus } from "@prisma/client";
import { HttpError } from "../../utils/httpError.js";
import {
  type AuthenticatedRequest,
  optionalAuth,
  requirePermission,
} from "../../middleware/auth.js";
import {
  createProductReview,
  createReviewSchema,
  listAdminReviews,
  listPublicReviewsByProductSlug,
  updateAdminReview,
  updateReviewSchema,
} from "./review.service.js";

/** Mounted on publicProductRouter as /:slug/reviews */
export function registerPublicReviewRoutes(router: Router) {
  router.get("/:slug/reviews", async (req, res) => {
    const slug = req.params.slug ?? "";
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 10);
    const result = await listPublicReviewsByProductSlug(slug, page, pageSize);
    res.setHeader("Cache-Control", "public, max-age=30");
    res.json(result);
  });

  router.post("/:slug/reviews", optionalAuth, async (req, res) => {
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      throw HttpError.badRequest("Invalid review", parsed.error.flatten());
    }
    const userId = (req as AuthenticatedRequest).user?.id ?? null;
    const review = await createProductReview(req.params.slug ?? "", userId, parsed.data);
    res.status(StatusCodes.CREATED).json(review);
  });
}

export const adminReviewRouter = Router();

adminReviewRouter.get("/", requirePermission("reviews.read"), async (req, res) => {
  const raw = typeof req.query.status === "string" ? req.query.status : null;
  const status =
    raw && Object.values(ProductReviewStatus).includes(raw as ProductReviewStatus)
      ? (raw as ProductReviewStatus)
      : null;
  res.json(await listAdminReviews(status));
});

adminReviewRouter.patch("/:id", requirePermission("reviews.update"), async (req, res) => {
  const parsed = updateReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid review update", parsed.error.flatten());
  }
  const review = await updateAdminReview(req.params.id ?? "", parsed.data);
  res.json(review);
});
