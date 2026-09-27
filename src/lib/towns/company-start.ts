import { isTemplateId, type TemplateId } from "@/lib/league-city/templates";

/**
 * A company town's starter pick from a request body (used only when the join
 * creates the town), and what the dev's screen expected: to build it or to
 * move into it.
 */
export function startFrom(body: Record<string, unknown>): {
  template?: TemplateId;
  expect?: "create" | "join";
} {
  return {
    template: isTemplateId(body.template) ? body.template : undefined,
    expect: body.expect === "create" || body.expect === "join" ? body.expect : undefined,
  };
}
