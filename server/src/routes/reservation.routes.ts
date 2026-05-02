import { Router } from "express";
import { reservationService } from "../services/reservation.service";
import { AppError } from "../errors/AppError";

const router = Router();

function handleError(res: any, error: unknown) {
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
}

// FR 4.1: Create a reservation for a concert
router.post("/", async (req, res) => {
    try {
        const { concertId } = req.body;
        if (!concertId) return res.status(400).json({ message: "concertId is required" });

        const reservation = await reservationService.create(concertId);
        return res.status(201).json(reservation);
    } catch (error) {
        return handleError(res, error);
    }
});

// FR 4.2: Confirm a reservation and issue a ticket
router.post("/:id/confirm", async (req, res) => {
    try {
        const ticket = await reservationService.confirm(parseInt(req.params.id), req.body);
        return res.status(201).json(ticket);
    } catch (error) {
        return handleError(res, error);
    }
});

// FR 4.3: Cancel a pending reservation
router.delete("/:id", async (req, res) => {
    try {
        await reservationService.cancel(parseInt(req.params.id));
        return res.status(200).json({ message: "Reservation cancelled successfully" });
    } catch (error) {
        return handleError(res, error);
    }
});

// FR 4.4: Get a specific reservation and its status
router.get("/:id", async (req, res) => {
    try {
        const reservation = await reservationService.findById(parseInt(req.params.id));
        return res.status(200).json(reservation);
    } catch (error) {
        return handleError(res, error);
    }
});

export default router;