import {
  esm_exports,
  init_esm as init_esm2
} from "./chunk-BGESSE55.mjs";
import {
  __commonJS,
  __name,
  __toCommonJS,
  init_esm
} from "./chunk-NH7PIQAW.mjs";

// ../../.npm/_npx/008556e9bfa22a63/node_modules/@opentelemetry/resources/build/src/detectors/platform/node/machine-id/getMachineId-unsupported.js
var require_getMachineId_unsupported = __commonJS({
  "../../.npm/_npx/008556e9bfa22a63/node_modules/@opentelemetry/resources/build/src/detectors/platform/node/machine-id/getMachineId-unsupported.js"(exports) {
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getMachineId = void 0;
    var api_1 = (init_esm2(), __toCommonJS(esm_exports));
    async function getMachineId() {
      api_1.diag.debug("could not read machine-id: unsupported platform");
      return void 0;
    }
    __name(getMachineId, "getMachineId");
    exports.getMachineId = getMachineId;
  }
});
export default require_getMachineId_unsupported();
//# sourceMappingURL=getMachineId-unsupported-H5W3IF4B.mjs.map
