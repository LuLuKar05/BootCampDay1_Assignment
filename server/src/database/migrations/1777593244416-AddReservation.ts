import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReservation1777593244416 implements MigrationInterface {
    name = 'AddReservation1777593244416'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "reservation" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userName" varchar(100) NOT NULL, "userEmail" varchar(100) NOT NULL, "seatNumber" varchar NOT NULL, "price" decimal(10,2) NOT NULL, "expiresAt" datetime NOT NULL, "status" varchar NOT NULL DEFAULT ('PENDING'), "concertId" integer NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_29be1e5ad1e641d6966b30aa9b" ON "reservation" ("status") `);
        await queryRunner.query(`CREATE TABLE "temporary_ticket" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userName" varchar(100) NOT NULL, "userEmail" varchar(100) NOT NULL, "seatNumber" varchar NOT NULL, "issuedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "price" decimal(10,2) NOT NULL, "status" varchar NOT NULL DEFAULT ('RESERVED'), "concertId" integer, "reservationId" integer, CONSTRAINT "UQ_0f056ff8273828a2b1ef01275c9" UNIQUE ("reservationId"), CONSTRAINT "FK_ef8e1c3effd13564a3e3dd569ac" FOREIGN KEY ("concertId") REFERENCES "concert" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_ticket"("id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId") SELECT "id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId" FROM "ticket"`);
        await queryRunner.query(`DROP TABLE "ticket"`);
        await queryRunner.query(`ALTER TABLE "temporary_ticket" RENAME TO "ticket"`);
        await queryRunner.query(`CREATE TABLE "temporary_ticket" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userName" varchar(100) NOT NULL, "userEmail" varchar(100) NOT NULL, "seatNumber" varchar NOT NULL, "issuedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "price" decimal(10,2) NOT NULL, "status" varchar NOT NULL DEFAULT ('CONFIRMED'), "concertId" integer, "reservationId" integer, CONSTRAINT "UQ_0f056ff8273828a2b1ef01275c9" UNIQUE ("reservationId"), CONSTRAINT "FK_ef8e1c3effd13564a3e3dd569ac" FOREIGN KEY ("concertId") REFERENCES "concert" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_ticket"("id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId", "reservationId") SELECT "id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId", "reservationId" FROM "ticket"`);
        await queryRunner.query(`DROP TABLE "ticket"`);
        await queryRunner.query(`ALTER TABLE "temporary_ticket" RENAME TO "ticket"`);
        await queryRunner.query(`DROP INDEX "IDX_29be1e5ad1e641d6966b30aa9b"`);
        await queryRunner.query(`CREATE TABLE "temporary_reservation" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userName" varchar(100) NOT NULL, "userEmail" varchar(100) NOT NULL, "seatNumber" varchar NOT NULL, "price" decimal(10,2) NOT NULL, "expiresAt" datetime NOT NULL, "status" varchar NOT NULL DEFAULT ('PENDING'), "concertId" integer NOT NULL, CONSTRAINT "FK_695fee0a1da3b71b59f0c1e00b9" FOREIGN KEY ("concertId") REFERENCES "concert" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_reservation"("id", "userName", "userEmail", "seatNumber", "price", "expiresAt", "status", "concertId") SELECT "id", "userName", "userEmail", "seatNumber", "price", "expiresAt", "status", "concertId" FROM "reservation"`);
        await queryRunner.query(`DROP TABLE "reservation"`);
        await queryRunner.query(`ALTER TABLE "temporary_reservation" RENAME TO "reservation"`);
        await queryRunner.query(`CREATE INDEX "IDX_29be1e5ad1e641d6966b30aa9b" ON "reservation" ("status") `);
        await queryRunner.query(`CREATE TABLE "temporary_ticket" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userName" varchar(100) NOT NULL, "userEmail" varchar(100) NOT NULL, "seatNumber" varchar NOT NULL, "issuedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "price" decimal(10,2) NOT NULL, "status" varchar NOT NULL DEFAULT ('CONFIRMED'), "concertId" integer, "reservationId" integer, CONSTRAINT "UQ_0f056ff8273828a2b1ef01275c9" UNIQUE ("reservationId"), CONSTRAINT "FK_ef8e1c3effd13564a3e3dd569ac" FOREIGN KEY ("concertId") REFERENCES "concert" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_387cdb530d5c67bb737f0525862" FOREIGN KEY ("reservationId") REFERENCES "reservation" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_ticket"("id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId", "reservationId") SELECT "id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId", "reservationId" FROM "ticket"`);
        await queryRunner.query(`DROP TABLE "ticket"`);
        await queryRunner.query(`ALTER TABLE "temporary_ticket" RENAME TO "ticket"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket" RENAME TO "temporary_ticket"`);
        await queryRunner.query(`CREATE TABLE "ticket" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userName" varchar(100) NOT NULL, "userEmail" varchar(100) NOT NULL, "seatNumber" varchar NOT NULL, "issuedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "price" decimal(10,2) NOT NULL, "status" varchar NOT NULL DEFAULT ('CONFIRMED'), "concertId" integer, "reservationId" integer, CONSTRAINT "UQ_0f056ff8273828a2b1ef01275c9" UNIQUE ("reservationId"), CONSTRAINT "FK_ef8e1c3effd13564a3e3dd569ac" FOREIGN KEY ("concertId") REFERENCES "concert" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "ticket"("id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId", "reservationId") SELECT "id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId", "reservationId" FROM "temporary_ticket"`);
        await queryRunner.query(`DROP TABLE "temporary_ticket"`);
        await queryRunner.query(`DROP INDEX "IDX_29be1e5ad1e641d6966b30aa9b"`);
        await queryRunner.query(`ALTER TABLE "reservation" RENAME TO "temporary_reservation"`);
        await queryRunner.query(`CREATE TABLE "reservation" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userName" varchar(100) NOT NULL, "userEmail" varchar(100) NOT NULL, "seatNumber" varchar NOT NULL, "price" decimal(10,2) NOT NULL, "expiresAt" datetime NOT NULL, "status" varchar NOT NULL DEFAULT ('PENDING'), "concertId" integer NOT NULL)`);
        await queryRunner.query(`INSERT INTO "reservation"("id", "userName", "userEmail", "seatNumber", "price", "expiresAt", "status", "concertId") SELECT "id", "userName", "userEmail", "seatNumber", "price", "expiresAt", "status", "concertId" FROM "temporary_reservation"`);
        await queryRunner.query(`DROP TABLE "temporary_reservation"`);
        await queryRunner.query(`CREATE INDEX "IDX_29be1e5ad1e641d6966b30aa9b" ON "reservation" ("status") `);
        await queryRunner.query(`ALTER TABLE "ticket" RENAME TO "temporary_ticket"`);
        await queryRunner.query(`CREATE TABLE "ticket" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userName" varchar(100) NOT NULL, "userEmail" varchar(100) NOT NULL, "seatNumber" varchar NOT NULL, "issuedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "price" decimal(10,2) NOT NULL, "status" varchar NOT NULL DEFAULT ('RESERVED'), "concertId" integer, "reservationId" integer, CONSTRAINT "UQ_0f056ff8273828a2b1ef01275c9" UNIQUE ("reservationId"), CONSTRAINT "FK_ef8e1c3effd13564a3e3dd569ac" FOREIGN KEY ("concertId") REFERENCES "concert" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "ticket"("id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId", "reservationId") SELECT "id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId", "reservationId" FROM "temporary_ticket"`);
        await queryRunner.query(`DROP TABLE "temporary_ticket"`);
        await queryRunner.query(`ALTER TABLE "ticket" RENAME TO "temporary_ticket"`);
        await queryRunner.query(`CREATE TABLE "ticket" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userName" varchar(100) NOT NULL, "userEmail" varchar(100) NOT NULL, "seatNumber" varchar NOT NULL, "issuedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "price" decimal(10,2) NOT NULL, "status" varchar NOT NULL DEFAULT ('RESERVED'), "concertId" integer, CONSTRAINT "FK_ef8e1c3effd13564a3e3dd569ac" FOREIGN KEY ("concertId") REFERENCES "concert" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "ticket"("id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId") SELECT "id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId" FROM "temporary_ticket"`);
        await queryRunner.query(`DROP TABLE "temporary_ticket"`);
        await queryRunner.query(`DROP INDEX "IDX_29be1e5ad1e641d6966b30aa9b"`);
        await queryRunner.query(`DROP TABLE "reservation"`);
    }

}
