import type { Instrumentation } from "next";

// One JSON line per unhandled server error, so logs stay searchable on Vercel, in
// `docker logs` and in any log shipper.
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  const e = err as Error & { digest?: string; code?: string };
  console.error(
    JSON.stringify({
      level: "error",
      msg: e.message,
      code: e.code,
      digest: e.digest,
      method: request.method,
      path: request.path,
      route: context.routePath,
      kind: context.routeType,
      build: process.env.APP_BUILD,
    }),
  );
};
