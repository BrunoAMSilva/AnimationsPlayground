function hashChanged() {
  let argsString = window.location.hash;
  if (!argsString || argsString === "#") {
    return;
  }
  let params = argsString
    .slice(1)
    .split("&")
    .reduce(function (acc, arg) {
      const splitArg = arg.split("=");
      let value = splitArg[1];
      if (value.toLowerCase() === "true") {
        value = true;
      } else if (value.toLowerCase() === "false") {
        value = false;
      } else if (value !== "" && !isNaN(value)) {
        value = parseInt(value);
      }
      acc[splitArg[0]] = value;
      return acc;
    }, {});

  return params;
}
