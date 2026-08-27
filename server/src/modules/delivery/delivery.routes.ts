import { Router } from "express";
import { HttpError } from "../../utils/httpError.js";
import { checkPincode } from "./delivery.service.js";

export const deliveryRouter = Router();

const PINCODE_RE = /^[1-9][0-9]{5}$/;

deliveryRouter.get("/check-pincode/:pincode", async (req, res) => {
  const pincode = req.params.pincode;
  if (!PINCODE_RE.test(pincode)) {
    throw HttpError.badRequest("Enter a valid 6-digit pincode");
  }
  const result = await checkPincode(pincode);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(result);
});
