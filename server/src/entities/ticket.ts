import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, JoinColumn} from "typeorm";
import { Concert } from "./concert";
import { Reservation } from "./reservation";

export enum TicketStatus {
    CONFIRMED = "CONFIRMED",
    CANCELLED = "CANCELLED",
    REFUNDED = "REFUNDED"
}

@Entity()
export class Ticket {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({length: 100})
    userName!: string;

    // unique across ticketTiers at the same concert, but same email can appear across different concerts
    @Column({length: 100})
    userEmail!: string;

    @Column()
    seatNumber!: string;

    @Column({type: "datetime", default: () => "CURRENT_TIMESTAMP"})
    issuedAt!: Date;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    price!: number;

    @Column({ type: "varchar", default: TicketStatus.CONFIRMED })
    status!: TicketStatus;

    @ManyToOne(() => Concert, (concert) => concert.tickets)
    concert!: Concert;

    @OneToOne(() => Reservation, {nullable: true})
    @JoinColumn()
    reservation!: Reservation | null;
}
