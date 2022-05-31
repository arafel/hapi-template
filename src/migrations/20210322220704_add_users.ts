import * as Knex from "knex";

export async function up(knex: Knex.Knex): Promise<void> {
    return knex.schema.createTable("users", t => {
        t.increments("id").primary();
        t.string("email").notNullable();
        t.string("passwordHash").notNullable();
        t.timestamps(false, true);
    });
}

export async function down(knex: Knex.Knex): Promise<void> {
    return knex.schema.dropTableIfExists('users')
}
