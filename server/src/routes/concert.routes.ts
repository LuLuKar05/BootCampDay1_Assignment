import {Router} from "express";
import {AppDataSource} from "../database/data-source";
import {Concert} from "../entities/concert";

const router = Router();

//FR 3.1: Get all concert and their available tickets
router.get("/", async (req, res) => {
    try{
        const concertRepository = AppDataSource.getRepository(Concert);
        const concerts = await concertRepository.find();
        return res.status(200).json(concerts);
    } catch (error) {
        console.error("Error fetching concerts:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

export default router;

//FR 3.2: Get a specific concert and its available tickets
