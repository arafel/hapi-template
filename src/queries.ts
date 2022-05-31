import { knex } from "knex";
import { Knex } from "knex";

import bcrypt from "bcrypt";
import Boom from "@hapi/boom";

import knexConfig from './knexfile';

import { Request } from "@hapi/hapi";

import { User } from "./types.d";

let config: Knex.Config;
switch (process.env.NODE_ENV) {
    case undefined:
    // If undefined, fall through to development.
    case "development":
        config = knexConfig.development;
        break;
    case "test":
        config = knexConfig.test;
        break;
    default:
        config = knexConfig.production;
        break;
}

export const database: Knex = knex(config);

// async function printSql(query: QueryBuilder, msg?: string) {
//   const sql = await query.toSQL();
//   if (msg) {
//     console.log(msg);
//   }
//   console.log(sql.sql);
// }

export async function dbClose(): Promise<unknown> {
    return database.destroy();
}


async function runQuery(query: Knex.QueryBuilder) {
    // console.log("runQuery running query", query);
    const result = await query;
    // console.log("result", result);
    if (!result) {
        // console.log("runQuery running query", query);
        // console.log("not found");
        throw Boom.notFound();
    }
    return result;
}


export async function getUserById(_request: Request, userId: number): Promise<User> {
    const account = await runQuery(database
        .first()
        .from("users")
        .where({ id: userId }));
    if (account) {
        delete account.passwordHash;
    }
    return Promise.resolve(account);
}

export async function getUserByEmail(_request: Request, email: string): Promise<User> {
    const account = await runQuery(database
        .first()
        .from("users")
        .where({ email: email }));
    if (account) {
        delete account.passwordHash;
    }
    return Promise.resolve(account);
}

export async function getUserByEmailAndPassword(_request: Request, email: string, password: string): Promise<User> {
    let account;
    try {
        account = await runQuery(database
            .first()
            .from("users")
            .where({ email: email }));

        if (await bcrypt.compare(password, account.passwordHash)) {
            delete account.passwordHash;
        } else {
            account = null;
        }
    } catch (err) {
        if (err.isBoom && (err.output.statusCode == 404)) {
            // User not found
            account = null;
        } else {
            console.error("Server error getting user");
            console.error(err);
            throw err;
        }
    }

    return Promise.resolve(account);
}

export async function createUser(request: Request, email: string, password: string): Promise<User> {
    request.log(["users"], `Creating user ${email}`);
    const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS!));
    const result = await runQuery(database("users").insert({ email: email, passwordHash: hash }, ["id"]));
    if (result.length == 1) {
        return Promise.resolve(result[0].id);
    } else {
        console.error("result", result);
        return Promise.reject("couldn't add user");
    }
}
