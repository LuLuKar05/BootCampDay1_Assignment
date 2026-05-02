import { Router, Request, Response } from "express";
import concertRoutes from "./concert.routes";
import reservationRoutes from "./reservation.routes";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
});

router.use("/concerts", concertRoutes);
router.use("/reservations", reservationRoutes);

export default router;