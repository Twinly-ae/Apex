import "fastify";
import type { preHandlerHookHandler } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by the `authenticate` preHandler once a valid session is present. */
    userId: string;
  }
  interface FastifyInstance {
    /** preHandler that 401s unless a valid session cookie is present. */
    authenticate: preHandlerHookHandler;
  }
}

declare module "@fastify/secure-session" {
  interface SessionData {
    userId: string;
  }
}
