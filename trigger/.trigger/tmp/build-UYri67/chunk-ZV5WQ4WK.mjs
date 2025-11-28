import {
  __commonJS,
  __require,
  init_esm
} from "./chunk-NH7PIQAW.mjs";

// ../../.npm/_npx/008556e9bfa22a63/node_modules/@opentelemetry/resources/build/src/detectors/platform/node/machine-id/execAsync.js
var require_execAsync = __commonJS({
  "../../.npm/_npx/008556e9bfa22a63/node_modules/@opentelemetry/resources/build/src/detectors/platform/node/machine-id/execAsync.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.execAsync = void 0;
    var child_process = __require("child_process");
    var util = __require("util");
    exports.execAsync = util.promisify(child_process.exec);
  }
});

export {
  require_execAsync
};
//# sourceMappingURL=chunk-ZV5WQ4WK.mjs.map
