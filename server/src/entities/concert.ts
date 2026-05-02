import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index } from "typeorm";
import { Ticket } from "./ticket";

export enum ConcertStatus {
    UPCOMING   = "UPCOMING",   // concertTime is in the future
    NEAR       = "NEAR",       // within 48 hours of startTime
    ONGOING    = "ONGOING",    // between startTime and endTime
    ENDED      = "ENDED",      // past endTime — terminal, never changes again
    CANCELLED  = "CANCELLED",  // set by admin only — scheduler will never overwrite
    POSTPONED  = "POSTPONED",  // set by admin only — scheduler will never overwrite
}

@Entity()
export class Concert {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column()
    totalTickets!: number;

    @Column()
    availableTickets!: number;

    @Column({ type: "datetime" })
    startTime!: Date;

    @Column({ type: "datetime" })
    endTime!: Date;

    // Indexed so WHERE status = '...' queries skip full table scans.
    // Updated by the node-cron scheduler for time-based transitions.
    // CANCELLED and POSTPONED are set by admin only — scheduler skips them.
    @Index()
    @Column({ type: "varchar", default: ConcertStatus.UPCOMING })
    status!: ConcertStatus;

    @OneToMany(() => Ticket, (ticket) => ticket.concert)
    tickets!: Ticket[];
}