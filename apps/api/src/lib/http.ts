import type { FastifyReply } from "fastify";
import type { ZodSchema } from "zod";

/**
 * Validate `data` against `schema`. On success returns the typed value.
 * On failure it sends a 400 with details and returns `undefined`, so callers
 * do: `const body = parseOr400(...); if (!body) return;`
 */
export function parseOr400<T>(
  schema: ZodSchema<T>,
  data: unknown,
  reply: FastifyReply,
): T | undefined {
  const result = schema.safeParse(data);
  if (!result.success) {
    reply
      .code(400)
      .send({ error: "ValidationError", details: result.error.flatten() });
    return undefined;
  }
  return result.data;
}
