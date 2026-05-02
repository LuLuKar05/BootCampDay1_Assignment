import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, BeforeInsert } from "typeorm";
import { Concert } from "./concert";

export enum ReservationStatus {
    PENDING    = "PENDING",
    CONFIRMED  = "CONFIRMED",
    EXPIRED    = "EXPIRED",
    CANCELLED  = "CANCELLED",
}

@Entity()
export class Reservation {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "datetime" })
    expiresAt!: Date;

    // Indexed for the expiry scheduler: WHERE status = 'PENDING' AND expiresAt < now
    @Index()
    @Column({ type: "varchar", default: ReservationStatus.PENDING })
    status!: ReservationStatus;

    @ManyToOne(() => Concert, { nullable: false })
    concert!: Concert;

    @BeforeInsert()
    setExpiry() {
        this.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    }
}
//     @BeforeInsert()
//     setExpiry() {
//         // Set a timer to automatically expire the reservation after 15 minutes
//         setTimeout(() => {
//             if (this.status === ReservationStatus.PENDING) {
//                 this.status = ReservationStatus.EXPIRED;
//                 // Here you would typically save the updated status to the database || or emit an event to notify the system of the expirtaion and the business logic to handle the expiration (e.g., releasing the reserved ticket). Insteard of directly saving to the database here, you might want to emit an event or use a job queue to handle the expiration logic in a more robust way, especially if your application is distributed or if you want to ensure that the expiration logic is executed even if the server restarts.
//             }
//         }, 15 * 60 * 1000); // 15 minutes in milliseconds
//     }
// }