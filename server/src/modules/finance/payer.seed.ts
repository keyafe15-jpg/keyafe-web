import { logger } from "../../utils/logger.js";
import { createBooksPayer } from "./purchase.service.js";

/** Who from the shop pays — add names here; the UI can add more later. */
const PAYERS = ["Srijita"];

export async function seedBooksPayers() {
  for (const name of PAYERS) {
    await createBooksPayer(name);
  }
  logger.info(`Books payers seed: ${PAYERS.length} ensured`);
}
