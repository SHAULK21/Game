import type { Express } from "express";
import type { InternalApi } from "./characterStore";
/** Invoke registered ledger handlers inside the caller's transaction, never via an HTTP round trip. */
export function internalGameApi(app: Express): InternalApi {
  return async (_client, userId, resetVersion, url, options = {}) => {
    const parsed = new URL(url, "http://internal.invalid"),
      method = (options.method || "GET").toLowerCase();
    if (
      !/^\/api\/(items|market|clan|premium|pvp|admin\/premium)/.test(
        parsed.pathname,
      )
    )
      throw new Error("Unsupported internal game API");
    const layer = (app as any)._router.stack.find(
      (layer: any) =>
        layer.route?.methods[method] && layer.match(parsed.pathname),
    );
    if (!layer) throw new Error("Internal game route not found: " + url);
    const req: any = {
      authUser: { id: userId, displayName: "Игрок" },
      body: options.body ? JSON.parse(String(options.body)) : {},
      params: layer.params,
      query: Object.fromEntries(parsed.searchParams),
      method: method.toUpperCase(),
      path: parsed.pathname,
      headers: { "x-game-reset-version": String(resetVersion) },
      get: (key: string) =>
        key.toLowerCase() === "x-game-reset-version"
          ? String(resetVersion)
          : undefined,
    };
    let status = 200,
      result: any,
      done = false;
    const res: any = {
      locals: {},
      status: (code: number) => {
        status = code;
        return res;
      },
      json: (data: any) => {
        result = data;
        done = true;
        return res;
      },
      send: (data: any) => {
        result = data;
        done = true;
        return res;
      },
    };
    // The authenticated Telegram ID is supplied by the outer HTTP auth. Never run auth a second time.
    for (const handler of layer.route.stack.slice(1)) {
      if (done) break;
      let failure: any;
      await handler.handle(req, res, (error: any) => {
        failure = error;
      });
      if (failure) throw failure;
    }
    if (!done) throw new Error("Internal game route did not respond");
    if (status >= 400)
      throw new Error(
        (result?.error || "Game operation rejected") + " (HTTP " + status + ")",
      );
    return result;
  };
}
