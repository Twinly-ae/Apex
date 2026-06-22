import type { FastifyReply } from "fastify";
import type { ZodTypeAny, z } from "zod";

/**
 * Validate `data` against `schema`. On success returns the schema's *output*
 * type (so `.default()`/transforms are reflected). On failure it sends a 400
 * with details and returns `undefined`, so callers do:
 *   `const body = parseOr400(...); if (!body) return;`
 */
export function parseOr400<S extends ZodTypeAny>(
  schema: S,
  data: unknown,
  reply: FastifyReply,
): z.infer<S> | undefined {
  const result = schema.safeParse(data);
  if (!result.success) {
    reply
      .code(400)
      .send({ error: "ValidationError", details: result.error.flatten() });
    return undefined;
  }
  return result.data;
}
