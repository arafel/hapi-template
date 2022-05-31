import { knex } from "knex";
import { Knex } from "knex";
import Bcrypt from "bcrypt";

export async function seed(knex: Knex): Promise<void> {
    // Deletes ALL existing entries
    await knex("users").del();

    // Inserts seed entries
    await knex("users").insert([
        { email: 'johnwatson@bakerstreet.com', passwordHash: Bcrypt.hashSync("Sherlock", parseInt(process.env.BCRYPT_SALT_ROUNDS!)) },
        { email: 'nerowolfe@brownstone.com', passwordHash: Bcrypt.hashSync("Satisfactory", parseInt(process.env.BCRYPT_SALT_ROUNDS!)) },
    ]);
}
