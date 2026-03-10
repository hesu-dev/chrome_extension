(function () {
  const api =
    typeof module !== "undefined" && module.exports
      ? require("./index.js")
      : {};

  if (typeof window !== "undefined") {
    window.Roll20JsonCore = Object.assign({}, window.Roll20JsonCore, api.browserContract || api);
  }
})();
