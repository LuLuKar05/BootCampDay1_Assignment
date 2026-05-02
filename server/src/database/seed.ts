import "reflect-metadata";
import { AppDataSource } from "./data-source";
import { Concert, ConcertStatus } from "../entities/concert";

async function seed() {
    await AppDataSource.initialize();
    const repo = AppDataSource.getRepository(Concert);

    await repo.clear();

    const now = new Date();
    const h = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000);

    const concerts: Partial<Concert>[] = [
        {
            name: "Taylor Swift — The Eras Tour",
            totalTickets: 500,
            availableTickets: 320,
            startTime: h(72),
            endTime: h(76),
            status: ConcertStatus.UPCOMING,
        },
        {
            name: "Coldplay — Music of the Spheres",
            totalTickets: 300,
            availableTickets: 45,
            startTime: h(24),
            endTime: h(28),
            status: ConcertStatus.NEAR,
        },
        {
            name: "The Weeknd — After Hours",
            totalTickets: 400,
            availableTickets: 0,
            startTime: h(-1),
            endTime: h(3),
            status: ConcertStatus.ONGOING,
        },
        {
            name: "Billie Eilish — Happier Than Ever",
            totalTickets: 200,
            availableTickets: 0,
            startTime: h(-48),
            endTime: h(-44),
            status: ConcertStatus.ENDED,
        },
        {
            name: "Dua Lipa — Future Nostalgia",
            totalTickets: 350,
            availableTickets: 200,
            startTime: h(120),
            endTime: h(124),
            status: ConcertStatus.CANCELLED,
        },
    ];

    await repo.save(concerts);
    console.log(`Seeded ${concerts.length} concerts.`);
    await AppDataSource.destroy();
}

seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
