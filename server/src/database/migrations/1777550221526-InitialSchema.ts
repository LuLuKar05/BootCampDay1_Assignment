import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1777550221526 implements MigrationInterface {
    name = 'InitialSchema1777550221526'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "concert" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "name" varchar NOT NULL, "totalTickets" integer NOT NULL, "availableTickets" integer NOT NULL, "startTime" datetime NOT NULL, "endTime" datetime NOT NULL, "status" varchar NOT NULL DEFAULT ('UPCOMING'))`);
        await queryRunner.query(`CREATE INDEX "IDX_d8bd26a1a94b3b9f7ca304ad4c" ON "concert" ("status") `);
        await queryRunner.query(`CREATE TABLE "ticket" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userName" varchar(100) NOT NULL, "userEmail" varchar(100) NOT NULL, "seatNumber" varchar NOT NULL, "issuedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "price" decimal(10,2) NOT NULL, "status" varchar NOT NULL DEFAULT ('RESERVED'), "concertId" integer)`);
        await queryRunner.query(`CREATE TABLE "temporary_ticket" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userName" varchar(100) NOT NULL, "userEmail" varchar(100) NOT NULL, "seatNumber" varchar NOT NULL, "issuedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "price" decimal(10,2) NOT NULL, "status" varchar NOT NULL DEFAULT ('RESERVED'), "concertId" integer, CONSTRAINT "FK_ef8e1c3effd13564a3e3dd569ac" FOREIGN KEY ("concertId") REFERENCES "concert" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_ticket"("id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId") SELECT "id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId" FROM "ticket"`);
        await queryRunner.query(`DROP TABLE "ticket"`);
        await queryRunner.query(`ALTER TABLE "temporary_ticket" RENAME TO "ticket"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket" RENAME TO "temporary_ticket"`);
        await queryRunner.query(`CREATE TABLE "ticket" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userName" varchar(100) NOT NULL, "userEmail" varchar(100) NOT NULL, "seatNumber" varchar NOT NULL, "issuedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "price" decimal(10,2) NOT NULL, "status" varchar NOT NULL DEFAULT ('RESERVED'), "concertId" integer)`);
        await queryRunner.query(`INSERT INTO "ticket"("id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId") SELECT "id", "userName", "userEmail", "seatNumber", "issuedAt", "price", "status", "concertId" FROM "temporary_ticket"`);
        await queryRunner.query(`DROP TABLE "temporary_ticket"`);
        await queryRunner.query(`DROP TABLE "ticket"`);
        await queryRunner.query(`DROP INDEX "IDX_d8bd26a1a94b3b9f7ca304ad4c"`);
        await queryRunner.query(`DROP TABLE "concert"`);
    }

}
