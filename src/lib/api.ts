import { NextResponse } from "next/server";
import { HttpError } from "./auth";
import { friendlyError } from "./llm";

/** Wraps a route handler: JSON errors with the right status instead of HTML 500s. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: friendlyError(e) }, { status: 400 });
    }
  };
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
