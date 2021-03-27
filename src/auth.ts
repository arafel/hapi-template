import 'dotenv/config';
'use strict';

import { Server, ServerRoute } from "@hapi/hapi";
import { Request, ResponseToolkit, ResponseObject } from "@hapi/hapi";
import Joi from "joi";
const ValidationError = Joi.ValidationError;

import { getUserById, getUserByEmail, getUserByEmailAndPassword } from "./queries";
import { createUser } from "./queries";

const production: boolean = (process.env.NODE_ENV === "production");

const schema = Joi.object({
  email: Joi.string().required().email(),
  password: Joi.string().required().min(8)
})

interface IncomingUser {
  email: string;
  password: string;
}
interface Session {
  id: number;
}

async function validateFunc(request: Request, session: Session) {
  const account = await getUserById(request, session.id);
  if (!account) {
    return { valid: false };
  }
  return { valid: true, credentials: account };
}

async function signupRender(request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  if (request.auth.isAuthenticated) {
    return h.redirect(request.query.next || "/");
  }
  return h.view("signup");
}

async function signupPost(request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  if (request.auth.isAuthenticated) {
    return h.redirect(request.query.next);
  }

  const u: IncomingUser = (request.payload as IncomingUser);
  if (!u.email || !u.password) {
    return h.view("signup",
      { message: "You need to supply an email address and password" });
  }
  try {
    const o = schema.validate({ email: u.email, password: u.password });
    if (o.error) {
      throw o.error;
    }
  } catch (err) {
    const errors: { [key: string]: string } = {};
    if (err instanceof ValidationError && err.isJoi) {
      for (const detail of err.details) {
        errors[detail.context!.key!] = detail.message;
      }
    } else {
      console.error("error", err);
      request.log(["error", "user"], "Error adding new user");
    }

    return h.view("signup", { errors: errors, message: "Signup failed." });
  }

  try {
    await getUserByEmail(request, u.email)
    request.log(`Account already found with email ${u.email} redirecting to login`);
    return h.redirect("/login");
  } catch (err) {
    // If it's a 404 error, that's fine, we don't want to find them really.
    if (!err.isBoom || (err.output.statusCode != 404)) {
      console.error("Error signing up");
      console.error(err);
      throw err;
    }
  }

  try {
    await createUser(request, u.email, u.password);
    return h.redirect("/login");
  } catch (err) {
    console.error("Error occurred during signup", err);
    request.log(["users", "error"], "Error occurred during signup: " + JSON.stringify(err));
    return h.view("signup", { message: "Sorry, an error occcurred." });
  }
}

async function loginRender(request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  if (request.auth.isAuthenticated) {
    return h.redirect(request.query.next || "/");
  }

  return h.view("login");
}

async function loginPost(request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  const u: IncomingUser = (request.payload as IncomingUser);
  if (!u.email || !u.password) {
    return h.view("login", { message: "email and password are required." });
  }

  try {
    const o = schema.validate({ email: u.email, password: u.password });
    if (o.error) {
      throw o.error;
    }
  } catch (err) {
    const errors: { [key: string]: string } = {};
    if (err instanceof ValidationError && err.isJoi) {
      for (const detail of err.details) {
        errors[detail.context!.key!] = detail.message;
      }
    } else {
      console.error("error", err);
      request.log(["error", "user"], "Error logging user in");
    }

    return h.view("login", { errors: errors, message: "Login error." });
  }

  // Try to find user with given credentials
  const account = await getUserByEmailAndPassword(request, u.email, u.password)
  if (!account) {
    return h.view("login", { message: "email or password is wrong." });
  }

  const session: Session = { id: account.id }
  request.cookieAuth.set(session);
  request.log("debug", "Next is " + request.query.next);
  return h.redirect(request.query.next || "/");
}

async function logout (request: Request, h: ResponseToolkit): Promise<ResponseObject> {
  request.cookieAuth.clear();
  return h.redirect('/');
}

export function registerAuth(server: Server): void {
  server.auth.strategy('session', 'cookie', {
    cookie: {
      name: 'reviewidget',
      password: process.env.COOKIE_SECRET,
      isSecure: production
    },
    redirectTo: '/login',
    appendNext: true,
    validateFunc: validateFunc
  });

  server.auth.default('session');
}

export const authRoutes: ServerRoute[] = [
  {
    method: 'GET',
    path: '/signup',
    options: {
      auth: {
        mode: 'try'
      },
      plugins: {
        'hapi-auth-cookie': {
          redirectTo: false
        }
      },
      handler: signupRender
    }
  },
  {
    method: 'POST',
    path: '/signup',
    options: {
      auth: {
        mode: 'try'
      },
      plugins: {
        'hapi-auth-cookie': {
          redirectTo: false
        }
      },
      handler: signupPost
    }
  },

  {
    method: 'GET',
    path: '/login',
    options: {
      auth: {
        mode: 'try'
      },
      plugins: {
        'hapi-auth-cookie': {
          redirectTo: false
        }
      },
      handler: loginRender
    }
  },
  {
    method: 'POST',
    path: '/login',
    options: {
      auth: {
        mode: 'try'
      },
      handler: loginPost
    }
  },

  {
    method: 'GET',
    path: '/logout',
    options: {
      handler: logout
    }
  }
];

