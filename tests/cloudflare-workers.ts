export const env = new Proxy(process.env, {
  get(target, property) {
    return typeof property === "string" ? target[property] : undefined;
  },
});
