import 'dotenv/config';
'use strict';

import Hapi from "@hapi/hapi";
import { Request, Server, Plugin } from "@hapi/hapi";
import Path from "path";

import hapiCookie from "@hapi/cookie";
import hapiVision from "@hapi/vision";
import hapiInert from "@hapi/inert";

// Done this way since it doesn't have a type declaration module.
let laabr: Plugin<unknown>;
laabr = require("laabr");

import { dbClose } from "./queries";
import { authRoutes, registerAuth } from "./auth";

export let server: Server;

const production: boolean = (process.env.NODE_ENV === "production");

function buildVisionContext(request: Request) {
  return {
    loggedIn: request.auth.isAuthenticated
  };
}

async function registerVision(server: Server) {
  let cached: boolean;

  if (!process.env.NODE_ENV || process.env.NODE_ENV === "development") {
    cached = false;
  } else {
    cached = true;
  }
  server.log(["debug"], `Caching templates: ${cached}`);
  server.views({
    engines: { ejs: require("ejs")},
    relativeTo: __dirname + "/../",
    path: 'templates',
    isCached: cached,
    context: buildVisionContext
  });
}

/* Plugins need to finish registration before server can start. */
async function registerServerPlugins(server: Server) {
  if (process.env.NODE_ENV != "test") {
    await server.register({ plugin: laabr, options: {} });
  }
  await server.register(hapiCookie);
  await server.register(hapiVision);
  await server.register(hapiInert);
}

export const init = async function(): Promise<Server> {
  if (!production) {
    process.env.BCRYPT_SALT_ROUNDS="1";
  }
  server = Hapi.server({
    port: process.env.PORT || 5000,
    host: '0.0.0.0'
    // , debug: { log: ["*"], request: ["*"] }
  });

  await registerServerPlugins(server);
  await registerVision(server);

  registerAuth(server);

  server.route({
    method: "GET",
    path: "/ping",
    // options: {
    //   auth: {
    //     mode: 'try'
    //   }
    // },
    handler: function(request) {
      request.log(["debug"], "PING received");
      server.log(["debug"], "PING received");
      return { message: "PONG" };
    }
  });

  server.route(authRoutes);

  server.route({
    method: "GET",
    path: "/static/{param*}",
    // options: {
    //   auth: {
    //     mode: 'try'
    //   }
    // },
    handler: {
      directory: {
        path: Path.join(__dirname, "../static/")
      }
    }
  });

  server.events.on("stop", () => {
    // We want it to close in dev or when running in production;
    // when testing the server is started and stopped a lot, so
    // we'll do it manually then.
    if (process.env.NODE_ENV != "test") {
      dbClose();
    }
  })

  return server;
};

export const start = async function (): Promise<void> {
  return server.start();
};

process.on('unhandledRejection', (err) => {
  console.error("unhandledRejection");
  console.error(err);
  process.exit(1);
});
