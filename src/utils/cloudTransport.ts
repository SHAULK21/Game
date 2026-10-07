let handler: ((path: string, options: RequestInit) => Promise<any>) | null =
  null;
export const installCloudTransport = (next: typeof handler) => {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
};
export const isCloudOperation = (path: string, method = "GET") =>
  !["GET", "HEAD"].includes(method.toUpperCase()) &&
  /^\/api\/(items(?:\/|$)|market(?:\/|$)|clan(?:\/|$)|pvp\/(enroll|challenge)$|admin\/premium\/self$)/.test(
    path,
  );
export function routeCloudOperation(path: string, options: RequestInit) {
  if (!handler)
    return Promise.reject(
      new Error("Дождитесь загрузки серверного персонажа."),
    );
  return handler(path, options);
}
