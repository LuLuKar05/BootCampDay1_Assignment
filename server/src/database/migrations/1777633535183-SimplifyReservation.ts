import { MigrationInterface, QueryRunner } from "typeorm";

export class SimplifyReservation1777633535183 implements MigrationInterface {
    name = 'SimplifyReservation1777633535183'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_29be1e5ad1e641d6966b30aa9b"`);
        await queryRunner.query(`CREATE TABLE "temporary_reservation" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "expiresAt" datetime NOT NULL, "status" varchar NOT NULL DEFAULT ('PENDING'), "concertId" integer NOT NULL, CONSTRAINT "FK_695fee0a1da3b71b59f0c1e00b9" FOREIGN KEY ("concertId") REFERENCES "concert" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_reservation"("id", "expiresAt", "status", "concertId") SELECT "id", "expiresAt", "status", "concertId" FROM "reservation"`);
        await queryRunner.query(`DROP TABLE "reservation"`);
        await queryRunner.query(`ALTER TABLE "temporary_reservation" RENAME TO "reservation"`);
        await queryRunner.query(`CREATE INDEX "IDX_29be1e5ad1e641d6966b30aa9b" ON "reservation" ("status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_29be1e5ad1e641d6966b30aa9b"`);
        await queryRunner.query(`ALTER TABLE "reservation" RENAME TO "temporary_reservation"`);
        await queryRunner.query(`CREATE TABLE "reservation" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userName" varchar(100) NOT NULL, "userEmail" varchar(100) NOT NULL, "seatNumber" varchar NOT NULL, "price" decimal(10,2) NOT NULL, "expiresAt" datetime NOT NULL, "status" varchar NOT NULL DEFAULT ('PENDING'), "concertId" integer NOT NULL, CONSTRAINT "FK_695fee0a1da3b71b59f0c1e00b9" FOREIGN KEY ("concertId") REFERENCES "concert" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "reservation"("id", "expiresAt", "status", "concertId") SELECT "id", "expiresAt", "status", "concertId" FROM "temporary_reservation"`);
        await queryRunner.query(`DROP TABLE "temporary_reservation"`);
        await queryRunner.query(`CREATE INDEX "IDX_29be1e5ad1e641d6966b30aa9b" ON "reservation" ("status") `);
    }

}
