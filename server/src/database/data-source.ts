import "reflect-metadata";
import { DataSource } from "typeorm";

export const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: "database.sqlite",
  synchronize: false,
  logging: true,
  entities: [__dirname + "/../entities/*.{ts,js}"],
  migrations: [__dirname + "/migrations/*.{ts,js}"],
});
