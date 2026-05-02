import { AppDataSource } from "../database/data-source";
import { Reservation, ReservationStatus } from "../entities/reservation";
import { Ticket, TicketStatus } from "../entities/ticket";
import { Concert, ConcertStatus } from "../entities/concert";
import { AppError } from "../errors/AppError";
import { processPayment } from "./payment.service";

const BOOKABLE_STATUSES: ConcertStatus[] = [
    ConcertStatus.UPCOMING,
    ConcertStatus.NEAR,
    ConcertStatus.ONGOING,
];

export interface ConfirmDetails {
    userName: string;
    userEmail: string;
    seatNumber: string;
    price: number;
}

class ReservationService {

    async create(concertId: number): Promise<Reservation> {
        const concert = await AppDataSource.getRepository(Concert).findOneBy({ id: concertId });
        if (!concert) throw new AppError(404, "Concert not found");
        if (!BOOKABLE_STATUSES.includes(concert.status)) {
            throw new AppError(400, `Concert is not open for booking (status: ${concert.status})`);
        }

        const reservation = AppDataSource.getRepository(Reservation).create({ concert });
        return AppDataSource.getRepository(Reservation).save(reservation);
    }

    async confirm(reservationId: number, details: ConfirmDetails): Promise<Ticket> {
        const { userName, userEmail, seatNumber, price } = details;

        const reservation = await AppDataSource.getRepository(Reservation).findOne({
            where: { id: reservationId },
            relations: ["concert"],
        });
        if (!reservation) throw new AppError(404, "Reservation not found");
        if (reservation.status !== ReservationStatus.PENDING) {
            throw new AppError(400, `Reservation is ${reservation.status.toLowerCase()}, cannot confirm`);
        }
        if (reservation.expiresAt < new Date()) {
            throw new AppError(400, "Reservation has expired");
        }

        // Step 1: validate user input
        if (!userName || !userEmail || !seatNumber || price == null) {
            throw new AppError(400, "userName, userEmail, seatNumber and price are required");
        }

        // Step 2: check seat not already taken
        const takenSeat = await AppDataSource.getRepository(Ticket).findOne({
            where: {
                concert: { id: reservation.concert.id },
                seatNumber,
                status: TicketStatus.CONFIRMED,
            },
        });
        if (takenSeat) {
            throw new AppError(409, "Sorry for the inconvenience, but this seat is already taken");
        }

        // Step 3: consistency check
        if (reservation.concert.availableTickets < 1) {
            throw new AppError(409, "Sold out");
        }

        // Step 4: atomic transaction — payment + DB writes
        let ticket!: Ticket;

        await AppDataSource.transaction(async (manager) => {
            await processPayment({ userName, userEmail, price });

            const concert = await manager.findOne(Concert, {
                where: { id: reservation.concert.id },
                lock: { mode: "pessimistic_write" },
            });
            if (!concert) throw new AppError(404, "Concert not found");

            concert.availableTickets -= 1;
            await manager.save(concert);

            ticket = manager.create(Ticket, {
                userName,
                userEmail,
                seatNumber,
                price,
                status: TicketStatus.CONFIRMED,
                concert,
                reservation,
            });
            await manager.save(ticket);

            reservation.status = ReservationStatus.CONFIRMED;
            await manager.save(reservation);
        });

        return ticket;
    }

    async cancel(reservationId: number): Promise<void> {
        const repo = AppDataSource.getRepository(Reservation);
        const reservation = await repo.findOneBy({ id: reservationId });
        if (!reservation) throw new AppError(404, "Reservation not found");
        if (reservation.status !== ReservationStatus.PENDING) {
            throw new AppError(400, `Cannot cancel a reservation with status: ${reservation.status}`);
        }
        reservation.status = ReservationStatus.CANCELLED;
        await repo.save(reservation);
    }

    async findById(reservationId: number): Promise<Reservation> {
        const reservation = await AppDataSource.getRepository(Reservation).findOne({
            where: { id: reservationId },
            relations: ["concert"],
        });
        if (!reservation) throw new AppError(404, "Reservation not found");
        return reservation;
    }
}

export const reservationService = new ReservationService();