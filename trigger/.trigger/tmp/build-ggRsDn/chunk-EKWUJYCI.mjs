import {
  generateEmbeddings
} from "./chunk-4DUT4JF5.mjs";
import {
  finalizeDocument
} from "./chunk-CSIB54MH.mjs";
import {
  require_main
} from "./chunk-24BJQYVL.mjs";
import {
  SemanticInternalAttributes,
  carrierFromContext,
  createAsyncIterableStreamFromAsyncIterable,
  esm_exports as esm_exports2,
  init_esm as init_esm3,
  logger,
  require_src,
  task,
  taskContext
} from "./chunk-F2S4DK4N.mjs";
import {
  esm_exports,
  init_esm as init_esm2
} from "./chunk-3INNCATC.mjs";
import {
  __commonJS,
  __name,
  __require,
  __toCommonJS,
  __toESM,
  init_esm
} from "./chunk-NH7PIQAW.mjs";

// node_modules/@opentelemetry/resources/build/src/platform/node/default-service-name.js
var require_default_service_name = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/platform/node/default-service-name.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.defaultServiceName = void 0;
    function defaultServiceName() {
      return `unknown_service:${process.argv0}`;
    }
    __name(defaultServiceName, "defaultServiceName");
    exports.defaultServiceName = defaultServiceName;
  }
});

// node_modules/@opentelemetry/resources/build/src/platform/node/index.js
var require_node = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/platform/node/index.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.defaultServiceName = void 0;
    var default_service_name_1 = require_default_service_name();
    Object.defineProperty(exports, "defaultServiceName", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return default_service_name_1.defaultServiceName;
    }, "get") });
  }
});

// node_modules/@opentelemetry/resources/build/src/platform/index.js
var require_platform = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/platform/index.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.defaultServiceName = void 0;
    var node_1 = require_node();
    Object.defineProperty(exports, "defaultServiceName", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return node_1.defaultServiceName;
    }, "get") });
  }
});

// node_modules/@opentelemetry/resources/build/src/utils.js
var require_utils = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/utils.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.identity = exports.isPromiseLike = void 0;
    var isPromiseLike = /* @__PURE__ */ __name((val) => {
      return val !== null && typeof val === "object" && typeof val.then === "function";
    }, "isPromiseLike");
    exports.isPromiseLike = isPromiseLike;
    function identity(_) {
      return _;
    }
    __name(identity, "identity");
    exports.identity = identity;
  }
});

// node_modules/@opentelemetry/resources/build/src/ResourceImpl.js
var require_ResourceImpl = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/ResourceImpl.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.defaultResource = exports.emptyResource = exports.resourceFromDetectedResource = exports.resourceFromAttributes = void 0;
    var api_1 = (init_esm2(), __toCommonJS(esm_exports));
    var core_1 = require_src();
    var semantic_conventions_1 = (init_esm3(), __toCommonJS(esm_exports2));
    var platform_1 = require_platform();
    var utils_1 = require_utils();
    var ResourceImpl = class _ResourceImpl {
      static {
        __name(this, "ResourceImpl");
      }
      _rawAttributes;
      _asyncAttributesPending = false;
      _memoizedAttributes;
      static FromAttributeList(attributes) {
        const res = new _ResourceImpl({});
        res._rawAttributes = guardedRawAttributes(attributes);
        res._asyncAttributesPending = attributes.filter(([_, val]) => (0, utils_1.isPromiseLike)(val)).length > 0;
        return res;
      }
      constructor(resource) {
        const attributes = resource.attributes ?? {};
        this._rawAttributes = Object.entries(attributes).map(([k, v]) => {
          if ((0, utils_1.isPromiseLike)(v)) {
            this._asyncAttributesPending = true;
          }
          return [k, v];
        });
        this._rawAttributes = guardedRawAttributes(this._rawAttributes);
      }
      get asyncAttributesPending() {
        return this._asyncAttributesPending;
      }
      async waitForAsyncAttributes() {
        if (!this.asyncAttributesPending) {
          return;
        }
        for (let i = 0; i < this._rawAttributes.length; i++) {
          const [k, v] = this._rawAttributes[i];
          this._rawAttributes[i] = [k, (0, utils_1.isPromiseLike)(v) ? await v : v];
        }
        this._asyncAttributesPending = false;
      }
      get attributes() {
        if (this.asyncAttributesPending) {
          api_1.diag.error("Accessing resource attributes before async attributes settled");
        }
        if (this._memoizedAttributes) {
          return this._memoizedAttributes;
        }
        const attrs = {};
        for (const [k, v] of this._rawAttributes) {
          if ((0, utils_1.isPromiseLike)(v)) {
            api_1.diag.debug(`Unsettled resource attribute ${k} skipped`);
            continue;
          }
          if (v != null) {
            attrs[k] ??= v;
          }
        }
        if (!this._asyncAttributesPending) {
          this._memoizedAttributes = attrs;
        }
        return attrs;
      }
      getRawAttributes() {
        return this._rawAttributes;
      }
      merge(resource) {
        if (resource == null)
          return this;
        return _ResourceImpl.FromAttributeList([
          ...resource.getRawAttributes(),
          ...this.getRawAttributes()
        ]);
      }
    };
    function resourceFromAttributes(attributes) {
      return ResourceImpl.FromAttributeList(Object.entries(attributes));
    }
    __name(resourceFromAttributes, "resourceFromAttributes");
    exports.resourceFromAttributes = resourceFromAttributes;
    function resourceFromDetectedResource(detectedResource) {
      return new ResourceImpl(detectedResource);
    }
    __name(resourceFromDetectedResource, "resourceFromDetectedResource");
    exports.resourceFromDetectedResource = resourceFromDetectedResource;
    function emptyResource() {
      return resourceFromAttributes({});
    }
    __name(emptyResource, "emptyResource");
    exports.emptyResource = emptyResource;
    function defaultResource() {
      return resourceFromAttributes({
        [semantic_conventions_1.ATTR_SERVICE_NAME]: (0, platform_1.defaultServiceName)(),
        [semantic_conventions_1.ATTR_TELEMETRY_SDK_LANGUAGE]: core_1.SDK_INFO[semantic_conventions_1.ATTR_TELEMETRY_SDK_LANGUAGE],
        [semantic_conventions_1.ATTR_TELEMETRY_SDK_NAME]: core_1.SDK_INFO[semantic_conventions_1.ATTR_TELEMETRY_SDK_NAME],
        [semantic_conventions_1.ATTR_TELEMETRY_SDK_VERSION]: core_1.SDK_INFO[semantic_conventions_1.ATTR_TELEMETRY_SDK_VERSION]
      });
    }
    __name(defaultResource, "defaultResource");
    exports.defaultResource = defaultResource;
    function guardedRawAttributes(attributes) {
      return attributes.map(([k, v]) => {
        if ((0, utils_1.isPromiseLike)(v)) {
          return [
            k,
            v.catch((err) => {
              api_1.diag.debug("promise rejection for resource attribute: %s - %s", k, err);
              return void 0;
            })
          ];
        }
        return [k, v];
      });
    }
    __name(guardedRawAttributes, "guardedRawAttributes");
  }
});

// node_modules/@opentelemetry/resources/build/src/detect-resources.js
var require_detect_resources = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/detect-resources.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.detectResources = void 0;
    var api_1 = (init_esm2(), __toCommonJS(esm_exports));
    var ResourceImpl_1 = require_ResourceImpl();
    var detectResources = /* @__PURE__ */ __name((config = {}) => {
      const resources = (config.detectors || []).map((d) => {
        try {
          const resource = (0, ResourceImpl_1.resourceFromDetectedResource)(d.detect(config));
          api_1.diag.debug(`${d.constructor.name} found resource.`, resource);
          return resource;
        } catch (e) {
          api_1.diag.debug(`${d.constructor.name} failed: ${e.message}`);
          return (0, ResourceImpl_1.emptyResource)();
        }
      });
      return resources.reduce((acc, resource) => acc.merge(resource), (0, ResourceImpl_1.emptyResource)());
    }, "detectResources");
    exports.detectResources = detectResources;
  }
});

// node_modules/@opentelemetry/resources/build/src/detectors/EnvDetector.js
var require_EnvDetector = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/detectors/EnvDetector.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.envDetector = void 0;
    var api_1 = (init_esm2(), __toCommonJS(esm_exports));
    var semantic_conventions_1 = (init_esm3(), __toCommonJS(esm_exports2));
    var core_1 = require_src();
    var EnvDetector = class {
      static {
        __name(this, "EnvDetector");
      }
      // Type, attribute keys, and attribute values should not exceed 256 characters.
      _MAX_LENGTH = 255;
      // OTEL_RESOURCE_ATTRIBUTES is a comma-separated list of attributes.
      _COMMA_SEPARATOR = ",";
      // OTEL_RESOURCE_ATTRIBUTES contains key value pair separated by '='.
      _LABEL_KEY_VALUE_SPLITTER = "=";
      _ERROR_MESSAGE_INVALID_CHARS = "should be a ASCII string with a length greater than 0 and not exceed " + this._MAX_LENGTH + " characters.";
      _ERROR_MESSAGE_INVALID_VALUE = "should be a ASCII string with a length not exceed " + this._MAX_LENGTH + " characters.";
      /**
       * Returns a {@link Resource} populated with attributes from the
       * OTEL_RESOURCE_ATTRIBUTES environment variable. Note this is an async
       * function to conform to the Detector interface.
       *
       * @param config The resource detection config
       */
      detect(_config) {
        const attributes = {};
        const rawAttributes = (0, core_1.getStringFromEnv)("OTEL_RESOURCE_ATTRIBUTES");
        const serviceName = (0, core_1.getStringFromEnv)("OTEL_SERVICE_NAME");
        if (rawAttributes) {
          try {
            const parsedAttributes = this._parseResourceAttributes(rawAttributes);
            Object.assign(attributes, parsedAttributes);
          } catch (e) {
            api_1.diag.debug(`EnvDetector failed: ${e.message}`);
          }
        }
        if (serviceName) {
          attributes[semantic_conventions_1.ATTR_SERVICE_NAME] = serviceName;
        }
        return { attributes };
      }
      /**
       * Creates an attribute map from the OTEL_RESOURCE_ATTRIBUTES environment
       * variable.
       *
       * OTEL_RESOURCE_ATTRIBUTES: A comma-separated list of attributes describing
       * the source in more detail, e.g. “key1=val1,key2=val2”. Domain names and
       * paths are accepted as attribute keys. Values may be quoted or unquoted in
       * general. If a value contains whitespace, =, or " characters, it must
       * always be quoted.
       *
       * @param rawEnvAttributes The resource attributes as a comma-separated list
       * of key/value pairs.
       * @returns The sanitized resource attributes.
       */
      _parseResourceAttributes(rawEnvAttributes) {
        if (!rawEnvAttributes)
          return {};
        const attributes = {};
        const rawAttributes = rawEnvAttributes.split(this._COMMA_SEPARATOR, -1);
        for (const rawAttribute of rawAttributes) {
          const keyValuePair = rawAttribute.split(this._LABEL_KEY_VALUE_SPLITTER, -1);
          if (keyValuePair.length !== 2) {
            continue;
          }
          let [key, value] = keyValuePair;
          key = key.trim();
          value = value.trim().split(/^"|"$/).join("");
          if (!this._isValidAndNotEmpty(key)) {
            throw new Error(`Attribute key ${this._ERROR_MESSAGE_INVALID_CHARS}`);
          }
          if (!this._isValid(value)) {
            throw new Error(`Attribute value ${this._ERROR_MESSAGE_INVALID_VALUE}`);
          }
          attributes[key] = decodeURIComponent(value);
        }
        return attributes;
      }
      /**
       * Determines whether the given String is a valid printable ASCII string with
       * a length not exceed _MAX_LENGTH characters.
       *
       * @param str The String to be validated.
       * @returns Whether the String is valid.
       */
      _isValid(name) {
        return name.length <= this._MAX_LENGTH && this._isBaggageOctetString(name);
      }
      // https://www.w3.org/TR/baggage/#definition
      _isBaggageOctetString(str) {
        for (let i = 0; i < str.length; i++) {
          const ch = str.charCodeAt(i);
          if (ch < 33 || ch === 44 || ch === 59 || ch === 92 || ch > 126) {
            return false;
          }
        }
        return true;
      }
      /**
       * Determines whether the given String is a valid printable ASCII string with
       * a length greater than 0 and not exceed _MAX_LENGTH characters.
       *
       * @param str The String to be validated.
       * @returns Whether the String is valid and not empty.
       */
      _isValidAndNotEmpty(str) {
        return str.length > 0 && this._isValid(str);
      }
    };
    exports.envDetector = new EnvDetector();
  }
});

// node_modules/@opentelemetry/resources/build/src/semconv.js
var require_semconv = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/semconv.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ATTR_WEBENGINE_VERSION = exports.ATTR_WEBENGINE_NAME = exports.ATTR_WEBENGINE_DESCRIPTION = exports.ATTR_SERVICE_NAMESPACE = exports.ATTR_SERVICE_INSTANCE_ID = exports.ATTR_PROCESS_RUNTIME_VERSION = exports.ATTR_PROCESS_RUNTIME_NAME = exports.ATTR_PROCESS_RUNTIME_DESCRIPTION = exports.ATTR_PROCESS_PID = exports.ATTR_PROCESS_OWNER = exports.ATTR_PROCESS_EXECUTABLE_PATH = exports.ATTR_PROCESS_EXECUTABLE_NAME = exports.ATTR_PROCESS_COMMAND_ARGS = exports.ATTR_PROCESS_COMMAND = exports.ATTR_OS_VERSION = exports.ATTR_OS_TYPE = exports.ATTR_K8S_POD_NAME = exports.ATTR_K8S_NAMESPACE_NAME = exports.ATTR_K8S_DEPLOYMENT_NAME = exports.ATTR_K8S_CLUSTER_NAME = exports.ATTR_HOST_TYPE = exports.ATTR_HOST_NAME = exports.ATTR_HOST_IMAGE_VERSION = exports.ATTR_HOST_IMAGE_NAME = exports.ATTR_HOST_IMAGE_ID = exports.ATTR_HOST_ID = exports.ATTR_HOST_ARCH = exports.ATTR_CONTAINER_NAME = exports.ATTR_CONTAINER_IMAGE_TAGS = exports.ATTR_CONTAINER_IMAGE_NAME = exports.ATTR_CONTAINER_ID = exports.ATTR_CLOUD_REGION = exports.ATTR_CLOUD_PROVIDER = exports.ATTR_CLOUD_AVAILABILITY_ZONE = exports.ATTR_CLOUD_ACCOUNT_ID = void 0;
    exports.ATTR_CLOUD_ACCOUNT_ID = "cloud.account.id";
    exports.ATTR_CLOUD_AVAILABILITY_ZONE = "cloud.availability_zone";
    exports.ATTR_CLOUD_PROVIDER = "cloud.provider";
    exports.ATTR_CLOUD_REGION = "cloud.region";
    exports.ATTR_CONTAINER_ID = "container.id";
    exports.ATTR_CONTAINER_IMAGE_NAME = "container.image.name";
    exports.ATTR_CONTAINER_IMAGE_TAGS = "container.image.tags";
    exports.ATTR_CONTAINER_NAME = "container.name";
    exports.ATTR_HOST_ARCH = "host.arch";
    exports.ATTR_HOST_ID = "host.id";
    exports.ATTR_HOST_IMAGE_ID = "host.image.id";
    exports.ATTR_HOST_IMAGE_NAME = "host.image.name";
    exports.ATTR_HOST_IMAGE_VERSION = "host.image.version";
    exports.ATTR_HOST_NAME = "host.name";
    exports.ATTR_HOST_TYPE = "host.type";
    exports.ATTR_K8S_CLUSTER_NAME = "k8s.cluster.name";
    exports.ATTR_K8S_DEPLOYMENT_NAME = "k8s.deployment.name";
    exports.ATTR_K8S_NAMESPACE_NAME = "k8s.namespace.name";
    exports.ATTR_K8S_POD_NAME = "k8s.pod.name";
    exports.ATTR_OS_TYPE = "os.type";
    exports.ATTR_OS_VERSION = "os.version";
    exports.ATTR_PROCESS_COMMAND = "process.command";
    exports.ATTR_PROCESS_COMMAND_ARGS = "process.command_args";
    exports.ATTR_PROCESS_EXECUTABLE_NAME = "process.executable.name";
    exports.ATTR_PROCESS_EXECUTABLE_PATH = "process.executable.path";
    exports.ATTR_PROCESS_OWNER = "process.owner";
    exports.ATTR_PROCESS_PID = "process.pid";
    exports.ATTR_PROCESS_RUNTIME_DESCRIPTION = "process.runtime.description";
    exports.ATTR_PROCESS_RUNTIME_NAME = "process.runtime.name";
    exports.ATTR_PROCESS_RUNTIME_VERSION = "process.runtime.version";
    exports.ATTR_SERVICE_INSTANCE_ID = "service.instance.id";
    exports.ATTR_SERVICE_NAMESPACE = "service.namespace";
    exports.ATTR_WEBENGINE_DESCRIPTION = "webengine.description";
    exports.ATTR_WEBENGINE_NAME = "webengine.name";
    exports.ATTR_WEBENGINE_VERSION = "webengine.version";
  }
});

// node_modules/@opentelemetry/resources/build/src/detectors/platform/node/machine-id/getMachineId.js
var require_getMachineId = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/detectors/platform/node/machine-id/getMachineId.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getMachineId = void 0;
    var process2 = __require("process");
    var getMachineIdImpl;
    async function getMachineId() {
      if (!getMachineIdImpl) {
        switch (process2.platform) {
          case "darwin":
            getMachineIdImpl = (await import("./getMachineId-darwin-7CULIDHM.mjs")).getMachineId;
            break;
          case "linux":
            getMachineIdImpl = (await import("./getMachineId-linux-26DRWTQJ.mjs")).getMachineId;
            break;
          case "freebsd":
            getMachineIdImpl = (await import("./getMachineId-bsd-4XAKMHAJ.mjs")).getMachineId;
            break;
          case "win32":
            getMachineIdImpl = (await import("./getMachineId-win-QBHQRFGL.mjs")).getMachineId;
            break;
          default:
            getMachineIdImpl = (await import("./getMachineId-unsupported-D3XVQWII.mjs")).getMachineId;
            break;
        }
      }
      return getMachineIdImpl();
    }
    __name(getMachineId, "getMachineId");
    exports.getMachineId = getMachineId;
  }
});

// node_modules/@opentelemetry/resources/build/src/detectors/platform/node/utils.js
var require_utils2 = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/detectors/platform/node/utils.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.normalizeType = exports.normalizeArch = void 0;
    var normalizeArch = /* @__PURE__ */ __name((nodeArchString) => {
      switch (nodeArchString) {
        case "arm":
          return "arm32";
        case "ppc":
          return "ppc32";
        case "x64":
          return "amd64";
        default:
          return nodeArchString;
      }
    }, "normalizeArch");
    exports.normalizeArch = normalizeArch;
    var normalizeType = /* @__PURE__ */ __name((nodePlatform) => {
      switch (nodePlatform) {
        case "sunos":
          return "solaris";
        case "win32":
          return "windows";
        default:
          return nodePlatform;
      }
    }, "normalizeType");
    exports.normalizeType = normalizeType;
  }
});

// node_modules/@opentelemetry/resources/build/src/detectors/platform/node/HostDetector.js
var require_HostDetector = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/detectors/platform/node/HostDetector.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.hostDetector = void 0;
    var semconv_1 = require_semconv();
    var os_1 = __require("os");
    var getMachineId_1 = require_getMachineId();
    var utils_1 = require_utils2();
    var HostDetector = class {
      static {
        __name(this, "HostDetector");
      }
      detect(_config) {
        const attributes = {
          [semconv_1.ATTR_HOST_NAME]: (0, os_1.hostname)(),
          [semconv_1.ATTR_HOST_ARCH]: (0, utils_1.normalizeArch)((0, os_1.arch)()),
          [semconv_1.ATTR_HOST_ID]: (0, getMachineId_1.getMachineId)()
        };
        return { attributes };
      }
    };
    exports.hostDetector = new HostDetector();
  }
});

// node_modules/@opentelemetry/resources/build/src/detectors/platform/node/OSDetector.js
var require_OSDetector = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/detectors/platform/node/OSDetector.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.osDetector = void 0;
    var semconv_1 = require_semconv();
    var os_1 = __require("os");
    var utils_1 = require_utils2();
    var OSDetector = class {
      static {
        __name(this, "OSDetector");
      }
      detect(_config) {
        const attributes = {
          [semconv_1.ATTR_OS_TYPE]: (0, utils_1.normalizeType)((0, os_1.platform)()),
          [semconv_1.ATTR_OS_VERSION]: (0, os_1.release)()
        };
        return { attributes };
      }
    };
    exports.osDetector = new OSDetector();
  }
});

// node_modules/@opentelemetry/resources/build/src/detectors/platform/node/ProcessDetector.js
var require_ProcessDetector = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/detectors/platform/node/ProcessDetector.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.processDetector = void 0;
    var api_1 = (init_esm2(), __toCommonJS(esm_exports));
    var semconv_1 = require_semconv();
    var os2 = __require("os");
    var ProcessDetector = class {
      static {
        __name(this, "ProcessDetector");
      }
      detect(_config) {
        const attributes = {
          [semconv_1.ATTR_PROCESS_PID]: process.pid,
          [semconv_1.ATTR_PROCESS_EXECUTABLE_NAME]: process.title,
          [semconv_1.ATTR_PROCESS_EXECUTABLE_PATH]: process.execPath,
          [semconv_1.ATTR_PROCESS_COMMAND_ARGS]: [
            process.argv[0],
            ...process.execArgv,
            ...process.argv.slice(1)
          ],
          [semconv_1.ATTR_PROCESS_RUNTIME_VERSION]: process.versions.node,
          [semconv_1.ATTR_PROCESS_RUNTIME_NAME]: "nodejs",
          [semconv_1.ATTR_PROCESS_RUNTIME_DESCRIPTION]: "Node.js"
        };
        if (process.argv.length > 1) {
          attributes[semconv_1.ATTR_PROCESS_COMMAND] = process.argv[1];
        }
        try {
          const userInfo = os2.userInfo();
          attributes[semconv_1.ATTR_PROCESS_OWNER] = userInfo.username;
        } catch (e) {
          api_1.diag.debug(`error obtaining process owner: ${e}`);
        }
        return { attributes };
      }
    };
    exports.processDetector = new ProcessDetector();
  }
});

// node_modules/@opentelemetry/resources/build/src/detectors/platform/node/ServiceInstanceIdDetector.js
var require_ServiceInstanceIdDetector = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/detectors/platform/node/ServiceInstanceIdDetector.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.serviceInstanceIdDetector = void 0;
    var semconv_1 = require_semconv();
    var crypto_1 = __require("crypto");
    var ServiceInstanceIdDetector = class {
      static {
        __name(this, "ServiceInstanceIdDetector");
      }
      detect(_config) {
        return {
          attributes: {
            [semconv_1.ATTR_SERVICE_INSTANCE_ID]: (0, crypto_1.randomUUID)()
          }
        };
      }
    };
    exports.serviceInstanceIdDetector = new ServiceInstanceIdDetector();
  }
});

// node_modules/@opentelemetry/resources/build/src/detectors/platform/node/index.js
var require_node2 = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/detectors/platform/node/index.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.serviceInstanceIdDetector = exports.processDetector = exports.osDetector = exports.hostDetector = void 0;
    var HostDetector_1 = require_HostDetector();
    Object.defineProperty(exports, "hostDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return HostDetector_1.hostDetector;
    }, "get") });
    var OSDetector_1 = require_OSDetector();
    Object.defineProperty(exports, "osDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return OSDetector_1.osDetector;
    }, "get") });
    var ProcessDetector_1 = require_ProcessDetector();
    Object.defineProperty(exports, "processDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return ProcessDetector_1.processDetector;
    }, "get") });
    var ServiceInstanceIdDetector_1 = require_ServiceInstanceIdDetector();
    Object.defineProperty(exports, "serviceInstanceIdDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return ServiceInstanceIdDetector_1.serviceInstanceIdDetector;
    }, "get") });
  }
});

// node_modules/@opentelemetry/resources/build/src/detectors/platform/index.js
var require_platform2 = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/detectors/platform/index.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.serviceInstanceIdDetector = exports.processDetector = exports.osDetector = exports.hostDetector = void 0;
    var node_1 = require_node2();
    Object.defineProperty(exports, "hostDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return node_1.hostDetector;
    }, "get") });
    Object.defineProperty(exports, "osDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return node_1.osDetector;
    }, "get") });
    Object.defineProperty(exports, "processDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return node_1.processDetector;
    }, "get") });
    Object.defineProperty(exports, "serviceInstanceIdDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return node_1.serviceInstanceIdDetector;
    }, "get") });
  }
});

// node_modules/@opentelemetry/resources/build/src/detectors/NoopDetector.js
var require_NoopDetector = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/detectors/NoopDetector.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.noopDetector = exports.NoopDetector = void 0;
    var NoopDetector = class {
      static {
        __name(this, "NoopDetector");
      }
      detect() {
        return {
          attributes: {}
        };
      }
    };
    exports.NoopDetector = NoopDetector;
    exports.noopDetector = new NoopDetector();
  }
});

// node_modules/@opentelemetry/resources/build/src/detectors/index.js
var require_detectors = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/detectors/index.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.noopDetector = exports.serviceInstanceIdDetector = exports.processDetector = exports.osDetector = exports.hostDetector = exports.envDetector = void 0;
    var EnvDetector_1 = require_EnvDetector();
    Object.defineProperty(exports, "envDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return EnvDetector_1.envDetector;
    }, "get") });
    var platform_1 = require_platform2();
    Object.defineProperty(exports, "hostDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return platform_1.hostDetector;
    }, "get") });
    Object.defineProperty(exports, "osDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return platform_1.osDetector;
    }, "get") });
    Object.defineProperty(exports, "processDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return platform_1.processDetector;
    }, "get") });
    Object.defineProperty(exports, "serviceInstanceIdDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return platform_1.serviceInstanceIdDetector;
    }, "get") });
    var NoopDetector_1 = require_NoopDetector();
    Object.defineProperty(exports, "noopDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return NoopDetector_1.noopDetector;
    }, "get") });
  }
});

// node_modules/@opentelemetry/resources/build/src/index.js
var require_src2 = __commonJS({
  "node_modules/@opentelemetry/resources/build/src/index.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.defaultServiceName = exports.emptyResource = exports.defaultResource = exports.resourceFromAttributes = exports.serviceInstanceIdDetector = exports.processDetector = exports.osDetector = exports.hostDetector = exports.envDetector = exports.detectResources = void 0;
    var detect_resources_1 = require_detect_resources();
    Object.defineProperty(exports, "detectResources", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return detect_resources_1.detectResources;
    }, "get") });
    var detectors_1 = require_detectors();
    Object.defineProperty(exports, "envDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return detectors_1.envDetector;
    }, "get") });
    Object.defineProperty(exports, "hostDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return detectors_1.hostDetector;
    }, "get") });
    Object.defineProperty(exports, "osDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return detectors_1.osDetector;
    }, "get") });
    Object.defineProperty(exports, "processDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return detectors_1.processDetector;
    }, "get") });
    Object.defineProperty(exports, "serviceInstanceIdDetector", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return detectors_1.serviceInstanceIdDetector;
    }, "get") });
    var ResourceImpl_1 = require_ResourceImpl();
    Object.defineProperty(exports, "resourceFromAttributes", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return ResourceImpl_1.resourceFromAttributes;
    }, "get") });
    Object.defineProperty(exports, "defaultResource", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return ResourceImpl_1.defaultResource;
    }, "get") });
    Object.defineProperty(exports, "emptyResource", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return ResourceImpl_1.emptyResource;
    }, "get") });
    var platform_1 = require_platform();
    Object.defineProperty(exports, "defaultServiceName", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return platform_1.defaultServiceName;
    }, "get") });
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/enums.js
var require_enums = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/enums.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ExceptionEventName = void 0;
    exports.ExceptionEventName = "exception";
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/Span.js
var require_Span = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/Span.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SpanImpl = void 0;
    var api_1 = (init_esm2(), __toCommonJS(esm_exports));
    var core_1 = require_src();
    var semantic_conventions_1 = (init_esm3(), __toCommonJS(esm_exports2));
    var enums_1 = require_enums();
    var SpanImpl = class {
      static {
        __name(this, "SpanImpl");
      }
      // Below properties are included to implement ReadableSpan for export
      // purposes but are not intended to be written-to directly.
      _spanContext;
      kind;
      parentSpanContext;
      attributes = {};
      links = [];
      events = [];
      startTime;
      resource;
      instrumentationScope;
      _droppedAttributesCount = 0;
      _droppedEventsCount = 0;
      _droppedLinksCount = 0;
      name;
      status = {
        code: api_1.SpanStatusCode.UNSET
      };
      endTime = [0, 0];
      _ended = false;
      _duration = [-1, -1];
      _spanProcessor;
      _spanLimits;
      _attributeValueLengthLimit;
      _performanceStartTime;
      _performanceOffset;
      _startTimeProvided;
      /**
       * Constructs a new SpanImpl instance.
       */
      constructor(opts) {
        const now = Date.now();
        this._spanContext = opts.spanContext;
        this._performanceStartTime = core_1.otperformance.now();
        this._performanceOffset = now - (this._performanceStartTime + (0, core_1.getTimeOrigin)());
        this._startTimeProvided = opts.startTime != null;
        this._spanLimits = opts.spanLimits;
        this._attributeValueLengthLimit = this._spanLimits.attributeValueLengthLimit || 0;
        this._spanProcessor = opts.spanProcessor;
        this.name = opts.name;
        this.parentSpanContext = opts.parentSpanContext;
        this.kind = opts.kind;
        this.links = opts.links || [];
        this.startTime = this._getTime(opts.startTime ?? now);
        this.resource = opts.resource;
        this.instrumentationScope = opts.scope;
        if (opts.attributes != null) {
          this.setAttributes(opts.attributes);
        }
        this._spanProcessor.onStart(this, opts.context);
      }
      spanContext() {
        return this._spanContext;
      }
      setAttribute(key, value) {
        if (value == null || this._isSpanEnded())
          return this;
        if (key.length === 0) {
          api_1.diag.warn(`Invalid attribute key: ${key}`);
          return this;
        }
        if (!(0, core_1.isAttributeValue)(value)) {
          api_1.diag.warn(`Invalid attribute value set for key: ${key}`);
          return this;
        }
        const { attributeCountLimit } = this._spanLimits;
        if (attributeCountLimit !== void 0 && Object.keys(this.attributes).length >= attributeCountLimit && !Object.prototype.hasOwnProperty.call(this.attributes, key)) {
          this._droppedAttributesCount++;
          return this;
        }
        this.attributes[key] = this._truncateToSize(value);
        return this;
      }
      setAttributes(attributes) {
        for (const [k, v] of Object.entries(attributes)) {
          this.setAttribute(k, v);
        }
        return this;
      }
      /**
       *
       * @param name Span Name
       * @param [attributesOrStartTime] Span attributes or start time
       *     if type is {@type TimeInput} and 3rd param is undefined
       * @param [timeStamp] Specified time stamp for the event
       */
      addEvent(name, attributesOrStartTime, timeStamp) {
        if (this._isSpanEnded())
          return this;
        const { eventCountLimit } = this._spanLimits;
        if (eventCountLimit === 0) {
          api_1.diag.warn("No events allowed.");
          this._droppedEventsCount++;
          return this;
        }
        if (eventCountLimit !== void 0 && this.events.length >= eventCountLimit) {
          if (this._droppedEventsCount === 0) {
            api_1.diag.debug("Dropping extra events.");
          }
          this.events.shift();
          this._droppedEventsCount++;
        }
        if ((0, core_1.isTimeInput)(attributesOrStartTime)) {
          if (!(0, core_1.isTimeInput)(timeStamp)) {
            timeStamp = attributesOrStartTime;
          }
          attributesOrStartTime = void 0;
        }
        const attributes = (0, core_1.sanitizeAttributes)(attributesOrStartTime);
        this.events.push({
          name,
          attributes,
          time: this._getTime(timeStamp),
          droppedAttributesCount: 0
        });
        return this;
      }
      addLink(link) {
        this.links.push(link);
        return this;
      }
      addLinks(links) {
        this.links.push(...links);
        return this;
      }
      setStatus(status) {
        if (this._isSpanEnded())
          return this;
        this.status = { ...status };
        if (this.status.message != null && typeof status.message !== "string") {
          api_1.diag.warn(`Dropping invalid status.message of type '${typeof status.message}', expected 'string'`);
          delete this.status.message;
        }
        return this;
      }
      updateName(name) {
        if (this._isSpanEnded())
          return this;
        this.name = name;
        return this;
      }
      end(endTime) {
        if (this._isSpanEnded()) {
          api_1.diag.error(`${this.name} ${this._spanContext.traceId}-${this._spanContext.spanId} - You can only call end() on a span once.`);
          return;
        }
        this._ended = true;
        this.endTime = this._getTime(endTime);
        this._duration = (0, core_1.hrTimeDuration)(this.startTime, this.endTime);
        if (this._duration[0] < 0) {
          api_1.diag.warn("Inconsistent start and end time, startTime > endTime. Setting span duration to 0ms.", this.startTime, this.endTime);
          this.endTime = this.startTime.slice();
          this._duration = [0, 0];
        }
        if (this._droppedEventsCount > 0) {
          api_1.diag.warn(`Dropped ${this._droppedEventsCount} events because eventCountLimit reached`);
        }
        this._spanProcessor.onEnd(this);
      }
      _getTime(inp) {
        if (typeof inp === "number" && inp <= core_1.otperformance.now()) {
          return (0, core_1.hrTime)(inp + this._performanceOffset);
        }
        if (typeof inp === "number") {
          return (0, core_1.millisToHrTime)(inp);
        }
        if (inp instanceof Date) {
          return (0, core_1.millisToHrTime)(inp.getTime());
        }
        if ((0, core_1.isTimeInputHrTime)(inp)) {
          return inp;
        }
        if (this._startTimeProvided) {
          return (0, core_1.millisToHrTime)(Date.now());
        }
        const msDuration = core_1.otperformance.now() - this._performanceStartTime;
        return (0, core_1.addHrTimes)(this.startTime, (0, core_1.millisToHrTime)(msDuration));
      }
      isRecording() {
        return this._ended === false;
      }
      recordException(exception, time) {
        const attributes = {};
        if (typeof exception === "string") {
          attributes[semantic_conventions_1.ATTR_EXCEPTION_MESSAGE] = exception;
        } else if (exception) {
          if (exception.code) {
            attributes[semantic_conventions_1.ATTR_EXCEPTION_TYPE] = exception.code.toString();
          } else if (exception.name) {
            attributes[semantic_conventions_1.ATTR_EXCEPTION_TYPE] = exception.name;
          }
          if (exception.message) {
            attributes[semantic_conventions_1.ATTR_EXCEPTION_MESSAGE] = exception.message;
          }
          if (exception.stack) {
            attributes[semantic_conventions_1.ATTR_EXCEPTION_STACKTRACE] = exception.stack;
          }
        }
        if (attributes[semantic_conventions_1.ATTR_EXCEPTION_TYPE] || attributes[semantic_conventions_1.ATTR_EXCEPTION_MESSAGE]) {
          this.addEvent(enums_1.ExceptionEventName, attributes, time);
        } else {
          api_1.diag.warn(`Failed to record an exception ${exception}`);
        }
      }
      get duration() {
        return this._duration;
      }
      get ended() {
        return this._ended;
      }
      get droppedAttributesCount() {
        return this._droppedAttributesCount;
      }
      get droppedEventsCount() {
        return this._droppedEventsCount;
      }
      get droppedLinksCount() {
        return this._droppedLinksCount;
      }
      _isSpanEnded() {
        if (this._ended) {
          const error = new Error(`Operation attempted on ended Span {traceId: ${this._spanContext.traceId}, spanId: ${this._spanContext.spanId}}`);
          api_1.diag.warn(`Cannot execute the operation on ended Span {traceId: ${this._spanContext.traceId}, spanId: ${this._spanContext.spanId}}`, error);
        }
        return this._ended;
      }
      // Utility function to truncate given value within size
      // for value type of string, will truncate to given limit
      // for type of non-string, will return same value
      _truncateToLimitUtil(value, limit) {
        if (value.length <= limit) {
          return value;
        }
        return value.substring(0, limit);
      }
      /**
       * If the given attribute value is of type string and has more characters than given {@code attributeValueLengthLimit} then
       * return string with truncated to {@code attributeValueLengthLimit} characters
       *
       * If the given attribute value is array of strings then
       * return new array of strings with each element truncated to {@code attributeValueLengthLimit} characters
       *
       * Otherwise return same Attribute {@code value}
       *
       * @param value Attribute value
       * @returns truncated attribute value if required, otherwise same value
       */
      _truncateToSize(value) {
        const limit = this._attributeValueLengthLimit;
        if (limit <= 0) {
          api_1.diag.warn(`Attribute value limit must be positive, got ${limit}`);
          return value;
        }
        if (typeof value === "string") {
          return this._truncateToLimitUtil(value, limit);
        }
        if (Array.isArray(value)) {
          return value.map((val) => typeof val === "string" ? this._truncateToLimitUtil(val, limit) : val);
        }
        return value;
      }
    };
    exports.SpanImpl = SpanImpl;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/Sampler.js
var require_Sampler = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/Sampler.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SamplingDecision = void 0;
    var SamplingDecision;
    (function(SamplingDecision2) {
      SamplingDecision2[SamplingDecision2["NOT_RECORD"] = 0] = "NOT_RECORD";
      SamplingDecision2[SamplingDecision2["RECORD"] = 1] = "RECORD";
      SamplingDecision2[SamplingDecision2["RECORD_AND_SAMPLED"] = 2] = "RECORD_AND_SAMPLED";
    })(SamplingDecision = exports.SamplingDecision || (exports.SamplingDecision = {}));
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/sampler/AlwaysOffSampler.js
var require_AlwaysOffSampler = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/sampler/AlwaysOffSampler.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AlwaysOffSampler = void 0;
    var Sampler_1 = require_Sampler();
    var AlwaysOffSampler = class {
      static {
        __name(this, "AlwaysOffSampler");
      }
      shouldSample() {
        return {
          decision: Sampler_1.SamplingDecision.NOT_RECORD
        };
      }
      toString() {
        return "AlwaysOffSampler";
      }
    };
    exports.AlwaysOffSampler = AlwaysOffSampler;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/sampler/AlwaysOnSampler.js
var require_AlwaysOnSampler = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/sampler/AlwaysOnSampler.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AlwaysOnSampler = void 0;
    var Sampler_1 = require_Sampler();
    var AlwaysOnSampler = class {
      static {
        __name(this, "AlwaysOnSampler");
      }
      shouldSample() {
        return {
          decision: Sampler_1.SamplingDecision.RECORD_AND_SAMPLED
        };
      }
      toString() {
        return "AlwaysOnSampler";
      }
    };
    exports.AlwaysOnSampler = AlwaysOnSampler;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/sampler/ParentBasedSampler.js
var require_ParentBasedSampler = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/sampler/ParentBasedSampler.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ParentBasedSampler = void 0;
    var api_1 = (init_esm2(), __toCommonJS(esm_exports));
    var core_1 = require_src();
    var AlwaysOffSampler_1 = require_AlwaysOffSampler();
    var AlwaysOnSampler_1 = require_AlwaysOnSampler();
    var ParentBasedSampler = class {
      static {
        __name(this, "ParentBasedSampler");
      }
      _root;
      _remoteParentSampled;
      _remoteParentNotSampled;
      _localParentSampled;
      _localParentNotSampled;
      constructor(config) {
        this._root = config.root;
        if (!this._root) {
          (0, core_1.globalErrorHandler)(new Error("ParentBasedSampler must have a root sampler configured"));
          this._root = new AlwaysOnSampler_1.AlwaysOnSampler();
        }
        this._remoteParentSampled = config.remoteParentSampled ?? new AlwaysOnSampler_1.AlwaysOnSampler();
        this._remoteParentNotSampled = config.remoteParentNotSampled ?? new AlwaysOffSampler_1.AlwaysOffSampler();
        this._localParentSampled = config.localParentSampled ?? new AlwaysOnSampler_1.AlwaysOnSampler();
        this._localParentNotSampled = config.localParentNotSampled ?? new AlwaysOffSampler_1.AlwaysOffSampler();
      }
      shouldSample(context, traceId, spanName, spanKind, attributes, links) {
        const parentContext = api_1.trace.getSpanContext(context);
        if (!parentContext || !(0, api_1.isSpanContextValid)(parentContext)) {
          return this._root.shouldSample(context, traceId, spanName, spanKind, attributes, links);
        }
        if (parentContext.isRemote) {
          if (parentContext.traceFlags & api_1.TraceFlags.SAMPLED) {
            return this._remoteParentSampled.shouldSample(context, traceId, spanName, spanKind, attributes, links);
          }
          return this._remoteParentNotSampled.shouldSample(context, traceId, spanName, spanKind, attributes, links);
        }
        if (parentContext.traceFlags & api_1.TraceFlags.SAMPLED) {
          return this._localParentSampled.shouldSample(context, traceId, spanName, spanKind, attributes, links);
        }
        return this._localParentNotSampled.shouldSample(context, traceId, spanName, spanKind, attributes, links);
      }
      toString() {
        return `ParentBased{root=${this._root.toString()}, remoteParentSampled=${this._remoteParentSampled.toString()}, remoteParentNotSampled=${this._remoteParentNotSampled.toString()}, localParentSampled=${this._localParentSampled.toString()}, localParentNotSampled=${this._localParentNotSampled.toString()}}`;
      }
    };
    exports.ParentBasedSampler = ParentBasedSampler;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/sampler/TraceIdRatioBasedSampler.js
var require_TraceIdRatioBasedSampler = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/sampler/TraceIdRatioBasedSampler.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TraceIdRatioBasedSampler = void 0;
    var api_1 = (init_esm2(), __toCommonJS(esm_exports));
    var Sampler_1 = require_Sampler();
    var TraceIdRatioBasedSampler = class {
      static {
        __name(this, "TraceIdRatioBasedSampler");
      }
      _ratio;
      _upperBound;
      constructor(_ratio = 0) {
        this._ratio = _ratio;
        this._ratio = this._normalize(_ratio);
        this._upperBound = Math.floor(this._ratio * 4294967295);
      }
      shouldSample(context, traceId) {
        return {
          decision: (0, api_1.isValidTraceId)(traceId) && this._accumulate(traceId) < this._upperBound ? Sampler_1.SamplingDecision.RECORD_AND_SAMPLED : Sampler_1.SamplingDecision.NOT_RECORD
        };
      }
      toString() {
        return `TraceIdRatioBased{${this._ratio}}`;
      }
      _normalize(ratio) {
        if (typeof ratio !== "number" || isNaN(ratio))
          return 0;
        return ratio >= 1 ? 1 : ratio <= 0 ? 0 : ratio;
      }
      _accumulate(traceId) {
        let accumulation = 0;
        for (let i = 0; i < traceId.length / 8; i++) {
          const pos = i * 8;
          const part = parseInt(traceId.slice(pos, pos + 8), 16);
          accumulation = (accumulation ^ part) >>> 0;
        }
        return accumulation;
      }
    };
    exports.TraceIdRatioBasedSampler = TraceIdRatioBasedSampler;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/config.js
var require_config = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/config.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.buildSamplerFromEnv = exports.loadDefaultConfig = void 0;
    var api_1 = (init_esm2(), __toCommonJS(esm_exports));
    var core_1 = require_src();
    var AlwaysOffSampler_1 = require_AlwaysOffSampler();
    var AlwaysOnSampler_1 = require_AlwaysOnSampler();
    var ParentBasedSampler_1 = require_ParentBasedSampler();
    var TraceIdRatioBasedSampler_1 = require_TraceIdRatioBasedSampler();
    var DEFAULT_RATIO = 1;
    function loadDefaultConfig() {
      return {
        sampler: buildSamplerFromEnv(),
        forceFlushTimeoutMillis: 3e4,
        generalLimits: {
          attributeValueLengthLimit: (0, core_1.getNumberFromEnv)("OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT") ?? Infinity,
          attributeCountLimit: (0, core_1.getNumberFromEnv)("OTEL_ATTRIBUTE_COUNT_LIMIT") ?? 128
        },
        spanLimits: {
          attributeValueLengthLimit: (0, core_1.getNumberFromEnv)("OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT") ?? Infinity,
          attributeCountLimit: (0, core_1.getNumberFromEnv)("OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT") ?? 128,
          linkCountLimit: (0, core_1.getNumberFromEnv)("OTEL_SPAN_LINK_COUNT_LIMIT") ?? 128,
          eventCountLimit: (0, core_1.getNumberFromEnv)("OTEL_SPAN_EVENT_COUNT_LIMIT") ?? 128,
          attributePerEventCountLimit: (0, core_1.getNumberFromEnv)("OTEL_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT") ?? 128,
          attributePerLinkCountLimit: (0, core_1.getNumberFromEnv)("OTEL_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT") ?? 128
        }
      };
    }
    __name(loadDefaultConfig, "loadDefaultConfig");
    exports.loadDefaultConfig = loadDefaultConfig;
    function buildSamplerFromEnv() {
      const sampler = (0, core_1.getStringFromEnv)("OTEL_TRACES_SAMPLER") ?? "parentbased_always_on";
      switch (sampler) {
        case "always_on":
          return new AlwaysOnSampler_1.AlwaysOnSampler();
        case "always_off":
          return new AlwaysOffSampler_1.AlwaysOffSampler();
        case "parentbased_always_on":
          return new ParentBasedSampler_1.ParentBasedSampler({
            root: new AlwaysOnSampler_1.AlwaysOnSampler()
          });
        case "parentbased_always_off":
          return new ParentBasedSampler_1.ParentBasedSampler({
            root: new AlwaysOffSampler_1.AlwaysOffSampler()
          });
        case "traceidratio":
          return new TraceIdRatioBasedSampler_1.TraceIdRatioBasedSampler(getSamplerProbabilityFromEnv());
        case "parentbased_traceidratio":
          return new ParentBasedSampler_1.ParentBasedSampler({
            root: new TraceIdRatioBasedSampler_1.TraceIdRatioBasedSampler(getSamplerProbabilityFromEnv())
          });
        default:
          api_1.diag.error(`OTEL_TRACES_SAMPLER value "${sampler}" invalid, defaulting to "${"parentbased_always_on"}".`);
          return new ParentBasedSampler_1.ParentBasedSampler({
            root: new AlwaysOnSampler_1.AlwaysOnSampler()
          });
      }
    }
    __name(buildSamplerFromEnv, "buildSamplerFromEnv");
    exports.buildSamplerFromEnv = buildSamplerFromEnv;
    function getSamplerProbabilityFromEnv() {
      const probability = (0, core_1.getNumberFromEnv)("OTEL_TRACES_SAMPLER_ARG");
      if (probability == null) {
        api_1.diag.error(`OTEL_TRACES_SAMPLER_ARG is blank, defaulting to ${DEFAULT_RATIO}.`);
        return DEFAULT_RATIO;
      }
      if (probability < 0 || probability > 1) {
        api_1.diag.error(`OTEL_TRACES_SAMPLER_ARG=${probability} was given, but it is out of range ([0..1]), defaulting to ${DEFAULT_RATIO}.`);
        return DEFAULT_RATIO;
      }
      return probability;
    }
    __name(getSamplerProbabilityFromEnv, "getSamplerProbabilityFromEnv");
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/utility.js
var require_utility = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/utility.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reconfigureLimits = exports.mergeConfig = exports.DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT = exports.DEFAULT_ATTRIBUTE_COUNT_LIMIT = void 0;
    var config_1 = require_config();
    var core_1 = require_src();
    exports.DEFAULT_ATTRIBUTE_COUNT_LIMIT = 128;
    exports.DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT = Infinity;
    function mergeConfig(userConfig) {
      const perInstanceDefaults = {
        sampler: (0, config_1.buildSamplerFromEnv)()
      };
      const DEFAULT_CONFIG = (0, config_1.loadDefaultConfig)();
      const target = Object.assign({}, DEFAULT_CONFIG, perInstanceDefaults, userConfig);
      target.generalLimits = Object.assign({}, DEFAULT_CONFIG.generalLimits, userConfig.generalLimits || {});
      target.spanLimits = Object.assign({}, DEFAULT_CONFIG.spanLimits, userConfig.spanLimits || {});
      return target;
    }
    __name(mergeConfig, "mergeConfig");
    exports.mergeConfig = mergeConfig;
    function reconfigureLimits(userConfig) {
      const spanLimits = Object.assign({}, userConfig.spanLimits);
      spanLimits.attributeCountLimit = userConfig.spanLimits?.attributeCountLimit ?? userConfig.generalLimits?.attributeCountLimit ?? (0, core_1.getNumberFromEnv)("OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT") ?? (0, core_1.getNumberFromEnv)("OTEL_ATTRIBUTE_COUNT_LIMIT") ?? exports.DEFAULT_ATTRIBUTE_COUNT_LIMIT;
      spanLimits.attributeValueLengthLimit = userConfig.spanLimits?.attributeValueLengthLimit ?? userConfig.generalLimits?.attributeValueLengthLimit ?? (0, core_1.getNumberFromEnv)("OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT") ?? (0, core_1.getNumberFromEnv)("OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT") ?? exports.DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT;
      return Object.assign({}, userConfig, { spanLimits });
    }
    __name(reconfigureLimits, "reconfigureLimits");
    exports.reconfigureLimits = reconfigureLimits;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/export/BatchSpanProcessorBase.js
var require_BatchSpanProcessorBase = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/export/BatchSpanProcessorBase.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BatchSpanProcessorBase = void 0;
    var api_1 = (init_esm2(), __toCommonJS(esm_exports));
    var core_1 = require_src();
    var BatchSpanProcessorBase = class {
      static {
        __name(this, "BatchSpanProcessorBase");
      }
      _exporter;
      _maxExportBatchSize;
      _maxQueueSize;
      _scheduledDelayMillis;
      _exportTimeoutMillis;
      _isExporting = false;
      _finishedSpans = [];
      _timer;
      _shutdownOnce;
      _droppedSpansCount = 0;
      constructor(_exporter, config) {
        this._exporter = _exporter;
        this._maxExportBatchSize = typeof config?.maxExportBatchSize === "number" ? config.maxExportBatchSize : (0, core_1.getNumberFromEnv)("OTEL_BSP_MAX_EXPORT_BATCH_SIZE") ?? 512;
        this._maxQueueSize = typeof config?.maxQueueSize === "number" ? config.maxQueueSize : (0, core_1.getNumberFromEnv)("OTEL_BSP_MAX_QUEUE_SIZE") ?? 2048;
        this._scheduledDelayMillis = typeof config?.scheduledDelayMillis === "number" ? config.scheduledDelayMillis : (0, core_1.getNumberFromEnv)("OTEL_BSP_SCHEDULE_DELAY") ?? 5e3;
        this._exportTimeoutMillis = typeof config?.exportTimeoutMillis === "number" ? config.exportTimeoutMillis : (0, core_1.getNumberFromEnv)("OTEL_BSP_EXPORT_TIMEOUT") ?? 3e4;
        this._shutdownOnce = new core_1.BindOnceFuture(this._shutdown, this);
        if (this._maxExportBatchSize > this._maxQueueSize) {
          api_1.diag.warn("BatchSpanProcessor: maxExportBatchSize must be smaller or equal to maxQueueSize, setting maxExportBatchSize to match maxQueueSize");
          this._maxExportBatchSize = this._maxQueueSize;
        }
      }
      forceFlush() {
        if (this._shutdownOnce.isCalled) {
          return this._shutdownOnce.promise;
        }
        return this._flushAll();
      }
      // does nothing.
      onStart(_span, _parentContext) {
      }
      onEnd(span) {
        if (this._shutdownOnce.isCalled) {
          return;
        }
        if ((span.spanContext().traceFlags & api_1.TraceFlags.SAMPLED) === 0) {
          return;
        }
        this._addToBuffer(span);
      }
      shutdown() {
        return this._shutdownOnce.call();
      }
      _shutdown() {
        return Promise.resolve().then(() => {
          return this.onShutdown();
        }).then(() => {
          return this._flushAll();
        }).then(() => {
          return this._exporter.shutdown();
        });
      }
      /** Add a span in the buffer. */
      _addToBuffer(span) {
        if (this._finishedSpans.length >= this._maxQueueSize) {
          if (this._droppedSpansCount === 0) {
            api_1.diag.debug("maxQueueSize reached, dropping spans");
          }
          this._droppedSpansCount++;
          return;
        }
        if (this._droppedSpansCount > 0) {
          api_1.diag.warn(`Dropped ${this._droppedSpansCount} spans because maxQueueSize reached`);
          this._droppedSpansCount = 0;
        }
        this._finishedSpans.push(span);
        this._maybeStartTimer();
      }
      /**
       * Send all spans to the exporter respecting the batch size limit
       * This function is used only on forceFlush or shutdown,
       * for all other cases _flush should be used
       * */
      _flushAll() {
        return new Promise((resolve, reject) => {
          const promises = [];
          const count = Math.ceil(this._finishedSpans.length / this._maxExportBatchSize);
          for (let i = 0, j = count; i < j; i++) {
            promises.push(this._flushOneBatch());
          }
          Promise.all(promises).then(() => {
            resolve();
          }).catch(reject);
        });
      }
      _flushOneBatch() {
        this._clearTimer();
        if (this._finishedSpans.length === 0) {
          return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error("Timeout"));
          }, this._exportTimeoutMillis);
          api_1.context.with((0, core_1.suppressTracing)(api_1.context.active()), () => {
            let spans;
            if (this._finishedSpans.length <= this._maxExportBatchSize) {
              spans = this._finishedSpans;
              this._finishedSpans = [];
            } else {
              spans = this._finishedSpans.splice(0, this._maxExportBatchSize);
            }
            const doExport = /* @__PURE__ */ __name(() => this._exporter.export(spans, (result) => {
              clearTimeout(timer);
              if (result.code === core_1.ExportResultCode.SUCCESS) {
                resolve();
              } else {
                reject(result.error ?? new Error("BatchSpanProcessor: span export failed"));
              }
            }), "doExport");
            let pendingResources = null;
            for (let i = 0, len = spans.length; i < len; i++) {
              const span = spans[i];
              if (span.resource.asyncAttributesPending && span.resource.waitForAsyncAttributes) {
                pendingResources ??= [];
                pendingResources.push(span.resource.waitForAsyncAttributes());
              }
            }
            if (pendingResources === null) {
              doExport();
            } else {
              Promise.all(pendingResources).then(doExport, (err) => {
                (0, core_1.globalErrorHandler)(err);
                reject(err);
              });
            }
          });
        });
      }
      _maybeStartTimer() {
        if (this._isExporting)
          return;
        const flush = /* @__PURE__ */ __name(() => {
          this._isExporting = true;
          this._flushOneBatch().finally(() => {
            this._isExporting = false;
            if (this._finishedSpans.length > 0) {
              this._clearTimer();
              this._maybeStartTimer();
            }
          }).catch((e) => {
            this._isExporting = false;
            (0, core_1.globalErrorHandler)(e);
          });
        }, "flush");
        if (this._finishedSpans.length >= this._maxExportBatchSize) {
          return flush();
        }
        if (this._timer !== void 0)
          return;
        this._timer = setTimeout(() => flush(), this._scheduledDelayMillis);
        (0, core_1.unrefTimer)(this._timer);
      }
      _clearTimer() {
        if (this._timer !== void 0) {
          clearTimeout(this._timer);
          this._timer = void 0;
        }
      }
    };
    exports.BatchSpanProcessorBase = BatchSpanProcessorBase;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/platform/node/export/BatchSpanProcessor.js
var require_BatchSpanProcessor = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/platform/node/export/BatchSpanProcessor.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BatchSpanProcessor = void 0;
    var BatchSpanProcessorBase_1 = require_BatchSpanProcessorBase();
    var BatchSpanProcessor = class extends BatchSpanProcessorBase_1.BatchSpanProcessorBase {
      static {
        __name(this, "BatchSpanProcessor");
      }
      onShutdown() {
      }
    };
    exports.BatchSpanProcessor = BatchSpanProcessor;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/platform/node/RandomIdGenerator.js
var require_RandomIdGenerator = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/platform/node/RandomIdGenerator.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RandomIdGenerator = void 0;
    var SPAN_ID_BYTES = 8;
    var TRACE_ID_BYTES = 16;
    var RandomIdGenerator2 = class {
      static {
        __name(this, "RandomIdGenerator");
      }
      /**
       * Returns a random 16-byte trace ID formatted/encoded as a 32 lowercase hex
       * characters corresponding to 128 bits.
       */
      generateTraceId = getIdGenerator(TRACE_ID_BYTES);
      /**
       * Returns a random 8-byte span ID formatted/encoded as a 16 lowercase hex
       * characters corresponding to 64 bits.
       */
      generateSpanId = getIdGenerator(SPAN_ID_BYTES);
    };
    exports.RandomIdGenerator = RandomIdGenerator2;
    var SHARED_BUFFER = Buffer.allocUnsafe(TRACE_ID_BYTES);
    function getIdGenerator(bytes) {
      return /* @__PURE__ */ __name(function generateId() {
        for (let i = 0; i < bytes / 4; i++) {
          SHARED_BUFFER.writeUInt32BE(Math.random() * 2 ** 32 >>> 0, i * 4);
        }
        for (let i = 0; i < bytes; i++) {
          if (SHARED_BUFFER[i] > 0) {
            break;
          } else if (i === bytes - 1) {
            SHARED_BUFFER[bytes - 1] = 1;
          }
        }
        return SHARED_BUFFER.toString("hex", 0, bytes);
      }, "generateId");
    }
    __name(getIdGenerator, "getIdGenerator");
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/platform/node/index.js
var require_node3 = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/platform/node/index.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RandomIdGenerator = exports.BatchSpanProcessor = void 0;
    var BatchSpanProcessor_1 = require_BatchSpanProcessor();
    Object.defineProperty(exports, "BatchSpanProcessor", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return BatchSpanProcessor_1.BatchSpanProcessor;
    }, "get") });
    var RandomIdGenerator_1 = require_RandomIdGenerator();
    Object.defineProperty(exports, "RandomIdGenerator", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return RandomIdGenerator_1.RandomIdGenerator;
    }, "get") });
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/platform/index.js
var require_platform3 = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/platform/index.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RandomIdGenerator = exports.BatchSpanProcessor = void 0;
    var node_1 = require_node3();
    Object.defineProperty(exports, "BatchSpanProcessor", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return node_1.BatchSpanProcessor;
    }, "get") });
    Object.defineProperty(exports, "RandomIdGenerator", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return node_1.RandomIdGenerator;
    }, "get") });
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/Tracer.js
var require_Tracer = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/Tracer.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Tracer = void 0;
    var api = (init_esm2(), __toCommonJS(esm_exports));
    var core_1 = require_src();
    var Span_1 = require_Span();
    var utility_1 = require_utility();
    var platform_1 = require_platform3();
    var Tracer = class {
      static {
        __name(this, "Tracer");
      }
      _sampler;
      _generalLimits;
      _spanLimits;
      _idGenerator;
      instrumentationScope;
      _resource;
      _spanProcessor;
      /**
       * Constructs a new Tracer instance.
       */
      constructor(instrumentationScope, config, resource, spanProcessor) {
        const localConfig = (0, utility_1.mergeConfig)(config);
        this._sampler = localConfig.sampler;
        this._generalLimits = localConfig.generalLimits;
        this._spanLimits = localConfig.spanLimits;
        this._idGenerator = config.idGenerator || new platform_1.RandomIdGenerator();
        this._resource = resource;
        this._spanProcessor = spanProcessor;
        this.instrumentationScope = instrumentationScope;
      }
      /**
       * Starts a new Span or returns the default NoopSpan based on the sampling
       * decision.
       */
      startSpan(name, options = {}, context = api.context.active()) {
        if (options.root) {
          context = api.trace.deleteSpan(context);
        }
        const parentSpan = api.trace.getSpan(context);
        if ((0, core_1.isTracingSuppressed)(context)) {
          api.diag.debug("Instrumentation suppressed, returning Noop Span");
          const nonRecordingSpan = api.trace.wrapSpanContext(api.INVALID_SPAN_CONTEXT);
          return nonRecordingSpan;
        }
        const parentSpanContext = parentSpan?.spanContext();
        const spanId = this._idGenerator.generateSpanId();
        let validParentSpanContext;
        let traceId;
        let traceState;
        if (!parentSpanContext || !api.trace.isSpanContextValid(parentSpanContext)) {
          traceId = this._idGenerator.generateTraceId();
        } else {
          traceId = parentSpanContext.traceId;
          traceState = parentSpanContext.traceState;
          validParentSpanContext = parentSpanContext;
        }
        const spanKind = options.kind ?? api.SpanKind.INTERNAL;
        const links = (options.links ?? []).map((link) => {
          return {
            context: link.context,
            attributes: (0, core_1.sanitizeAttributes)(link.attributes)
          };
        });
        const attributes = (0, core_1.sanitizeAttributes)(options.attributes);
        const samplingResult = this._sampler.shouldSample(context, traceId, name, spanKind, attributes, links);
        traceState = samplingResult.traceState ?? traceState;
        const traceFlags = samplingResult.decision === api.SamplingDecision.RECORD_AND_SAMPLED ? api.TraceFlags.SAMPLED : api.TraceFlags.NONE;
        const spanContext = { traceId, spanId, traceFlags, traceState };
        if (samplingResult.decision === api.SamplingDecision.NOT_RECORD) {
          api.diag.debug("Recording is off, propagating context in a non-recording span");
          const nonRecordingSpan = api.trace.wrapSpanContext(spanContext);
          return nonRecordingSpan;
        }
        const initAttributes = (0, core_1.sanitizeAttributes)(Object.assign(attributes, samplingResult.attributes));
        const span = new Span_1.SpanImpl({
          resource: this._resource,
          scope: this.instrumentationScope,
          context,
          spanContext,
          name,
          kind: spanKind,
          links,
          parentSpanContext: validParentSpanContext,
          attributes: initAttributes,
          startTime: options.startTime,
          spanProcessor: this._spanProcessor,
          spanLimits: this._spanLimits
        });
        return span;
      }
      startActiveSpan(name, arg2, arg3, arg4) {
        let opts;
        let ctx;
        let fn;
        if (arguments.length < 2) {
          return;
        } else if (arguments.length === 2) {
          fn = arg2;
        } else if (arguments.length === 3) {
          opts = arg2;
          fn = arg3;
        } else {
          opts = arg2;
          ctx = arg3;
          fn = arg4;
        }
        const parentContext = ctx ?? api.context.active();
        const span = this.startSpan(name, opts, parentContext);
        const contextWithSpanSet = api.trace.setSpan(parentContext, span);
        return api.context.with(contextWithSpanSet, fn, void 0, span);
      }
      /** Returns the active {@link GeneralLimits}. */
      getGeneralLimits() {
        return this._generalLimits;
      }
      /** Returns the active {@link SpanLimits}. */
      getSpanLimits() {
        return this._spanLimits;
      }
    };
    exports.Tracer = Tracer;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/MultiSpanProcessor.js
var require_MultiSpanProcessor = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/MultiSpanProcessor.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MultiSpanProcessor = void 0;
    var core_1 = require_src();
    var MultiSpanProcessor = class {
      static {
        __name(this, "MultiSpanProcessor");
      }
      _spanProcessors;
      constructor(_spanProcessors) {
        this._spanProcessors = _spanProcessors;
      }
      forceFlush() {
        const promises = [];
        for (const spanProcessor of this._spanProcessors) {
          promises.push(spanProcessor.forceFlush());
        }
        return new Promise((resolve) => {
          Promise.all(promises).then(() => {
            resolve();
          }).catch((error) => {
            (0, core_1.globalErrorHandler)(error || new Error("MultiSpanProcessor: forceFlush failed"));
            resolve();
          });
        });
      }
      onStart(span, context) {
        for (const spanProcessor of this._spanProcessors) {
          spanProcessor.onStart(span, context);
        }
      }
      onEnd(span) {
        for (const spanProcessor of this._spanProcessors) {
          spanProcessor.onEnd(span);
        }
      }
      shutdown() {
        const promises = [];
        for (const spanProcessor of this._spanProcessors) {
          promises.push(spanProcessor.shutdown());
        }
        return new Promise((resolve, reject) => {
          Promise.all(promises).then(() => {
            resolve();
          }, reject);
        });
      }
    };
    exports.MultiSpanProcessor = MultiSpanProcessor;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/BasicTracerProvider.js
var require_BasicTracerProvider = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/BasicTracerProvider.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BasicTracerProvider = exports.ForceFlushState = void 0;
    var core_1 = require_src();
    var resources_1 = require_src2();
    var Tracer_1 = require_Tracer();
    var config_1 = require_config();
    var MultiSpanProcessor_1 = require_MultiSpanProcessor();
    var utility_1 = require_utility();
    var ForceFlushState;
    (function(ForceFlushState2) {
      ForceFlushState2[ForceFlushState2["resolved"] = 0] = "resolved";
      ForceFlushState2[ForceFlushState2["timeout"] = 1] = "timeout";
      ForceFlushState2[ForceFlushState2["error"] = 2] = "error";
      ForceFlushState2[ForceFlushState2["unresolved"] = 3] = "unresolved";
    })(ForceFlushState = exports.ForceFlushState || (exports.ForceFlushState = {}));
    var BasicTracerProvider = class {
      static {
        __name(this, "BasicTracerProvider");
      }
      _config;
      _tracers = /* @__PURE__ */ new Map();
      _resource;
      _activeSpanProcessor;
      constructor(config = {}) {
        const mergedConfig = (0, core_1.merge)({}, (0, config_1.loadDefaultConfig)(), (0, utility_1.reconfigureLimits)(config));
        this._resource = mergedConfig.resource ?? (0, resources_1.defaultResource)();
        this._config = Object.assign({}, mergedConfig, {
          resource: this._resource
        });
        const spanProcessors = [];
        if (config.spanProcessors?.length) {
          spanProcessors.push(...config.spanProcessors);
        }
        this._activeSpanProcessor = new MultiSpanProcessor_1.MultiSpanProcessor(spanProcessors);
      }
      getTracer(name, version, options) {
        const key = `${name}@${version || ""}:${options?.schemaUrl || ""}`;
        if (!this._tracers.has(key)) {
          this._tracers.set(key, new Tracer_1.Tracer({ name, version, schemaUrl: options?.schemaUrl }, this._config, this._resource, this._activeSpanProcessor));
        }
        return this._tracers.get(key);
      }
      forceFlush() {
        const timeout = this._config.forceFlushTimeoutMillis;
        const promises = this._activeSpanProcessor["_spanProcessors"].map((spanProcessor) => {
          return new Promise((resolve) => {
            let state;
            const timeoutInterval = setTimeout(() => {
              resolve(new Error(`Span processor did not completed within timeout period of ${timeout} ms`));
              state = ForceFlushState.timeout;
            }, timeout);
            spanProcessor.forceFlush().then(() => {
              clearTimeout(timeoutInterval);
              if (state !== ForceFlushState.timeout) {
                state = ForceFlushState.resolved;
                resolve(state);
              }
            }).catch((error) => {
              clearTimeout(timeoutInterval);
              state = ForceFlushState.error;
              resolve(error);
            });
          });
        });
        return new Promise((resolve, reject) => {
          Promise.all(promises).then((results) => {
            const errors = results.filter((result) => result !== ForceFlushState.resolved);
            if (errors.length > 0) {
              reject(errors);
            } else {
              resolve();
            }
          }).catch((error) => reject([error]));
        });
      }
      shutdown() {
        return this._activeSpanProcessor.shutdown();
      }
    };
    exports.BasicTracerProvider = BasicTracerProvider;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/export/ConsoleSpanExporter.js
var require_ConsoleSpanExporter = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/export/ConsoleSpanExporter.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ConsoleSpanExporter = void 0;
    var core_1 = require_src();
    var ConsoleSpanExporter = class {
      static {
        __name(this, "ConsoleSpanExporter");
      }
      /**
       * Export spans.
       * @param spans
       * @param resultCallback
       */
      export(spans, resultCallback) {
        return this._sendSpans(spans, resultCallback);
      }
      /**
       * Shutdown the exporter.
       */
      shutdown() {
        this._sendSpans([]);
        return this.forceFlush();
      }
      /**
       * Exports any pending spans in exporter
       */
      forceFlush() {
        return Promise.resolve();
      }
      /**
       * converts span info into more readable format
       * @param span
       */
      _exportInfo(span) {
        return {
          resource: {
            attributes: span.resource.attributes
          },
          instrumentationScope: span.instrumentationScope,
          traceId: span.spanContext().traceId,
          parentSpanContext: span.parentSpanContext,
          traceState: span.spanContext().traceState?.serialize(),
          name: span.name,
          id: span.spanContext().spanId,
          kind: span.kind,
          timestamp: (0, core_1.hrTimeToMicroseconds)(span.startTime),
          duration: (0, core_1.hrTimeToMicroseconds)(span.duration),
          attributes: span.attributes,
          status: span.status,
          events: span.events,
          links: span.links
        };
      }
      /**
       * Showing spans in console
       * @param spans
       * @param done
       */
      _sendSpans(spans, done) {
        for (const span of spans) {
          console.dir(this._exportInfo(span), { depth: 3 });
        }
        if (done) {
          return done({ code: core_1.ExportResultCode.SUCCESS });
        }
      }
    };
    exports.ConsoleSpanExporter = ConsoleSpanExporter;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/export/InMemorySpanExporter.js
var require_InMemorySpanExporter = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/export/InMemorySpanExporter.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InMemorySpanExporter = void 0;
    var core_1 = require_src();
    var InMemorySpanExporter = class {
      static {
        __name(this, "InMemorySpanExporter");
      }
      _finishedSpans = [];
      /**
       * Indicates if the exporter has been "shutdown."
       * When false, exported spans will not be stored in-memory.
       */
      _stopped = false;
      export(spans, resultCallback) {
        if (this._stopped)
          return resultCallback({
            code: core_1.ExportResultCode.FAILED,
            error: new Error("Exporter has been stopped")
          });
        this._finishedSpans.push(...spans);
        setTimeout(() => resultCallback({ code: core_1.ExportResultCode.SUCCESS }), 0);
      }
      shutdown() {
        this._stopped = true;
        this._finishedSpans = [];
        return this.forceFlush();
      }
      /**
       * Exports any pending spans in the exporter
       */
      forceFlush() {
        return Promise.resolve();
      }
      reset() {
        this._finishedSpans = [];
      }
      getFinishedSpans() {
        return this._finishedSpans;
      }
    };
    exports.InMemorySpanExporter = InMemorySpanExporter;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/export/SimpleSpanProcessor.js
var require_SimpleSpanProcessor = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/export/SimpleSpanProcessor.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SimpleSpanProcessor = void 0;
    var api_1 = (init_esm2(), __toCommonJS(esm_exports));
    var core_1 = require_src();
    var SimpleSpanProcessor = class {
      static {
        __name(this, "SimpleSpanProcessor");
      }
      _exporter;
      _shutdownOnce;
      _pendingExports;
      constructor(_exporter) {
        this._exporter = _exporter;
        this._shutdownOnce = new core_1.BindOnceFuture(this._shutdown, this);
        this._pendingExports = /* @__PURE__ */ new Set();
      }
      async forceFlush() {
        await Promise.all(Array.from(this._pendingExports));
        if (this._exporter.forceFlush) {
          await this._exporter.forceFlush();
        }
      }
      onStart(_span, _parentContext) {
      }
      onEnd(span) {
        if (this._shutdownOnce.isCalled) {
          return;
        }
        if ((span.spanContext().traceFlags & api_1.TraceFlags.SAMPLED) === 0) {
          return;
        }
        const pendingExport = this._doExport(span).catch((err) => (0, core_1.globalErrorHandler)(err));
        this._pendingExports.add(pendingExport);
        pendingExport.finally(() => this._pendingExports.delete(pendingExport));
      }
      async _doExport(span) {
        if (span.resource.asyncAttributesPending) {
          await span.resource.waitForAsyncAttributes?.();
        }
        const result = await core_1.internal._export(this._exporter, [span]);
        if (result.code !== core_1.ExportResultCode.SUCCESS) {
          throw result.error ?? new Error(`SimpleSpanProcessor: span export failed (status ${result})`);
        }
      }
      shutdown() {
        return this._shutdownOnce.call();
      }
      _shutdown() {
        return this._exporter.shutdown();
      }
    };
    exports.SimpleSpanProcessor = SimpleSpanProcessor;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/export/NoopSpanProcessor.js
var require_NoopSpanProcessor = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/export/NoopSpanProcessor.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NoopSpanProcessor = void 0;
    var NoopSpanProcessor = class {
      static {
        __name(this, "NoopSpanProcessor");
      }
      onStart(_span, _context) {
      }
      onEnd(_span) {
      }
      shutdown() {
        return Promise.resolve();
      }
      forceFlush() {
        return Promise.resolve();
      }
    };
    exports.NoopSpanProcessor = NoopSpanProcessor;
  }
});

// node_modules/@opentelemetry/sdk-trace-base/build/src/index.js
var require_src3 = __commonJS({
  "node_modules/@opentelemetry/sdk-trace-base/build/src/index.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SamplingDecision = exports.TraceIdRatioBasedSampler = exports.ParentBasedSampler = exports.AlwaysOnSampler = exports.AlwaysOffSampler = exports.NoopSpanProcessor = exports.SimpleSpanProcessor = exports.InMemorySpanExporter = exports.ConsoleSpanExporter = exports.RandomIdGenerator = exports.BatchSpanProcessor = exports.BasicTracerProvider = void 0;
    var BasicTracerProvider_1 = require_BasicTracerProvider();
    Object.defineProperty(exports, "BasicTracerProvider", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return BasicTracerProvider_1.BasicTracerProvider;
    }, "get") });
    var platform_1 = require_platform3();
    Object.defineProperty(exports, "BatchSpanProcessor", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return platform_1.BatchSpanProcessor;
    }, "get") });
    Object.defineProperty(exports, "RandomIdGenerator", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return platform_1.RandomIdGenerator;
    }, "get") });
    var ConsoleSpanExporter_1 = require_ConsoleSpanExporter();
    Object.defineProperty(exports, "ConsoleSpanExporter", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return ConsoleSpanExporter_1.ConsoleSpanExporter;
    }, "get") });
    var InMemorySpanExporter_1 = require_InMemorySpanExporter();
    Object.defineProperty(exports, "InMemorySpanExporter", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return InMemorySpanExporter_1.InMemorySpanExporter;
    }, "get") });
    var SimpleSpanProcessor_1 = require_SimpleSpanProcessor();
    Object.defineProperty(exports, "SimpleSpanProcessor", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return SimpleSpanProcessor_1.SimpleSpanProcessor;
    }, "get") });
    var NoopSpanProcessor_1 = require_NoopSpanProcessor();
    Object.defineProperty(exports, "NoopSpanProcessor", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return NoopSpanProcessor_1.NoopSpanProcessor;
    }, "get") });
    var AlwaysOffSampler_1 = require_AlwaysOffSampler();
    Object.defineProperty(exports, "AlwaysOffSampler", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return AlwaysOffSampler_1.AlwaysOffSampler;
    }, "get") });
    var AlwaysOnSampler_1 = require_AlwaysOnSampler();
    Object.defineProperty(exports, "AlwaysOnSampler", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return AlwaysOnSampler_1.AlwaysOnSampler;
    }, "get") });
    var ParentBasedSampler_1 = require_ParentBasedSampler();
    Object.defineProperty(exports, "ParentBasedSampler", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return ParentBasedSampler_1.ParentBasedSampler;
    }, "get") });
    var TraceIdRatioBasedSampler_1 = require_TraceIdRatioBasedSampler();
    Object.defineProperty(exports, "TraceIdRatioBasedSampler", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return TraceIdRatioBasedSampler_1.TraceIdRatioBasedSampler;
    }, "get") });
    var Sampler_1 = require_Sampler();
    Object.defineProperty(exports, "SamplingDecision", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return Sampler_1.SamplingDecision;
    }, "get") });
  }
});

// tasks/ingest-document.ts
init_esm();
var import_supabase_js = __toESM(require_main());
import fs2 from "fs/promises";
import path from "path";
import os from "os";

// utils/pdf-parser.ts
init_esm();

// node_modules/@trigger.dev/python/dist/esm/index.js
init_esm();

// node_modules/@trigger.dev/core/dist/esm/v3/otel/index.js
init_esm();

// node_modules/@trigger.dev/core/dist/esm/v3/otel/tracingSDK.js
init_esm();
var import_sdk_trace_base = __toESM(require_src3(), 1);

// node_modules/@trigger.dev/core/dist/esm/v3/taskContext/otelProcessors.js
init_esm();

// node_modules/@trigger.dev/core/dist/esm/v3/otel/tracingSDK.js
var idGenerator = new import_sdk_trace_base.RandomIdGenerator();

// node_modules/@trigger.dev/python/dist/esm/index.js
import assert from "node:assert";
import fs from "node:fs";

// node_modules/tinyexec/dist/main.js
init_esm();
import { createRequire as __tinyexec_cr } from "node:module";
import { spawn as de } from "child_process";
import { normalize as fe } from "path";
import { cwd as he } from "process";
import {
  delimiter as N,
  resolve as qt,
  dirname as It
} from "path";
import { PassThrough as zt } from "stream";
import me from "readline";
var require2 = __tinyexec_cr(import.meta.url);
var St = Object.create;
var $ = Object.defineProperty;
var kt = Object.getOwnPropertyDescriptor;
var Tt = Object.getOwnPropertyNames;
var At = Object.getPrototypeOf;
var Rt = Object.prototype.hasOwnProperty;
var h = /* @__PURE__ */ ((t) => typeof require2 < "u" ? require2 : typeof Proxy < "u" ? new Proxy(t, {
  get: /* @__PURE__ */ __name((e, n) => (typeof require2 < "u" ? require2 : e)[n], "get")
}) : t)(function(t) {
  if (typeof require2 < "u") return require2.apply(this, arguments);
  throw Error('Dynamic require of "' + t + '" is not supported');
});
var l = /* @__PURE__ */ __name((t, e) => () => (e || t((e = { exports: {} }).exports, e), e.exports), "l");
var $t = /* @__PURE__ */ __name((t, e, n, r) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let s of Tt(e))
      !Rt.call(t, s) && s !== n && $(t, s, { get: /* @__PURE__ */ __name(() => e[s], "get"), enumerable: !(r = kt(e, s)) || r.enumerable });
  return t;
}, "$t");
var Nt = /* @__PURE__ */ __name((t, e, n) => (n = t != null ? St(At(t)) : {}, $t(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  e || !t || !t.__esModule ? $(n, "default", { value: t, enumerable: true }) : n,
  t
)), "Nt");
var W = l((Se, H) => {
  "use strict";
  H.exports = z;
  z.sync = Wt;
  var j = h("fs");
  function Ht(t, e) {
    var n = e.pathExt !== void 0 ? e.pathExt : process.env.PATHEXT;
    if (!n || (n = n.split(";"), n.indexOf("") !== -1))
      return true;
    for (var r = 0; r < n.length; r++) {
      var s = n[r].toLowerCase();
      if (s && t.substr(-s.length).toLowerCase() === s)
        return true;
    }
    return false;
  }
  __name(Ht, "Ht");
  function F(t, e, n) {
    return !t.isSymbolicLink() && !t.isFile() ? false : Ht(e, n);
  }
  __name(F, "F");
  function z(t, e, n) {
    j.stat(t, function(r, s) {
      n(r, r ? false : F(s, t, e));
    });
  }
  __name(z, "z");
  function Wt(t, e) {
    return F(j.statSync(t), t, e);
  }
  __name(Wt, "Wt");
});
var X = l((ke, B) => {
  "use strict";
  B.exports = K;
  K.sync = Dt;
  var D = h("fs");
  function K(t, e, n) {
    D.stat(t, function(r, s) {
      n(r, r ? false : M(s, e));
    });
  }
  __name(K, "K");
  function Dt(t, e) {
    return M(D.statSync(t), e);
  }
  __name(Dt, "Dt");
  function M(t, e) {
    return t.isFile() && Kt(t, e);
  }
  __name(M, "M");
  function Kt(t, e) {
    var n = t.mode, r = t.uid, s = t.gid, o = e.uid !== void 0 ? e.uid : process.getuid && process.getuid(), i = e.gid !== void 0 ? e.gid : process.getgid && process.getgid(), a = parseInt("100", 8), c = parseInt("010", 8), u = parseInt("001", 8), f = a | c, p = n & u || n & c && s === i || n & a && r === o || n & f && o === 0;
    return p;
  }
  __name(Kt, "Kt");
});
var U = l((Ae, G) => {
  "use strict";
  var Te = h("fs"), v;
  process.platform === "win32" || global.TESTING_WINDOWS ? v = W() : v = X();
  G.exports = y;
  y.sync = Mt;
  function y(t, e, n) {
    if (typeof e == "function" && (n = e, e = {}), !n) {
      if (typeof Promise != "function")
        throw new TypeError("callback not provided");
      return new Promise(function(r, s) {
        y(t, e || {}, function(o, i) {
          o ? s(o) : r(i);
        });
      });
    }
    v(t, e || {}, function(r, s) {
      r && (r.code === "EACCES" || e && e.ignoreErrors) && (r = null, s = false), n(r, s);
    });
  }
  __name(y, "y");
  function Mt(t, e) {
    try {
      return v.sync(t, e || {});
    } catch (n) {
      if (e && e.ignoreErrors || n.code === "EACCES")
        return false;
      throw n;
    }
  }
  __name(Mt, "Mt");
});
var et = l((Re, tt) => {
  "use strict";
  var g = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys", Y = h("path"), Bt = g ? ";" : ":", V = U(), J = /* @__PURE__ */ __name((t) => Object.assign(new Error(`not found: ${t}`), { code: "ENOENT" }), "J"), Q = /* @__PURE__ */ __name((t, e) => {
    let n = e.colon || Bt, r = t.match(/\//) || g && t.match(/\\/) ? [""] : [
      // windows always checks the cwd first
      ...g ? [process.cwd()] : [],
      ...(e.path || process.env.PATH || /* istanbul ignore next: very unusual */
      "").split(n)
    ], s = g ? e.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "", o = g ? s.split(n) : [""];
    return g && t.indexOf(".") !== -1 && o[0] !== "" && o.unshift(""), {
      pathEnv: r,
      pathExt: o,
      pathExtExe: s
    };
  }, "Q"), Z = /* @__PURE__ */ __name((t, e, n) => {
    typeof e == "function" && (n = e, e = {}), e || (e = {});
    let { pathEnv: r, pathExt: s, pathExtExe: o } = Q(t, e), i = [], a = /* @__PURE__ */ __name((u) => new Promise((f, p) => {
      if (u === r.length)
        return e.all && i.length ? f(i) : p(J(t));
      let d = r[u], w = /^".*"$/.test(d) ? d.slice(1, -1) : d, m = Y.join(w, t), b = !w && /^\.[\\\/]/.test(t) ? t.slice(0, 2) + m : m;
      f(c(b, u, 0));
    }), "a"), c = /* @__PURE__ */ __name((u, f, p) => new Promise((d, w) => {
      if (p === s.length)
        return d(a(f + 1));
      let m = s[p];
      V(u + m, { pathExt: o }, (b, Ot) => {
        if (!b && Ot)
          if (e.all)
            i.push(u + m);
          else
            return d(u + m);
        return d(c(u, f, p + 1));
      });
    }), "c");
    return n ? a(0).then((u) => n(null, u), n) : a(0);
  }, "Z"), Xt = /* @__PURE__ */ __name((t, e) => {
    e = e || {};
    let { pathEnv: n, pathExt: r, pathExtExe: s } = Q(t, e), o = [];
    for (let i = 0; i < n.length; i++) {
      let a = n[i], c = /^".*"$/.test(a) ? a.slice(1, -1) : a, u = Y.join(c, t), f = !c && /^\.[\\\/]/.test(t) ? t.slice(0, 2) + u : u;
      for (let p = 0; p < r.length; p++) {
        let d = f + r[p];
        try {
          if (V.sync(d, { pathExt: s }))
            if (e.all)
              o.push(d);
            else
              return d;
        } catch {
        }
      }
    }
    if (e.all && o.length)
      return o;
    if (e.nothrow)
      return null;
    throw J(t);
  }, "Xt");
  tt.exports = Z;
  Z.sync = Xt;
});
var rt = l(($e, _) => {
  "use strict";
  var nt = /* @__PURE__ */ __name((t = {}) => {
    let e = t.env || process.env;
    return (t.platform || process.platform) !== "win32" ? "PATH" : Object.keys(e).reverse().find((r) => r.toUpperCase() === "PATH") || "Path";
  }, "nt");
  _.exports = nt;
  _.exports.default = nt;
});
var ct = l((Ne, it) => {
  "use strict";
  var st = h("path"), Gt = et(), Ut = rt();
  function ot(t, e) {
    let n = t.options.env || process.env, r = process.cwd(), s = t.options.cwd != null, o = s && process.chdir !== void 0 && !process.chdir.disabled;
    if (o)
      try {
        process.chdir(t.options.cwd);
      } catch {
      }
    let i;
    try {
      i = Gt.sync(t.command, {
        path: n[Ut({ env: n })],
        pathExt: e ? st.delimiter : void 0
      });
    } catch {
    } finally {
      o && process.chdir(r);
    }
    return i && (i = st.resolve(s ? t.options.cwd : "", i)), i;
  }
  __name(ot, "ot");
  function Yt(t) {
    return ot(t) || ot(t, true);
  }
  __name(Yt, "Yt");
  it.exports = Yt;
});
var ut = l((qe, P) => {
  "use strict";
  var C = /([()\][%!^"`<>&|;, *?])/g;
  function Vt(t) {
    return t = t.replace(C, "^$1"), t;
  }
  __name(Vt, "Vt");
  function Jt(t, e) {
    return t = `${t}`, t = t.replace(/(\\*)"/g, '$1$1\\"'), t = t.replace(/(\\*)$/, "$1$1"), t = `"${t}"`, t = t.replace(C, "^$1"), e && (t = t.replace(C, "^$1")), t;
  }
  __name(Jt, "Jt");
  P.exports.command = Vt;
  P.exports.argument = Jt;
});
var lt = l((Ie, at) => {
  "use strict";
  at.exports = /^#!(.*)/;
});
var dt = l((Le, pt) => {
  "use strict";
  var Qt = lt();
  pt.exports = (t = "") => {
    let e = t.match(Qt);
    if (!e)
      return null;
    let [n, r] = e[0].replace(/#! ?/, "").split(" "), s = n.split("/").pop();
    return s === "env" ? r : r ? `${s} ${r}` : s;
  };
});
var ht = l((je, ft) => {
  "use strict";
  var O = h("fs"), Zt = dt();
  function te(t) {
    let n = Buffer.alloc(150), r;
    try {
      r = O.openSync(t, "r"), O.readSync(r, n, 0, 150, 0), O.closeSync(r);
    } catch {
    }
    return Zt(n.toString());
  }
  __name(te, "te");
  ft.exports = te;
});
var wt = l((Fe, Et) => {
  "use strict";
  var ee = h("path"), mt = ct(), gt = ut(), ne = ht(), re = process.platform === "win32", se = /\.(?:com|exe)$/i, oe = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
  function ie(t) {
    t.file = mt(t);
    let e = t.file && ne(t.file);
    return e ? (t.args.unshift(t.file), t.command = e, mt(t)) : t.file;
  }
  __name(ie, "ie");
  function ce(t) {
    if (!re)
      return t;
    let e = ie(t), n = !se.test(e);
    if (t.options.forceShell || n) {
      let r = oe.test(e);
      t.command = ee.normalize(t.command), t.command = gt.command(t.command), t.args = t.args.map((o) => gt.argument(o, r));
      let s = [t.command].concat(t.args).join(" ");
      t.args = ["/d", "/s", "/c", `"${s}"`], t.command = process.env.comspec || "cmd.exe", t.options.windowsVerbatimArguments = true;
    }
    return t;
  }
  __name(ce, "ce");
  function ue(t, e, n) {
    e && !Array.isArray(e) && (n = e, e = null), e = e ? e.slice(0) : [], n = Object.assign({}, n);
    let r = {
      command: t,
      args: e,
      options: n,
      file: void 0,
      original: {
        command: t,
        args: e
      }
    };
    return n.shell ? r : ce(r);
  }
  __name(ue, "ue");
  Et.exports = ue;
});
var bt = l((ze, vt) => {
  "use strict";
  var S = process.platform === "win32";
  function k(t, e) {
    return Object.assign(new Error(`${e} ${t.command} ENOENT`), {
      code: "ENOENT",
      errno: "ENOENT",
      syscall: `${e} ${t.command}`,
      path: t.command,
      spawnargs: t.args
    });
  }
  __name(k, "k");
  function ae(t, e) {
    if (!S)
      return;
    let n = t.emit;
    t.emit = function(r, s) {
      if (r === "exit") {
        let o = xt(s, e, "spawn");
        if (o)
          return n.call(t, "error", o);
      }
      return n.apply(t, arguments);
    };
  }
  __name(ae, "ae");
  function xt(t, e) {
    return S && t === 1 && !e.file ? k(e.original, "spawn") : null;
  }
  __name(xt, "xt");
  function le(t, e) {
    return S && t === 1 && !e.file ? k(e.original, "spawnSync") : null;
  }
  __name(le, "le");
  vt.exports = {
    hookChildProcess: ae,
    verifyENOENT: xt,
    verifyENOENTSync: le,
    notFoundError: k
  };
});
var Ct = l((He, E) => {
  "use strict";
  var yt = h("child_process"), T = wt(), A = bt();
  function _t(t, e, n) {
    let r = T(t, e, n), s = yt.spawn(r.command, r.args, r.options);
    return A.hookChildProcess(s, r), s;
  }
  __name(_t, "_t");
  function pe(t, e, n) {
    let r = T(t, e, n), s = yt.spawnSync(r.command, r.args, r.options);
    return s.error = s.error || A.verifyENOENTSync(s.status, r), s;
  }
  __name(pe, "pe");
  E.exports = _t;
  E.exports.spawn = _t;
  E.exports.sync = pe;
  E.exports._parse = T;
  E.exports._enoent = A;
});
var Lt = /^path$/i;
var q = { key: "PATH", value: "" };
function jt(t) {
  for (let e in t) {
    if (!Object.prototype.hasOwnProperty.call(t, e) || !Lt.test(e))
      continue;
    let n = t[e];
    return n ? { key: e, value: n } : q;
  }
  return q;
}
__name(jt, "jt");
function Ft(t, e) {
  let n = e.value.split(N), r = t, s;
  do
    n.push(qt(r, "node_modules", ".bin")), s = r, r = It(r);
  while (r !== s);
  return { key: e.key, value: n.join(N) };
}
__name(Ft, "Ft");
function I(t, e) {
  let n = {
    ...process.env,
    ...e
  }, r = Ft(t, jt(n));
  return n[r.key] = r.value, n;
}
__name(I, "I");
var L = /* @__PURE__ */ __name((t) => {
  let e = t.length, n = new zt(), r = /* @__PURE__ */ __name(() => {
    --e === 0 && n.emit("end");
  }, "r");
  for (let s of t)
    s.pipe(n, { end: false }), s.on("end", r);
  return n;
}, "L");
var Pt = Nt(Ct(), 1);
var x = class extends Error {
  static {
    __name(this, "x");
  }
  result;
  output;
  get exitCode() {
    if (this.result.exitCode !== null)
      return this.result.exitCode;
  }
  constructor(e, n) {
    super(`Process exited with non-zero status (${e.exitCode})`), this.result = e, this.output = n;
  }
};
var ge = {
  timeout: void 0,
  persist: false
};
var Ee = {
  windowsHide: true
};
function we(t, e) {
  return {
    command: fe(t),
    args: e ?? []
  };
}
__name(we, "we");
function xe(t) {
  let e = new AbortController();
  for (let n of t) {
    if (n.aborted)
      return e.abort(), n;
    let r = /* @__PURE__ */ __name(() => {
      e.abort(n.reason);
    }, "r");
    n.addEventListener("abort", r, {
      signal: e.signal
    });
  }
  return e.signal;
}
__name(xe, "xe");
var R = class {
  static {
    __name(this, "R");
  }
  _process;
  _aborted = false;
  _options;
  _command;
  _args;
  _resolveClose;
  _processClosed;
  _thrownError;
  get process() {
    return this._process;
  }
  get pid() {
    return this._process?.pid;
  }
  get exitCode() {
    if (this._process && this._process.exitCode !== null)
      return this._process.exitCode;
  }
  constructor(e, n, r) {
    this._options = {
      ...ge,
      ...r
    }, this._command = e, this._args = n ?? [], this._processClosed = new Promise((s) => {
      this._resolveClose = s;
    });
  }
  kill(e) {
    return this._process?.kill(e) === true;
  }
  get aborted() {
    return this._aborted;
  }
  get killed() {
    return this._process?.killed === true;
  }
  pipe(e, n, r) {
    return be(e, n, {
      ...r,
      stdin: this
    });
  }
  async *[Symbol.asyncIterator]() {
    let e = this._process;
    if (!e)
      return;
    let n = [];
    this._streamErr && n.push(this._streamErr), this._streamOut && n.push(this._streamOut);
    let r = L(n), s = me.createInterface({
      input: r
    });
    for await (let o of s)
      yield o.toString();
    if (await this._processClosed, e.removeAllListeners(), this._thrownError)
      throw this._thrownError;
    if (this._options?.throwOnError && this.exitCode !== 0 && this.exitCode !== void 0)
      throw new x(this);
  }
  async _waitForOutput() {
    let e = this._process;
    if (!e)
      throw new Error("No process was started");
    let n = "", r = "";
    if (this._streamOut)
      for await (let o of this._streamOut)
        r += o.toString();
    if (this._streamErr)
      for await (let o of this._streamErr)
        n += o.toString();
    if (await this._processClosed, this._options?.stdin && await this._options.stdin, e.removeAllListeners(), this._thrownError)
      throw this._thrownError;
    let s = {
      stderr: n,
      stdout: r,
      exitCode: this.exitCode
    };
    if (this._options.throwOnError && this.exitCode !== 0 && this.exitCode !== void 0)
      throw new x(this, s);
    return s;
  }
  then(e, n) {
    return this._waitForOutput().then(e, n);
  }
  _streamOut;
  _streamErr;
  spawn() {
    let e = he(), n = this._options, r = {
      ...Ee,
      ...n.nodeOptions
    }, s = [];
    this._resetState(), n.timeout !== void 0 && s.push(AbortSignal.timeout(n.timeout)), n.signal !== void 0 && s.push(n.signal), n.persist === true && (r.detached = true), s.length > 0 && (r.signal = xe(s)), r.env = I(e, r.env);
    let { command: o, args: i } = we(this._command, this._args), a = (0, Pt._parse)(o, i, r), c = de(
      a.command,
      a.args,
      a.options
    );
    if (c.stderr && (this._streamErr = c.stderr), c.stdout && (this._streamOut = c.stdout), this._process = c, c.once("error", this._onError), c.once("close", this._onClose), n.stdin !== void 0 && c.stdin && n.stdin.process) {
      let { stdout: u } = n.stdin.process;
      u && u.pipe(c.stdin);
    }
  }
  _resetState() {
    this._aborted = false, this._processClosed = new Promise((e) => {
      this._resolveClose = e;
    }), this._thrownError = void 0;
  }
  _onError = /* @__PURE__ */ __name((e) => {
    if (e.name === "AbortError" && (!(e.cause instanceof Error) || e.cause.name !== "TimeoutError")) {
      this._aborted = true;
      return;
    }
    this._thrownError = e;
  }, "_onError");
  _onClose = /* @__PURE__ */ __name(() => {
    this._resolveClose && this._resolveClose();
  }, "_onClose");
};
var ve = /* @__PURE__ */ __name((t, e, n) => {
  let r = new R(t, e, n);
  return r.spawn(), r;
}, "ve");
var be = ve;

// node_modules/@trigger.dev/python/dist/esm/utils/tempFiles.js
init_esm();
import { mkdtempSync, writeFileSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
async function withTempFile(filename, callback, content = "") {
  const tempDir = await mkdtemp(join(tmpdir(), "app-"));
  const tempFile = join(tempDir, filename);
  try {
    await writeFile(tempFile, content, { mode: 384 });
    return await callback(tempFile);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
__name(withTempFile, "withTempFile");
function createTempFileSync(filename, content = "") {
  const tempDir = mkdtempSync(join(tmpdir(), "app-"));
  const tempFile = join(tempDir, filename);
  writeFileSync(tempFile, content, { mode: 384 });
  return tempFile;
}
__name(createTempFileSync, "createTempFileSync");

// node_modules/@trigger.dev/python/dist/esm/index.js
var python = {
  async run(scriptArgs = [], options = {}) {
    const pythonBin = process.env.PYTHON_BIN_PATH || "python";
    const carrier = carrierFromContext();
    return await logger.trace("python.run()", async (span) => {
      const result = await ve(pythonBin, scriptArgs, {
        ...options,
        nodeOptions: {
          ...options.nodeOptions || {},
          env: {
            ...process.env,
            ...options.env,
            TRACEPARENT: carrier["traceparent"],
            OTEL_RESOURCE_ATTRIBUTES: `${SemanticInternalAttributes.EXECUTION_ENVIRONMENT}=trigger,${Object.entries(taskContext.attributes).map(([key, value]) => `${key}=${value}`).join(",")}`
          }
        },
        throwOnError: false
        // Ensure errors are handled manually
      });
      if (result.exitCode) {
        span.setAttribute("exitCode", result.exitCode);
      }
      if (result.exitCode !== 0) {
        throw new Error(`${scriptArgs.join(" ")} exited with a non-zero code ${result.exitCode}:
${result.stderr}`);
      }
      return result;
    }, {
      attributes: {
        pythonBin,
        args: scriptArgs.join(" "),
        [SemanticInternalAttributes.STYLE_ICON]: "python"
      }
    });
  },
  async runScript(scriptPath, scriptArgs = [], options = {}) {
    assert(scriptPath, "Script path is required");
    assert(fs.existsSync(scriptPath), `Script does not exist: ${scriptPath}`);
    return await logger.trace("python.runScript()", async (span) => {
      span.setAttribute("scriptPath", scriptPath);
      const carrier = carrierFromContext();
      const result = await ve(process.env.PYTHON_BIN_PATH || "python", [scriptPath, ...scriptArgs], {
        ...options,
        nodeOptions: {
          ...options.nodeOptions || {},
          env: {
            ...process.env,
            ...options.env,
            TRACEPARENT: carrier["traceparent"],
            OTEL_RESOURCE_ATTRIBUTES: `${SemanticInternalAttributes.EXECUTION_ENVIRONMENT}=trigger,${Object.entries(taskContext.attributes).map(([key, value]) => `${key}=${value}`).join(",")}`,
            OTEL_LOG_LEVEL: "DEBUG"
          }
        },
        throwOnError: false
      });
      if (result.exitCode) {
        span.setAttribute("exitCode", result.exitCode);
      }
      if (result.exitCode !== 0) {
        throw new Error(`${scriptPath} ${scriptArgs.join(" ")} exited with a non-zero code ${result.exitCode}:
${result.stdout}
${result.stderr}`);
      }
      return result;
    }, {
      attributes: {
        pythonBin: process.env.PYTHON_BIN_PATH || "python",
        scriptPath,
        args: scriptArgs.join(" "),
        [SemanticInternalAttributes.STYLE_ICON]: "python"
      }
    });
  },
  async runInline(scriptContent, options = {}) {
    assert(scriptContent, "Script content is required");
    return await logger.trace("python.runInline()", async (span) => {
      span.setAttribute("contentLength", scriptContent.length);
      return await withTempFile(`script_${Date.now()}.py`, async (tempFilePath) => {
        span.setAttribute("tempFilePath", tempFilePath);
        const carrier = carrierFromContext();
        const pythonBin = process.env.PYTHON_BIN_PATH || "python";
        const result = await ve(pythonBin, [tempFilePath], {
          ...options,
          nodeOptions: {
            ...options.nodeOptions || {},
            env: {
              ...process.env,
              ...options.env,
              TRACEPARENT: carrier["traceparent"],
              OTEL_RESOURCE_ATTRIBUTES: `${SemanticInternalAttributes.EXECUTION_ENVIRONMENT}=trigger,${Object.entries(taskContext.attributes).map(([key, value]) => `${key}=${value}`).join(",")}`
            }
          },
          throwOnError: false
        });
        if (result.exitCode) {
          span.setAttribute("exitCode", result.exitCode);
        }
        if (result.exitCode !== 0) {
          throw new Error(`Inline script exited with a non-zero code ${result.exitCode}:
${result.stderr}`);
        }
        return result;
      }, scriptContent);
    }, {
      attributes: {
        pythonBin: process.env.PYTHON_BIN_PATH || "python",
        contentPreview: scriptContent.substring(0, 100) + (scriptContent.length > 100 ? "..." : ""),
        [SemanticInternalAttributes.STYLE_ICON]: "python"
      }
    });
  },
  // Stream namespace for streaming functions
  stream: {
    run(scriptArgs = [], options = {}) {
      const pythonBin = process.env.PYTHON_BIN_PATH || "python";
      const carrier = carrierFromContext();
      const pythonProcess = ve(pythonBin, scriptArgs, {
        ...options,
        nodeOptions: {
          ...options.nodeOptions || {},
          env: {
            ...process.env,
            ...options.env,
            TRACEPARENT: carrier["traceparent"],
            OTEL_RESOURCE_ATTRIBUTES: `${SemanticInternalAttributes.EXECUTION_ENVIRONMENT}=trigger,${Object.entries(taskContext.attributes).map(([key, value]) => `${key}=${value}`).join(",")}`
          }
        },
        throwOnError: false
      });
      const span = logger.startSpan("python.stream.run()", {
        attributes: {
          pythonBin,
          args: scriptArgs.join(" "),
          [SemanticInternalAttributes.STYLE_ICON]: "python"
        }
      });
      return createAsyncIterableStreamFromAsyncIterable(pythonProcess, {
        transform: /* @__PURE__ */ __name((chunk, controller) => {
          controller.enqueue(chunk);
        }, "transform"),
        flush: /* @__PURE__ */ __name(() => {
          span.end();
        }, "flush")
      });
    },
    runScript(scriptPath, scriptArgs = [], options = {}) {
      assert(scriptPath, "Script path is required");
      assert(fs.existsSync(scriptPath), `Script does not exist: ${scriptPath}`);
      const pythonBin = process.env.PYTHON_BIN_PATH || "python";
      const carrier = carrierFromContext();
      const pythonProcess = ve(pythonBin, [scriptPath, ...scriptArgs], {
        ...options,
        nodeOptions: {
          ...options.nodeOptions || {},
          env: {
            ...process.env,
            ...options.env,
            TRACEPARENT: carrier["traceparent"],
            OTEL_RESOURCE_ATTRIBUTES: `${SemanticInternalAttributes.EXECUTION_ENVIRONMENT}=trigger,${Object.entries(taskContext.attributes).map(([key, value]) => `${key}=${value}`).join(",")}`
          }
        },
        throwOnError: false
      });
      const span = logger.startSpan("python.stream.runScript()", {
        attributes: {
          pythonBin,
          scriptPath,
          args: scriptArgs.join(" "),
          [SemanticInternalAttributes.STYLE_ICON]: "python"
        }
      });
      return createAsyncIterableStreamFromAsyncIterable(pythonProcess, {
        transform: /* @__PURE__ */ __name((chunk, controller) => {
          controller.enqueue(chunk);
        }, "transform"),
        flush: /* @__PURE__ */ __name(() => {
          span.end();
        }, "flush")
      });
    },
    runInline(scriptContent, options = {}) {
      assert(scriptContent, "Script content is required");
      const pythonBin = process.env.PYTHON_BIN_PATH || "python";
      const pythonScriptPath = createTempFileSync(`script_${Date.now()}.py`, scriptContent);
      const carrier = carrierFromContext();
      const pythonProcess = ve(pythonBin, [pythonScriptPath], {
        ...options,
        nodeOptions: {
          ...options.nodeOptions || {},
          env: {
            ...process.env,
            ...options.env,
            TRACEPARENT: carrier["traceparent"],
            OTEL_RESOURCE_ATTRIBUTES: `${SemanticInternalAttributes.EXECUTION_ENVIRONMENT}=trigger,${Object.entries(taskContext.attributes).map(([key, value]) => `${key}=${value}`).join(",")}`
          }
        },
        throwOnError: false
      });
      const span = logger.startSpan("python.stream.runInline()", {
        attributes: {
          pythonBin,
          contentPreview: scriptContent.substring(0, 100) + (scriptContent.length > 100 ? "..." : ""),
          [SemanticInternalAttributes.STYLE_ICON]: "python"
        }
      });
      return createAsyncIterableStreamFromAsyncIterable(pythonProcess, {
        transform: /* @__PURE__ */ __name((chunk, controller) => {
          controller.enqueue(chunk);
        }, "transform"),
        flush: /* @__PURE__ */ __name(() => {
          span.end();
        }, "flush")
      });
    }
  }
};

// utils/pdf-parser.ts
async function parsePDFWithPyMuPDF(pdfPath) {
  const pythonScript = `
import sys
import json
import warnings

# Suppress warnings to prevent stdout pollution
warnings.filterwarnings("ignore")

# Ensure UTF-8 encoding for stdout
sys.stdout.reconfigure(encoding="utf-8")

import pymupdf4llm
import io

# Get PDF path (embedded in script for compatibility)
pdf_path = ${JSON.stringify(pdfPath)}

# CRITICAL: Capture stdout during pymupdf4llm call to prevent it from printing markdown
# pymupdf4llm.to_markdown() may print to stdout, so we redirect it
old_stdout = sys.stdout
sys.stdout = io.StringIO()

try:
    # Parse PDF to markdown with per-page output
    result = pymupdf4llm.to_markdown(pdf_path, page_chunks=True, write_images=False)
finally:
    # Restore stdout and discard any output from pymupdf4llm
    captured_output = sys.stdout.getvalue()
    sys.stdout = old_stdout

pages_data = []

def safe_decode_text(text):
    """Safely decode text, handling bytes and encoding issues"""
    if isinstance(text, bytes):
        try:
            return text.decode("utf-8", errors="ignore")
        except:
            return text.decode("latin-1", errors="ignore")
    return str(text) if text is not None else ""

def split_markdown_pages(markdown_text):
    """Split multi-page markdown string into individual pages"""
    # Common page separators used by pymupdf4llm
    separators = ["\\n\\n---\\n\\n", "\\n---\\n", "\\n\\n# Page", "\\n\\n## Page"]
    for sep in separators:
        if sep in markdown_text:
            chunks = markdown_text.split(sep)
            return [chunk.strip() for chunk in chunks if chunk.strip()]
    return [markdown_text]

# Case 1: result is a dict with "pages" key
if isinstance(result, dict) and "pages" in result:
    for page in result["pages"]:
        text = safe_decode_text(page.get("text", ""))
        metadata = page.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}
        
        pages_data.append({
            "pageNumber": page.get("page_number", 0),
            "text": text,
            "charCount": len(text),
            "hasImages": metadata.get("has_images", False),
            "hasTables": metadata.get("has_tables", False)
        })

# Case 2: result is a list (each item is a page chunk)
elif isinstance(result, list):
    for i, page in enumerate(result):
        if isinstance(page, dict):
            text = safe_decode_text(page.get("text", ""))
        else:
            text = safe_decode_text(str(page))
        
        pages_data.append({
            "pageNumber": i + 1,
            "text": text,
            "charCount": len(text),
            "hasImages": False,
            "hasTables": False
        })

# Case 3: result is a string (single markdown document)
elif isinstance(result, str):
    text = safe_decode_text(result)
    # Try to split into pages if it contains page separators
    page_chunks = split_markdown_pages(text)
    
    for i, chunk in enumerate(page_chunks):
        pages_data.append({
            "pageNumber": i + 1,
            "text": chunk,
            "charCount": len(chunk),
            "hasImages": False,
            "hasTables": False
        })

# Case 4: unexpected type → safe fallback
else:
    text = safe_decode_text(str(result))
    pages_data.append({
        "pageNumber": 1,
        "text": text,
        "charCount": len(text),
        "hasImages": False,
        "hasTables": False
    })

# Suppress ALL output except our JSON
# Redirect stderr to prevent any warnings from polluting stdout
import os
with open(os.devnull, 'w') as devnull:
    sys.stderr = devnull
    
    # Ensure stdout is clean before writing
    sys.stdout.flush()
    
    # Output ONLY JSON - nothing else
    json_output = json.dumps(pages_data, ensure_ascii=False)
    sys.stdout.write(json_output)
    sys.stdout.flush()
`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 3e4);
    try {
      let extractJSON2 = function(s) {
        const trimmed = s.trim();
        let end = trimmed.length - 1;
        while (end >= 0 && trimmed[end] !== "}" && trimmed[end] !== "]") {
          end--;
        }
        if (end < 0) {
          throw new Error("No JSON ending bracket found in stdout.");
        }
        const stack = [];
        const closing = trimmed[end];
        const opening = closing === "]" ? "[" : "{";
        stack.push(closing);
        let start = end - 1;
        while (start >= 0 && stack.length > 0) {
          const ch = trimmed[start];
          if (ch === closing) {
            stack.push(ch);
          } else if (ch === opening) {
            stack.pop();
          }
          start--;
        }
        if (stack.length !== 0) {
          throw new Error("Could not find matching JSON bracket pair.");
        }
        return trimmed.slice(start + 1, end + 1);
      };
      var extractJSON = extractJSON2;
      __name(extractJSON2, "extractJSON");
      const result = await Promise.race([
        python.runInline(pythonScript),
        new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Timeout")), 3e4)
        )
      ]);
      clearTimeout(timeout);
      if (result.stderr?.trim()) {
        console.warn(`[pymupdf4llm] Python stderr: ${result.stderr.substring(0, 500)}`);
      }
      const stdout = (result.stdout ?? "").trim();
      if (!stdout) {
        throw new Error("Python script returned empty stdout");
      }
      let pages;
      try {
        const jsonText = extractJSON2(stdout);
        pages = JSON.parse(jsonText);
      } catch (parseError) {
        throw new Error(
          `Failed to extract/parse JSON from stdout. Stdout length: ${stdout.length}, Last 500 chars: ${stdout.slice(-500)}. Parse error: ${parseError.message}`
        );
      }
      if (!Array.isArray(pages)) {
        throw new Error(`Expected array of pages, got ${typeof pages}`);
      }
      const totalChars = pages.reduce((sum, p) => sum + (p.charCount || 0), 0);
      if (totalChars > 1e6) {
        throw new Error(
          `PDF too large: ${totalChars} characters across ${pages.length} pages. Limit: 1,000,000 characters.`
        );
      }
      for (const page of pages) {
        if (!page.pageNumber || !page.text) {
          console.warn(`[pymupdf4llm] Invalid page structure:`, page);
        }
      }
      console.log(
        `[pymupdf4llm] ✅ Parsed ${pages.length} pages, ${totalChars} total characters`
      );
      return pages;
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === "AbortError" || error.message === "Timeout") {
        throw new Error("PDF parsing timed out after 30 seconds");
      }
      throw error;
    }
  } catch (error) {
    throw new Error(`❌ pymupdf4llm parsing failed: ${error.message}`);
  }
}
__name(parsePDFWithPyMuPDF, "parsePDFWithPyMuPDF");

// tasks/ingest-document.ts
var ingestDocument = task({
  id: "ingest-document",
  queue: {
    concurrencyLimit: 2
    // PDF parsing is CPU-heavy
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1e4,
    // 10 seconds
    maxTimeoutInMs: 3e5,
    // 5 minutes
    randomize: true
  },
  run: /* @__PURE__ */ __name(async (payload) => {
    const { documentId, pdfUrl, courseId, topicId, userId } = payload;
    console.log(`[ingest-document] ▶️  Starting job for document ${documentId}`);
    const startTime = Date.now();
    const supabase = (0, import_supabase_js.createClient)(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    let tempPdfPath = null;
    try {
      const { error: healthError } = await supabase.from("documents").select("id").limit(1);
      if (healthError) {
        throw new Error(`❌ Health check failed: ${healthError.message}`);
      }
      console.log(`[ingest-document] ✅ Health check passed`);
      await supabase.from("documents").update({
        status: "processing",
        processing_step: "downloading"
      }).eq("id", documentId);
      console.log(`[ingest-document] ⬇️  Downloading PDF...`);
      const downloadStart = Date.now();
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`❌ PDF download failed: ${pdfResponse.statusText}`);
      }
      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      tempPdfPath = path.join(os.tmpdir(), `${documentId}.pdf`);
      await fs2.writeFile(tempPdfPath, pdfBuffer);
      const downloadTime = Date.now() - downloadStart;
      console.log(`[ingest-document] ✅ Downloaded ${pdfBuffer.length} bytes in ${downloadTime}ms`);
      await supabase.from("documents").update({ processing_step: "parsing" }).eq("id", documentId);
      console.log(`[ingest-document] 📄 Parsing PDF with pymupdf4llm...`);
      const parseStart = Date.now();
      const pages = await parsePDFWithPyMuPDF(tempPdfPath);
      const parseTime = Date.now() - parseStart;
      console.log(`[ingest-document] ✅ Parsed ${pages.length} pages in ${parseTime}ms`);
      await supabase.from("documents").update({
        total_pages: pages.length,
        processing_step: "storing_pages"
      }).eq("id", documentId);
      console.log(`[ingest-document] 💾 Storing ${pages.length} pages in database...`);
      const storeStart = Date.now();
      const { data: existingPages, error: checkError } = await supabase.from("document_pages").select("id, page_number").eq("document_id", documentId);
      let pageIds = [];
      if (existingPages && existingPages.length > 0) {
        console.log(`[ingest-document] ⚠️  Pages already exist (${existingPages.length} pages), skipping insertion`);
        pageIds = existingPages.map((p) => p.id);
      } else {
        const pageInserts = pages.map((page) => ({
          document_id: documentId,
          page_number: page.pageNumber,
          text_content: page.text,
          token_count: Math.ceil(page.charCount / 4),
          // Rough token estimate
          has_diagrams: page.hasImages,
          has_tables: page.hasTables,
          importance_score: 0.5
          // Default importance
        }));
        const { data: insertedPages, error: insertError } = await supabase.from("document_pages").insert(pageInserts).select("id");
        if (insertError) {
          throw new Error(`❌ Failed to insert pages: ${insertError.message}`);
        }
        pageIds = insertedPages?.map((p) => p.id) || [];
      }
      const storeTime = Date.now() - storeStart;
      console.log(`[ingest-document] ✅ Stored ${pageIds.length} pages in ${storeTime}ms`);
      if (tempPdfPath) {
        await fs2.unlink(tempPdfPath).catch(() => {
        });
      }
      await supabase.from("documents").update({
        processing_step: "parsed"
        // Status stays 'processing' - will be updated to 'ready' by finalize-document
      }).eq("id", documentId);
      console.log(`[ingest-document] 🚀 Triggering generate-embeddings task...`);
      const task2Result = await generateEmbeddings.triggerAndWait({
        documentId,
        pageIds,
        userId
      });
      if (!task2Result.ok) {
        throw new Error(`❌ Task 2 (generate-embeddings) failed: ${task2Result.error}`);
      }
      console.log(`[ingest-document] 🚀 Triggering finalize-document task...`);
      const task3Result = await finalizeDocument.triggerAndWait({
        documentId,
        pageCount: pages.length,
        embeddingCount: task2Result.output.embeddingCount,
        chunkCount: task2Result.output.chunkCount,
        userId
      });
      if (!task3Result.ok) {
        throw new Error(`❌ Task 3 (finalize-document) failed: ${task3Result.error}`);
      }
      const totalTime = Date.now() - startTime;
      console.log(`[ingest-document] 🎉 Document ${documentId} processed successfully in ${totalTime}ms`);
      return {
        success: true,
        documentId,
        pageIds,
        pageCount: pages.length,
        stats: {
          downloadTimeMs: downloadTime,
          parseTimeMs: parseTime,
          storeTimeMs: storeTime
        }
      };
    } catch (error) {
      console.error(`[ingest-document] ❌ Error processing document ${documentId}:`, error);
      if (tempPdfPath) {
        await fs2.unlink(tempPdfPath).catch(() => {
        });
      }
      try {
        await supabase.from("documents").update({
          status: "error",
          // Valid status per database constraint
          error_message: error.message
        }).eq("id", documentId);
      } catch (updateError) {
        console.error("[ingest-document] Failed to update error status:", updateError);
      }
      throw error;
    }
  }, "run")
});

export {
  ingestDocument
};
//# sourceMappingURL=chunk-EKWUJYCI.mjs.map
