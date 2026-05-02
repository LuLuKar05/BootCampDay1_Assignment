import cron from "node-cron";
import { AppDataSource } from "../database/data-source";
import { Reservation, ReservationStatus } from "../entities/reservation";

export function startExpiryScheduler() {
    cron.schedule("* * * * *", async () => {
        try {
            const result = await AppDataSource.getRepository(Reservation)
                .createQueryBuilder()
                .update(Reservation)
                .set({ status: ReservationStatus.EXPIRED })
                .where("expiresAt < :now", { now: new Date() })
                .andWhere("status = :pending", { pending: ReservationStatus.PENDING })
                .execute();

            if (result.affected && result.affected > 0) {
                console.log(`Expired ${result.affected} reservation(s).`);
            }
        } catch (err) {
            console.error("Expiry scheduler error:", err);
        }
    });
}
