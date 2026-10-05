"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/utils/dns-equal.js
var require_dns_equal = __commonJS({
  "node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/utils/dns-equal.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = dnsEqual;
    var capitalLetterRegex = /[A-Z]/g;
    function toLowerCase(input) {
      return input.toLowerCase();
    }
    function dnsEqual(a, b) {
      const aFormatted = a.replace(capitalLetterRegex, toLowerCase);
      const bFormatted = b.replace(capitalLetterRegex, toLowerCase);
      return aFormatted === bFormatted;
    }
  }
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/dns-txt.js
var require_dns_txt = __commonJS({
  "node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/dns-txt.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DnsTxt = void 0;
    var DnsTxt = class {
      constructor(opts = {}) {
        this.binary = opts ? opts.binary : false;
      }
      encode(data = {}) {
        return Object.entries(data).map(([key2, value]) => {
          let item = `${key2}=${value}`;
          return Buffer.from(item);
        });
      }
      decode(buffer) {
        var data = {};
        try {
          let format = buffer.toString();
          let parts = format.split(/=(.+)/);
          let key2 = parts[0];
          let value = parts[1];
          data[key2] = value;
        } catch (_) {
        }
        return data;
      }
      decodeAll(buffer) {
        return buffer.filter((i) => i.length > 1).map((i) => this.decode(i)).reduce((prev, curr) => {
          var obj = prev;
          let [key2] = Object.keys(curr);
          let [value] = Object.values(curr);
          obj[key2] = value;
          return obj;
        }, {});
      }
    };
    exports2.DnsTxt = DnsTxt;
    exports2.default = DnsTxt;
  }
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/service-types.js
var require_service_types = __commonJS({
  "node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/service-types.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.toType = exports2.toString = void 0;
    var Prefix = (name) => {
      return "_" + name;
    };
    var AllowedProp = (key2) => {
      let keys = ["name", "protocol", "subtype"];
      return keys.includes(key2);
    };
    var toString = (data) => {
      let formatted = {
        name: data.name,
        protocol: data.protocol,
        subtype: data.subtype
      };
      let entries = Object.entries(formatted);
      return entries.filter(([key2, val]) => AllowedProp(key2) && val !== void 0).reduce((prev, [key2, val]) => {
        switch (typeof val) {
          case "object":
            val.map((i) => prev.push(Prefix(i)));
            break;
          default:
            prev.push(Prefix(val));
            break;
        }
        return prev;
      }, []).join(".");
    };
    exports2.toString = toString;
    var toType = (string) => {
      let parts = string.split(".");
      let subtype;
      for (let i in parts) {
        if (parts[i][0] !== "_")
          continue;
        parts[i] = parts[i].slice(1);
      }
      if (parts.includes("sub")) {
        subtype = parts.shift();
        parts.shift();
      }
      return {
        name: parts.shift(),
        protocol: parts.shift() || null,
        subtype
      };
    };
    exports2.toType = toType;
  }
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/service.js
var require_service = __commonJS({
  "node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/service.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Service = void 0;
    var os_1 = __importDefault(require("os"));
    var dns_txt_1 = __importDefault(require_dns_txt());
    var events_1 = require("events");
    var service_types_1 = require_service_types();
    var TLD = ".local";
    var Service = class extends events_1.EventEmitter {
      constructor(config, start, stop) {
        super();
        this.start = start;
        this.stop = stop;
        this.probe = true;
        this.published = false;
        this.activated = false;
        this.destroyed = false;
        this.txtService = new dns_txt_1.default();
        if (!config.name)
          throw new Error("ServiceConfig requires `name` property to be set");
        if (!config.type)
          throw new Error("ServiceConfig requires `type` property to be set");
        if (!config.port)
          throw new Error("ServiceConfig requires `port` property to be set");
        this.name = config.name.split(".").join("-");
        this.protocol = config.protocol || "tcp";
        this.type = (0, service_types_1.toString)({ name: config.type, protocol: this.protocol });
        this.port = config.port;
        this.host = config.host || os_1.default.hostname();
        this.fqdn = `${this.name}.${this.type}${TLD}`;
        this.txt = config.txt;
        this.subtypes = config.subtypes;
        this.disableIPv6 = !!config.disableIPv6;
      }
      records() {
        var records = [
          this.RecordPTR(this),
          this.RecordSRV(this),
          this.RecordTXT(this),
          this.RecordServicePTR(this)
        ];
        for (let subtype of this.subtypes || []) {
          records.push(this.RecordSubtypePTR(this, subtype));
        }
        let ifaces = Object.values(os_1.default.networkInterfaces());
        for (let iface of ifaces) {
          let addrs = iface;
          for (let addr of addrs) {
            if (addr.internal || addr.mac === "00:00:00:00:00:00")
              continue;
            switch (addr.family) {
              case "IPv4":
                records.push(this.RecordA(this, addr.address));
                break;
              case "IPv6":
                if (this.disableIPv6)
                  break;
                records.push(this.RecordAAAA(this, addr.address));
                break;
            }
          }
        }
        return records;
      }
      RecordPTR(service) {
        return {
          name: `${service.type}${TLD}`,
          type: "PTR",
          ttl: 28800,
          data: service.fqdn
        };
      }
      RecordServicePTR(service) {
        return {
          name: `_services._dns-sd._udp${TLD}`,
          type: "PTR",
          ttl: 120,
          data: `${service.type}${TLD}`
        };
      }
      RecordSubtypePTR(service, subtype) {
        return {
          name: `_${subtype}._sub.${service.type}${TLD}`,
          type: "PTR",
          ttl: 28800,
          data: `${service.name}.${service.type}${TLD}`
        };
      }
      RecordSRV(service) {
        return {
          name: service.fqdn,
          type: "SRV",
          ttl: 120,
          data: {
            port: service.port,
            target: service.host
          }
        };
      }
      RecordTXT(service) {
        return {
          name: service.fqdn,
          type: "TXT",
          ttl: 4500,
          data: this.txtService.encode(service.txt)
        };
      }
      RecordA(service, ip) {
        return {
          name: service.host,
          type: "A",
          ttl: 120,
          data: ip
        };
      }
      RecordAAAA(service, ip) {
        return {
          name: service.host,
          type: "AAAA",
          ttl: 120,
          data: ip
        };
      }
    };
    exports2.Service = Service;
    exports2.default = Service;
  }
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/registry.js
var require_registry = __commonJS({
  "node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/registry.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Registry = void 0;
    var dns_equal_1 = __importDefault(require_dns_equal());
    var service_1 = __importDefault(require_service());
    var REANNOUNCE_MAX_MS = 60 * 60 * 1e3;
    var REANNOUNCE_FACTOR = 3;
    var noop = function() {
    };
    var Registry = class {
      constructor(server) {
        this.services = [];
        this.server = server;
      }
      publish(config) {
        const configProbe = config.probe !== false;
        const service = new service_1.default(config, start.bind(null, this), stop.bind(null, this));
        function start(registry, { probe = configProbe } = {}) {
          if (service.activated)
            return;
          service.activated = true;
          registry.services.push(service);
          if (!(service instanceof service_1.default))
            return;
          if (probe) {
            registry.probe(registry.server.mdns, service, (exists) => {
              if (exists) {
                if (service.stop !== void 0)
                  service.stop();
                console.log(new Error("Service name is already in use on the network"));
                return;
              }
              registry.announce(registry.server, service);
            });
          } else {
            registry.announce(registry.server, service);
          }
        }
        function stop(registry, callback) {
          if (!callback)
            callback = noop;
          if (!service.activated)
            return process.nextTick(callback);
          if (!(service instanceof service_1.default))
            return process.nextTick(callback);
          registry.teardown(registry.server, service, callback);
          const index = registry.services.indexOf(service);
          if (index !== -1)
            registry.services.splice(index, 1);
        }
        service.start();
        return service;
      }
      unpublishAll(callback) {
        this.teardown(this.server, this.services, callback);
        this.services = [];
      }
      destroy() {
        this.services.map((service) => service.destroyed = true);
      }
      probe(mdns, service, callback) {
        var sent = false;
        var retries = 0;
        var timer;
        const send = () => {
          if (!service.activated || service.destroyed)
            return;
          mdns.query(service.fqdn, "ANY", function() {
            sent = true;
            timer = setTimeout(++retries < 3 ? send : done, 250);
            timer.unref();
          });
        };
        const onresponse = (packet) => {
          if (!sent)
            return;
          if (packet.answers.some(matchRR) || packet.additionals.some(matchRR))
            done(true);
        };
        const matchRR = (rr) => {
          return (0, dns_equal_1.default)(rr.name, service.fqdn);
        };
        const done = (exists) => {
          mdns.removeListener("response", onresponse);
          clearTimeout(timer);
          callback(!!exists);
        };
        mdns.on("response", onresponse);
        setTimeout(send, Math.random() * 250);
      }
      announce(server, service) {
        var delay = 1e3;
        var packet = service.records();
        server.register(packet);
        const broadcast = () => {
          if (!service.activated || service.destroyed)
            return;
          server.mdns.respond(packet, function() {
            if (!service.published) {
              service.activated = true;
              service.published = true;
              service.emit("up");
            }
            delay = delay * REANNOUNCE_FACTOR;
            if (delay < REANNOUNCE_MAX_MS && !service.destroyed) {
              setTimeout(broadcast, delay).unref();
            }
          });
        };
        broadcast();
      }
      teardown(server, services, callback) {
        if (!Array.isArray(services))
          services = [services];
        services = services.filter((service) => service.activated);
        var records = services.flatMap(function(service) {
          service.activated = false;
          var records2 = service.records();
          records2.forEach((record) => {
            record.ttl = 0;
          });
          return records2;
        });
        if (records.length === 0)
          return callback && process.nextTick(callback);
        server.unregister(records);
        server.mdns.respond(records, function() {
          services.forEach(function(service) {
            service.published = false;
          });
          if (typeof callback === "function") {
            callback.apply(null, arguments);
          }
        });
      }
    };
    exports2.Registry = Registry;
    exports2.default = Registry;
  }
});

// node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/types.js
var require_types = __commonJS({
  "node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/types.js"(exports2) {
    "use strict";
    exports2.toString = function(type) {
      switch (type) {
        case 1:
          return "A";
        case 10:
          return "NULL";
        case 28:
          return "AAAA";
        case 18:
          return "AFSDB";
        case 42:
          return "APL";
        case 257:
          return "CAA";
        case 60:
          return "CDNSKEY";
        case 59:
          return "CDS";
        case 37:
          return "CERT";
        case 5:
          return "CNAME";
        case 49:
          return "DHCID";
        case 32769:
          return "DLV";
        case 39:
          return "DNAME";
        case 48:
          return "DNSKEY";
        case 43:
          return "DS";
        case 55:
          return "HIP";
        case 13:
          return "HINFO";
        case 45:
          return "IPSECKEY";
        case 25:
          return "KEY";
        case 36:
          return "KX";
        case 29:
          return "LOC";
        case 15:
          return "MX";
        case 35:
          return "NAPTR";
        case 2:
          return "NS";
        case 47:
          return "NSEC";
        case 50:
          return "NSEC3";
        case 51:
          return "NSEC3PARAM";
        case 12:
          return "PTR";
        case 46:
          return "RRSIG";
        case 17:
          return "RP";
        case 24:
          return "SIG";
        case 6:
          return "SOA";
        case 99:
          return "SPF";
        case 33:
          return "SRV";
        case 44:
          return "SSHFP";
        case 32768:
          return "TA";
        case 249:
          return "TKEY";
        case 52:
          return "TLSA";
        case 250:
          return "TSIG";
        case 16:
          return "TXT";
        case 252:
          return "AXFR";
        case 251:
          return "IXFR";
        case 41:
          return "OPT";
        case 255:
          return "ANY";
      }
      return "UNKNOWN_" + type;
    };
    exports2.toType = function(name) {
      switch (name.toUpperCase()) {
        case "A":
          return 1;
        case "NULL":
          return 10;
        case "AAAA":
          return 28;
        case "AFSDB":
          return 18;
        case "APL":
          return 42;
        case "CAA":
          return 257;
        case "CDNSKEY":
          return 60;
        case "CDS":
          return 59;
        case "CERT":
          return 37;
        case "CNAME":
          return 5;
        case "DHCID":
          return 49;
        case "DLV":
          return 32769;
        case "DNAME":
          return 39;
        case "DNSKEY":
          return 48;
        case "DS":
          return 43;
        case "HIP":
          return 55;
        case "HINFO":
          return 13;
        case "IPSECKEY":
          return 45;
        case "KEY":
          return 25;
        case "KX":
          return 36;
        case "LOC":
          return 29;
        case "MX":
          return 15;
        case "NAPTR":
          return 35;
        case "NS":
          return 2;
        case "NSEC":
          return 47;
        case "NSEC3":
          return 50;
        case "NSEC3PARAM":
          return 51;
        case "PTR":
          return 12;
        case "RRSIG":
          return 46;
        case "RP":
          return 17;
        case "SIG":
          return 24;
        case "SOA":
          return 6;
        case "SPF":
          return 99;
        case "SRV":
          return 33;
        case "SSHFP":
          return 44;
        case "TA":
          return 32768;
        case "TKEY":
          return 249;
        case "TLSA":
          return 52;
        case "TSIG":
          return 250;
        case "TXT":
          return 16;
        case "AXFR":
          return 252;
        case "IXFR":
          return 251;
        case "OPT":
          return 41;
        case "ANY":
          return 255;
        case "*":
          return 255;
      }
      if (name.toUpperCase().startsWith("UNKNOWN_")) return parseInt(name.slice(8));
      return 0;
    };
  }
});

// node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/rcodes.js
var require_rcodes = __commonJS({
  "node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/rcodes.js"(exports2) {
    "use strict";
    exports2.toString = function(rcode) {
      switch (rcode) {
        case 0:
          return "NOERROR";
        case 1:
          return "FORMERR";
        case 2:
          return "SERVFAIL";
        case 3:
          return "NXDOMAIN";
        case 4:
          return "NOTIMP";
        case 5:
          return "REFUSED";
        case 6:
          return "YXDOMAIN";
        case 7:
          return "YXRRSET";
        case 8:
          return "NXRRSET";
        case 9:
          return "NOTAUTH";
        case 10:
          return "NOTZONE";
        case 11:
          return "RCODE_11";
        case 12:
          return "RCODE_12";
        case 13:
          return "RCODE_13";
        case 14:
          return "RCODE_14";
        case 15:
          return "RCODE_15";
      }
      return "RCODE_" + rcode;
    };
    exports2.toRcode = function(code) {
      switch (code.toUpperCase()) {
        case "NOERROR":
          return 0;
        case "FORMERR":
          return 1;
        case "SERVFAIL":
          return 2;
        case "NXDOMAIN":
          return 3;
        case "NOTIMP":
          return 4;
        case "REFUSED":
          return 5;
        case "YXDOMAIN":
          return 6;
        case "YXRRSET":
          return 7;
        case "NXRRSET":
          return 8;
        case "NOTAUTH":
          return 9;
        case "NOTZONE":
          return 10;
        case "RCODE_11":
          return 11;
        case "RCODE_12":
          return 12;
        case "RCODE_13":
          return 13;
        case "RCODE_14":
          return 14;
        case "RCODE_15":
          return 15;
      }
      return 0;
    };
  }
});

// node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/opcodes.js
var require_opcodes = __commonJS({
  "node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/opcodes.js"(exports2) {
    "use strict";
    exports2.toString = function(opcode) {
      switch (opcode) {
        case 0:
          return "QUERY";
        case 1:
          return "IQUERY";
        case 2:
          return "STATUS";
        case 3:
          return "OPCODE_3";
        case 4:
          return "NOTIFY";
        case 5:
          return "UPDATE";
        case 6:
          return "OPCODE_6";
        case 7:
          return "OPCODE_7";
        case 8:
          return "OPCODE_8";
        case 9:
          return "OPCODE_9";
        case 10:
          return "OPCODE_10";
        case 11:
          return "OPCODE_11";
        case 12:
          return "OPCODE_12";
        case 13:
          return "OPCODE_13";
        case 14:
          return "OPCODE_14";
        case 15:
          return "OPCODE_15";
      }
      return "OPCODE_" + opcode;
    };
    exports2.toOpcode = function(code) {
      switch (code.toUpperCase()) {
        case "QUERY":
          return 0;
        case "IQUERY":
          return 1;
        case "STATUS":
          return 2;
        case "OPCODE_3":
          return 3;
        case "NOTIFY":
          return 4;
        case "UPDATE":
          return 5;
        case "OPCODE_6":
          return 6;
        case "OPCODE_7":
          return 7;
        case "OPCODE_8":
          return 8;
        case "OPCODE_9":
          return 9;
        case "OPCODE_10":
          return 10;
        case "OPCODE_11":
          return 11;
        case "OPCODE_12":
          return 12;
        case "OPCODE_13":
          return 13;
        case "OPCODE_14":
          return 14;
        case "OPCODE_15":
          return 15;
      }
      return 0;
    };
  }
});

// node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/classes.js
var require_classes = __commonJS({
  "node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/classes.js"(exports2) {
    "use strict";
    exports2.toString = function(klass) {
      switch (klass) {
        case 1:
          return "IN";
        case 2:
          return "CS";
        case 3:
          return "CH";
        case 4:
          return "HS";
        case 255:
          return "ANY";
      }
      return "UNKNOWN_" + klass;
    };
    exports2.toClass = function(name) {
      switch (name.toUpperCase()) {
        case "IN":
          return 1;
        case "CS":
          return 2;
        case "CH":
          return 3;
        case "HS":
          return 4;
        case "ANY":
          return 255;
      }
      return 0;
    };
  }
});

// node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/optioncodes.js
var require_optioncodes = __commonJS({
  "node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/optioncodes.js"(exports2) {
    "use strict";
    exports2.toString = function(type) {
      switch (type) {
        // list at
        // https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-11
        case 1:
          return "LLQ";
        case 2:
          return "UL";
        case 3:
          return "NSID";
        case 5:
          return "DAU";
        case 6:
          return "DHU";
        case 7:
          return "N3U";
        case 8:
          return "CLIENT_SUBNET";
        case 9:
          return "EXPIRE";
        case 10:
          return "COOKIE";
        case 11:
          return "TCP_KEEPALIVE";
        case 12:
          return "PADDING";
        case 13:
          return "CHAIN";
        case 14:
          return "KEY_TAG";
        case 26946:
          return "DEVICEID";
      }
      if (type < 0) {
        return null;
      }
      return `OPTION_${type}`;
    };
    exports2.toCode = function(name) {
      if (typeof name === "number") {
        return name;
      }
      if (!name) {
        return -1;
      }
      switch (name.toUpperCase()) {
        case "OPTION_0":
          return 0;
        case "LLQ":
          return 1;
        case "UL":
          return 2;
        case "NSID":
          return 3;
        case "OPTION_4":
          return 4;
        case "DAU":
          return 5;
        case "DHU":
          return 6;
        case "N3U":
          return 7;
        case "CLIENT_SUBNET":
          return 8;
        case "EXPIRE":
          return 9;
        case "COOKIE":
          return 10;
        case "TCP_KEEPALIVE":
          return 11;
        case "PADDING":
          return 12;
        case "CHAIN":
          return 13;
        case "KEY_TAG":
          return 14;
        case "DEVICEID":
          return 26946;
        case "OPTION_65535":
          return 65535;
      }
      const m = name.match(/_(\d+)$/);
      if (m) {
        return parseInt(m[1], 10);
      }
      return -1;
    };
  }
});

// node_modules/.pnpm/@leichtgewicht+ip-codec@2.0.5/node_modules/@leichtgewicht/ip-codec/index.cjs
var require_ip_codec = __commonJS({
  "node_modules/.pnpm/@leichtgewicht+ip-codec@2.0.5/node_modules/@leichtgewicht/ip-codec/index.cjs"(exports2, module2) {
    var ipCodec = (function(exports3) {
      "use strict";
      Object.defineProperty(exports3, "__esModule", {
        value: true
      });
      exports3.decode = decode;
      exports3.encode = encode;
      exports3.familyOf = familyOf;
      exports3.name = void 0;
      exports3.sizeOf = sizeOf;
      exports3.v6 = exports3.v4 = void 0;
      const v4Regex = /^(\d{1,3}\.){3,3}\d{1,3}$/;
      const v4Size = 4;
      const v6Regex = /^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i;
      const v6Size = 16;
      const v4 = {
        name: "v4",
        size: v4Size,
        isFormat: (ip) => v4Regex.test(ip),
        encode(ip, buff, offset) {
          offset = ~~offset;
          buff = buff || new Uint8Array(offset + v4Size);
          const max = ip.length;
          let n = 0;
          for (let i = 0; i < max; ) {
            const c = ip.charCodeAt(i++);
            if (c === 46) {
              buff[offset++] = n;
              n = 0;
            } else {
              n = n * 10 + (c - 48);
            }
          }
          buff[offset] = n;
          return buff;
        },
        decode(buff, offset) {
          offset = ~~offset;
          return `${buff[offset++]}.${buff[offset++]}.${buff[offset++]}.${buff[offset]}`;
        }
      };
      exports3.v4 = v4;
      const v6 = {
        name: "v6",
        size: v6Size,
        isFormat: (ip) => ip.length > 0 && v6Regex.test(ip),
        encode(ip, buff, offset) {
          offset = ~~offset;
          let end = offset + v6Size;
          let fill = -1;
          let hexN = 0;
          let decN = 0;
          let prevColon = true;
          let useDec = false;
          buff = buff || new Uint8Array(offset + v6Size);
          for (let i = 0; i < ip.length; i++) {
            let c = ip.charCodeAt(i);
            if (c === 58) {
              if (prevColon) {
                if (fill !== -1) {
                  if (offset < end) buff[offset] = 0;
                  if (offset < end - 1) buff[offset + 1] = 0;
                  offset += 2;
                } else if (offset < end) {
                  fill = offset;
                }
              } else {
                if (useDec === true) {
                  if (offset < end) buff[offset] = decN;
                  offset++;
                } else {
                  if (offset < end) buff[offset] = hexN >> 8;
                  if (offset < end - 1) buff[offset + 1] = hexN & 255;
                  offset += 2;
                }
                hexN = 0;
                decN = 0;
              }
              prevColon = true;
              useDec = false;
            } else if (c === 46) {
              if (offset < end) buff[offset] = decN;
              offset++;
              decN = 0;
              hexN = 0;
              prevColon = false;
              useDec = true;
            } else {
              prevColon = false;
              if (c >= 97) {
                c -= 87;
              } else if (c >= 65) {
                c -= 55;
              } else {
                c -= 48;
                decN = decN * 10 + c;
              }
              hexN = (hexN << 4) + c;
            }
          }
          if (prevColon === false) {
            if (useDec === true) {
              if (offset < end) buff[offset] = decN;
              offset++;
            } else {
              if (offset < end) buff[offset] = hexN >> 8;
              if (offset < end - 1) buff[offset + 1] = hexN & 255;
              offset += 2;
            }
          } else if (fill === 0) {
            if (offset < end) buff[offset] = 0;
            if (offset < end - 1) buff[offset + 1] = 0;
            offset += 2;
          } else if (fill !== -1) {
            offset += 2;
            for (let i = Math.min(offset - 1, end - 1); i >= fill + 2; i--) {
              buff[i] = buff[i - 2];
            }
            buff[fill] = 0;
            buff[fill + 1] = 0;
            fill = offset;
          }
          if (fill !== offset && fill !== -1) {
            if (offset > end - 2) {
              offset = end - 2;
            }
            while (end > fill) {
              buff[--end] = offset < end && offset > fill ? buff[--offset] : 0;
            }
          } else {
            while (offset < end) {
              buff[offset++] = 0;
            }
          }
          return buff;
        },
        decode(buff, offset) {
          offset = ~~offset;
          let result = "";
          for (let i = 0; i < v6Size; i += 2) {
            if (i !== 0) {
              result += ":";
            }
            result += (buff[offset + i] << 8 | buff[offset + i + 1]).toString(16);
          }
          return result.replace(/(^|:)0(:0)*:0(:|$)/, "$1::$3").replace(/:{3,4}/, "::");
        }
      };
      exports3.v6 = v6;
      const name = "ip";
      exports3.name = name;
      function sizeOf(ip) {
        if (v4.isFormat(ip)) return v4.size;
        if (v6.isFormat(ip)) return v6.size;
        throw Error(`Invalid ip address: ${ip}`);
      }
      function familyOf(string) {
        return sizeOf(string) === v4.size ? 1 : 2;
      }
      function encode(ip, buff, offset) {
        offset = ~~offset;
        const size = sizeOf(ip);
        if (typeof buff === "function") {
          buff = buff(offset + size);
        }
        if (size === v4.size) {
          return v4.encode(ip, buff, offset);
        }
        return v6.encode(ip, buff, offset);
      }
      function decode(buff, offset, length) {
        offset = ~~offset;
        length = length || buff.length - offset;
        if (length === v4.size) {
          return v4.decode(buff, offset, length);
        }
        if (length === v6.size) {
          return v6.decode(buff, offset, length);
        }
        throw Error(`Invalid buffer size needs to be ${v4.size} for v4 or ${v6.size} for v6.`);
      }
      return "default" in exports3 ? exports3.default : exports3;
    })({});
    if (typeof define === "function" && define.amd) define([], function() {
      return ipCodec;
    });
    else if (typeof module2 === "object" && typeof exports2 === "object") module2.exports = ipCodec;
  }
});

// node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/index.js
var require_dns_packet = __commonJS({
  "node_modules/.pnpm/dns-packet@5.6.1/node_modules/dns-packet/index.js"(exports2) {
    "use strict";
    var Buffer2 = require("buffer").Buffer;
    var types = require_types();
    var rcodes = require_rcodes();
    var opcodes = require_opcodes();
    var classes = require_classes();
    var optioncodes = require_optioncodes();
    var ip = require_ip_codec();
    var QUERY_FLAG = 0;
    var RESPONSE_FLAG = 1 << 15;
    var FLUSH_MASK = 1 << 15;
    var NOT_FLUSH_MASK = ~FLUSH_MASK;
    var QU_MASK = 1 << 15;
    var NOT_QU_MASK = ~QU_MASK;
    var name = exports2.name = {};
    name.encode = function(str, buf, offset, { mail = false } = {}) {
      if (!buf) buf = Buffer2.alloc(name.encodingLength(str));
      if (!offset) offset = 0;
      const oldOffset = offset;
      const n = str.replace(/^\.|\.$/gm, "");
      if (n.length) {
        let list = [];
        if (mail) {
          let localPart = "";
          n.split(".").forEach((label) => {
            if (label.endsWith("\\")) {
              localPart += (localPart.length ? "." : "") + label.slice(0, -1);
            } else {
              if (list.length === 0 && localPart.length) {
                list.push(localPart + "." + label);
              } else {
                list.push(label);
              }
            }
          });
        } else {
          list = n.split(".");
        }
        for (let i = 0; i < list.length; i++) {
          const len = buf.write(list[i], offset + 1);
          buf[offset] = len;
          offset += len + 1;
        }
      }
      buf[offset++] = 0;
      name.encode.bytes = offset - oldOffset;
      return buf;
    };
    name.encode.bytes = 0;
    name.decode = function(buf, offset, { mail = false } = {}) {
      if (!offset) offset = 0;
      const list = [];
      let oldOffset = offset;
      let totalLength = 0;
      let consumedBytes = 0;
      let jumped = false;
      while (true) {
        if (offset >= buf.length) {
          throw new Error("Cannot decode name (buffer overflow)");
        }
        const len = buf[offset++];
        consumedBytes += jumped ? 0 : 1;
        if (len === 0) {
          break;
        } else if ((len & 192) === 0) {
          if (offset + len > buf.length) {
            throw new Error("Cannot decode name (buffer overflow)");
          }
          totalLength += len + 1;
          if (totalLength > 254) {
            throw new Error("Cannot decode name (name too long)");
          }
          let label = buf.toString("utf-8", offset, offset + len);
          if (mail) {
            label = label.replace(/\./g, "\\.");
          }
          list.push(label);
          offset += len;
          consumedBytes += jumped ? 0 : len;
        } else if ((len & 192) === 192) {
          if (offset + 1 > buf.length) {
            throw new Error("Cannot decode name (buffer overflow)");
          }
          const jumpOffset = buf.readUInt16BE(offset - 1) - 49152;
          if (jumpOffset >= oldOffset) {
            throw new Error("Cannot decode name (bad pointer)");
          }
          offset = jumpOffset;
          oldOffset = jumpOffset;
          consumedBytes += jumped ? 0 : 1;
          jumped = true;
        } else {
          throw new Error("Cannot decode name (bad label)");
        }
      }
      name.decode.bytes = consumedBytes;
      return list.length === 0 ? "." : list.join(".");
    };
    name.decode.bytes = 0;
    name.encodingLength = function(n) {
      if (n === "." || n === "..") return 1;
      return Buffer2.byteLength(n.replace(/^\.|\.$/gm, "")) + 2;
    };
    var string = {};
    string.encode = function(s, buf, offset) {
      if (!buf) buf = Buffer2.alloc(string.encodingLength(s));
      if (!offset) offset = 0;
      const len = buf.write(s, offset + 1);
      buf[offset] = len;
      string.encode.bytes = len + 1;
      return buf;
    };
    string.encode.bytes = 0;
    string.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const len = buf[offset];
      const s = buf.toString("utf-8", offset + 1, offset + 1 + len);
      string.decode.bytes = len + 1;
      return s;
    };
    string.decode.bytes = 0;
    string.encodingLength = function(s) {
      return Buffer2.byteLength(s) + 1;
    };
    var header = {};
    header.encode = function(h, buf, offset) {
      if (!buf) buf = header.encodingLength(h);
      if (!offset) offset = 0;
      const flags = (h.flags || 0) & 32767;
      const type = h.type === "response" ? RESPONSE_FLAG : QUERY_FLAG;
      buf.writeUInt16BE(h.id || 0, offset);
      buf.writeUInt16BE(flags | type, offset + 2);
      buf.writeUInt16BE(h.questions.length, offset + 4);
      buf.writeUInt16BE(h.answers.length, offset + 6);
      buf.writeUInt16BE(h.authorities.length, offset + 8);
      buf.writeUInt16BE(h.additionals.length, offset + 10);
      return buf;
    };
    header.encode.bytes = 12;
    header.decode = function(buf, offset) {
      if (!offset) offset = 0;
      if (buf.length < 12) throw new Error("Header must be 12 bytes");
      const flags = buf.readUInt16BE(offset + 2);
      return {
        id: buf.readUInt16BE(offset),
        type: flags & RESPONSE_FLAG ? "response" : "query",
        flags: flags & 32767,
        flag_qr: (flags >> 15 & 1) === 1,
        opcode: opcodes.toString(flags >> 11 & 15),
        flag_aa: (flags >> 10 & 1) === 1,
        flag_tc: (flags >> 9 & 1) === 1,
        flag_rd: (flags >> 8 & 1) === 1,
        flag_ra: (flags >> 7 & 1) === 1,
        flag_z: (flags >> 6 & 1) === 1,
        flag_ad: (flags >> 5 & 1) === 1,
        flag_cd: (flags >> 4 & 1) === 1,
        rcode: rcodes.toString(flags & 15),
        questions: new Array(buf.readUInt16BE(offset + 4)),
        answers: new Array(buf.readUInt16BE(offset + 6)),
        authorities: new Array(buf.readUInt16BE(offset + 8)),
        additionals: new Array(buf.readUInt16BE(offset + 10))
      };
    };
    header.decode.bytes = 12;
    header.encodingLength = function() {
      return 12;
    };
    var runknown = exports2.unknown = {};
    runknown.encode = function(data, buf, offset) {
      if (!buf) buf = Buffer2.alloc(runknown.encodingLength(data));
      if (!offset) offset = 0;
      buf.writeUInt16BE(data.length, offset);
      data.copy(buf, offset + 2);
      runknown.encode.bytes = data.length + 2;
      return buf;
    };
    runknown.encode.bytes = 0;
    runknown.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const len = buf.readUInt16BE(offset);
      const data = buf.slice(offset + 2, offset + 2 + len);
      runknown.decode.bytes = len + 2;
      return data;
    };
    runknown.decode.bytes = 0;
    runknown.encodingLength = function(data) {
      return data.length + 2;
    };
    var rns = exports2.ns = {};
    rns.encode = function(data, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rns.encodingLength(data));
      if (!offset) offset = 0;
      name.encode(data, buf, offset + 2);
      buf.writeUInt16BE(name.encode.bytes, offset);
      rns.encode.bytes = name.encode.bytes + 2;
      return buf;
    };
    rns.encode.bytes = 0;
    rns.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const len = buf.readUInt16BE(offset);
      const dd = name.decode(buf, offset + 2);
      rns.decode.bytes = len + 2;
      return dd;
    };
    rns.decode.bytes = 0;
    rns.encodingLength = function(data) {
      return name.encodingLength(data) + 2;
    };
    var rsoa = exports2.soa = {};
    rsoa.encode = function(data, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rsoa.encodingLength(data));
      if (!offset) offset = 0;
      const oldOffset = offset;
      offset += 2;
      name.encode(data.mname, buf, offset);
      offset += name.encode.bytes;
      name.encode(data.rname, buf, offset, { mail: true });
      offset += name.encode.bytes;
      buf.writeUInt32BE(data.serial || 0, offset);
      offset += 4;
      buf.writeUInt32BE(data.refresh || 0, offset);
      offset += 4;
      buf.writeUInt32BE(data.retry || 0, offset);
      offset += 4;
      buf.writeUInt32BE(data.expire || 0, offset);
      offset += 4;
      buf.writeUInt32BE(data.minimum || 0, offset);
      offset += 4;
      buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
      rsoa.encode.bytes = offset - oldOffset;
      return buf;
    };
    rsoa.encode.bytes = 0;
    rsoa.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      const data = {};
      offset += 2;
      data.mname = name.decode(buf, offset);
      offset += name.decode.bytes;
      data.rname = name.decode(buf, offset, { mail: true });
      offset += name.decode.bytes;
      data.serial = buf.readUInt32BE(offset);
      offset += 4;
      data.refresh = buf.readUInt32BE(offset);
      offset += 4;
      data.retry = buf.readUInt32BE(offset);
      offset += 4;
      data.expire = buf.readUInt32BE(offset);
      offset += 4;
      data.minimum = buf.readUInt32BE(offset);
      offset += 4;
      rsoa.decode.bytes = offset - oldOffset;
      return data;
    };
    rsoa.decode.bytes = 0;
    rsoa.encodingLength = function(data) {
      return 22 + name.encodingLength(data.mname) + name.encodingLength(data.rname);
    };
    var rtxt = exports2.txt = {};
    rtxt.encode = function(data, buf, offset) {
      if (!Array.isArray(data)) data = [data];
      for (let i = 0; i < data.length; i++) {
        if (typeof data[i] === "string") {
          data[i] = Buffer2.from(data[i]);
        }
        if (!Buffer2.isBuffer(data[i])) {
          throw new Error("Must be a Buffer");
        }
      }
      if (!buf) buf = Buffer2.alloc(rtxt.encodingLength(data));
      if (!offset) offset = 0;
      const oldOffset = offset;
      offset += 2;
      data.forEach(function(d) {
        buf[offset++] = d.length;
        d.copy(buf, offset, 0, d.length);
        offset += d.length;
      });
      buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
      rtxt.encode.bytes = offset - oldOffset;
      return buf;
    };
    rtxt.encode.bytes = 0;
    rtxt.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      let remaining = buf.readUInt16BE(offset);
      offset += 2;
      let data = [];
      while (remaining > 0) {
        const len = buf[offset++];
        --remaining;
        if (remaining < len) {
          throw new Error("Buffer overflow");
        }
        data.push(buf.slice(offset, offset + len));
        offset += len;
        remaining -= len;
      }
      rtxt.decode.bytes = offset - oldOffset;
      return data;
    };
    rtxt.decode.bytes = 0;
    rtxt.encodingLength = function(data) {
      if (!Array.isArray(data)) data = [data];
      let length = 2;
      data.forEach(function(buf) {
        if (typeof buf === "string") {
          length += Buffer2.byteLength(buf) + 1;
        } else {
          length += buf.length + 1;
        }
      });
      return length;
    };
    var rnull = exports2.null = {};
    rnull.encode = function(data, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rnull.encodingLength(data));
      if (!offset) offset = 0;
      if (typeof data === "string") data = Buffer2.from(data);
      if (!data) data = Buffer2.alloc(0);
      const oldOffset = offset;
      offset += 2;
      const len = data.length;
      data.copy(buf, offset, 0, len);
      offset += len;
      buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
      rnull.encode.bytes = offset - oldOffset;
      return buf;
    };
    rnull.encode.bytes = 0;
    rnull.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      const len = buf.readUInt16BE(offset);
      offset += 2;
      const data = buf.slice(offset, offset + len);
      offset += len;
      rnull.decode.bytes = offset - oldOffset;
      return data;
    };
    rnull.decode.bytes = 0;
    rnull.encodingLength = function(data) {
      if (!data) return 2;
      return (Buffer2.isBuffer(data) ? data.length : Buffer2.byteLength(data)) + 2;
    };
    var rhinfo = exports2.hinfo = {};
    rhinfo.encode = function(data, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rhinfo.encodingLength(data));
      if (!offset) offset = 0;
      const oldOffset = offset;
      offset += 2;
      string.encode(data.cpu, buf, offset);
      offset += string.encode.bytes;
      string.encode(data.os, buf, offset);
      offset += string.encode.bytes;
      buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
      rhinfo.encode.bytes = offset - oldOffset;
      return buf;
    };
    rhinfo.encode.bytes = 0;
    rhinfo.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      const data = {};
      offset += 2;
      data.cpu = string.decode(buf, offset);
      offset += string.decode.bytes;
      data.os = string.decode(buf, offset);
      offset += string.decode.bytes;
      rhinfo.decode.bytes = offset - oldOffset;
      return data;
    };
    rhinfo.decode.bytes = 0;
    rhinfo.encodingLength = function(data) {
      return string.encodingLength(data.cpu) + string.encodingLength(data.os) + 2;
    };
    var rptr = exports2.ptr = {};
    var rcname = exports2.cname = rptr;
    var rdname = exports2.dname = rptr;
    rptr.encode = function(data, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rptr.encodingLength(data));
      if (!offset) offset = 0;
      name.encode(data, buf, offset + 2);
      buf.writeUInt16BE(name.encode.bytes, offset);
      rptr.encode.bytes = name.encode.bytes + 2;
      return buf;
    };
    rptr.encode.bytes = 0;
    rptr.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const data = name.decode(buf, offset + 2);
      rptr.decode.bytes = name.decode.bytes + 2;
      return data;
    };
    rptr.decode.bytes = 0;
    rptr.encodingLength = function(data) {
      return name.encodingLength(data) + 2;
    };
    var rsrv = exports2.srv = {};
    rsrv.encode = function(data, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rsrv.encodingLength(data));
      if (!offset) offset = 0;
      buf.writeUInt16BE(data.priority || 0, offset + 2);
      buf.writeUInt16BE(data.weight || 0, offset + 4);
      buf.writeUInt16BE(data.port || 0, offset + 6);
      name.encode(data.target, buf, offset + 8);
      const len = name.encode.bytes + 6;
      buf.writeUInt16BE(len, offset);
      rsrv.encode.bytes = len + 2;
      return buf;
    };
    rsrv.encode.bytes = 0;
    rsrv.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const len = buf.readUInt16BE(offset);
      const data = {};
      data.priority = buf.readUInt16BE(offset + 2);
      data.weight = buf.readUInt16BE(offset + 4);
      data.port = buf.readUInt16BE(offset + 6);
      data.target = name.decode(buf, offset + 8);
      rsrv.decode.bytes = len + 2;
      return data;
    };
    rsrv.decode.bytes = 0;
    rsrv.encodingLength = function(data) {
      return 8 + name.encodingLength(data.target);
    };
    var rcaa = exports2.caa = {};
    rcaa.ISSUER_CRITICAL = 1 << 7;
    rcaa.encode = function(data, buf, offset) {
      const len = rcaa.encodingLength(data);
      if (!buf) buf = Buffer2.alloc(rcaa.encodingLength(data));
      if (!offset) offset = 0;
      if (data.issuerCritical) {
        data.flags = rcaa.ISSUER_CRITICAL;
      }
      buf.writeUInt16BE(len - 2, offset);
      offset += 2;
      buf.writeUInt8(data.flags || 0, offset);
      offset += 1;
      string.encode(data.tag, buf, offset);
      offset += string.encode.bytes;
      buf.write(data.value, offset);
      offset += Buffer2.byteLength(data.value);
      rcaa.encode.bytes = len;
      return buf;
    };
    rcaa.encode.bytes = 0;
    rcaa.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const len = buf.readUInt16BE(offset);
      offset += 2;
      const oldOffset = offset;
      const data = {};
      data.flags = buf.readUInt8(offset);
      offset += 1;
      data.tag = string.decode(buf, offset);
      offset += string.decode.bytes;
      data.value = buf.toString("utf-8", offset, oldOffset + len);
      data.issuerCritical = !!(data.flags & rcaa.ISSUER_CRITICAL);
      rcaa.decode.bytes = len + 2;
      return data;
    };
    rcaa.decode.bytes = 0;
    rcaa.encodingLength = function(data) {
      return string.encodingLength(data.tag) + string.encodingLength(data.value) + 2;
    };
    var rmx = exports2.mx = {};
    rmx.encode = function(data, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rmx.encodingLength(data));
      if (!offset) offset = 0;
      const oldOffset = offset;
      offset += 2;
      buf.writeUInt16BE(data.preference || 0, offset);
      offset += 2;
      name.encode(data.exchange, buf, offset);
      offset += name.encode.bytes;
      buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
      rmx.encode.bytes = offset - oldOffset;
      return buf;
    };
    rmx.encode.bytes = 0;
    rmx.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      const data = {};
      offset += 2;
      data.preference = buf.readUInt16BE(offset);
      offset += 2;
      data.exchange = name.decode(buf, offset);
      offset += name.decode.bytes;
      rmx.decode.bytes = offset - oldOffset;
      return data;
    };
    rmx.encodingLength = function(data) {
      return 4 + name.encodingLength(data.exchange);
    };
    var ra = exports2.a = {};
    ra.encode = function(host, buf, offset) {
      if (!buf) buf = Buffer2.alloc(ra.encodingLength(host));
      if (!offset) offset = 0;
      buf.writeUInt16BE(4, offset);
      offset += 2;
      ip.v4.encode(host, buf, offset);
      ra.encode.bytes = 6;
      return buf;
    };
    ra.encode.bytes = 0;
    ra.decode = function(buf, offset) {
      if (!offset) offset = 0;
      offset += 2;
      const host = ip.v4.decode(buf, offset);
      ra.decode.bytes = 6;
      return host;
    };
    ra.decode.bytes = 0;
    ra.encodingLength = function() {
      return 6;
    };
    var raaaa = exports2.aaaa = {};
    raaaa.encode = function(host, buf, offset) {
      if (!buf) buf = Buffer2.alloc(raaaa.encodingLength(host));
      if (!offset) offset = 0;
      buf.writeUInt16BE(16, offset);
      offset += 2;
      ip.v6.encode(host, buf, offset);
      raaaa.encode.bytes = 18;
      return buf;
    };
    raaaa.encode.bytes = 0;
    raaaa.decode = function(buf, offset) {
      if (!offset) offset = 0;
      offset += 2;
      const host = ip.v6.decode(buf, offset);
      raaaa.decode.bytes = 18;
      return host;
    };
    raaaa.decode.bytes = 0;
    raaaa.encodingLength = function() {
      return 18;
    };
    var roption = exports2.option = {};
    roption.encode = function(option, buf, offset) {
      if (!buf) buf = Buffer2.alloc(roption.encodingLength(option));
      if (!offset) offset = 0;
      const oldOffset = offset;
      const code = optioncodes.toCode(option.code);
      buf.writeUInt16BE(code, offset);
      offset += 2;
      if (option.data) {
        buf.writeUInt16BE(option.data.length, offset);
        offset += 2;
        option.data.copy(buf, offset);
        offset += option.data.length;
      } else {
        switch (code) {
          // case 3: NSID.  No encode makes sense.
          // case 5,6,7: Not implementable
          case 8:
            const spl = option.sourcePrefixLength || 0;
            const fam = option.family || ip.familyOf(option.ip);
            const ipBuf = ip.encode(option.ip, Buffer2.alloc);
            const ipLen = Math.ceil(spl / 8);
            buf.writeUInt16BE(ipLen + 4, offset);
            offset += 2;
            buf.writeUInt16BE(fam, offset);
            offset += 2;
            buf.writeUInt8(spl, offset++);
            buf.writeUInt8(option.scopePrefixLength || 0, offset++);
            ipBuf.copy(buf, offset, 0, ipLen);
            offset += ipLen;
            break;
          // case 9: EXPIRE (experimental)
          // case 10: COOKIE.  No encode makes sense.
          case 11:
            if (option.timeout) {
              buf.writeUInt16BE(2, offset);
              offset += 2;
              buf.writeUInt16BE(option.timeout, offset);
              offset += 2;
            } else {
              buf.writeUInt16BE(0, offset);
              offset += 2;
            }
            break;
          case 12:
            const len = option.length || 0;
            buf.writeUInt16BE(len, offset);
            offset += 2;
            buf.fill(0, offset, offset + len);
            offset += len;
            break;
          // case 13:  CHAIN.  Experimental.
          case 14:
            const tagsLen = option.tags.length * 2;
            buf.writeUInt16BE(tagsLen, offset);
            offset += 2;
            for (const tag of option.tags) {
              buf.writeUInt16BE(tag, offset);
              offset += 2;
            }
            break;
          default:
            throw new Error(`Unknown roption code: ${option.code}`);
        }
      }
      roption.encode.bytes = offset - oldOffset;
      return buf;
    };
    roption.encode.bytes = 0;
    roption.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const option = {};
      option.code = buf.readUInt16BE(offset);
      option.type = optioncodes.toString(option.code);
      offset += 2;
      const len = buf.readUInt16BE(offset);
      offset += 2;
      option.data = buf.slice(offset, offset + len);
      switch (option.code) {
        // case 3: NSID.  No decode makes sense.
        case 8:
          option.family = buf.readUInt16BE(offset);
          offset += 2;
          option.sourcePrefixLength = buf.readUInt8(offset++);
          option.scopePrefixLength = buf.readUInt8(offset++);
          const padded = Buffer2.alloc(option.family === 1 ? 4 : 16);
          buf.copy(padded, 0, offset, offset + len - 4);
          option.ip = ip.decode(padded);
          break;
        // case 12: Padding.  No decode makes sense.
        case 11:
          if (len > 0) {
            option.timeout = buf.readUInt16BE(offset);
            offset += 2;
          }
          break;
        case 14:
          option.tags = [];
          for (let i = 0; i < len; i += 2) {
            option.tags.push(buf.readUInt16BE(offset));
            offset += 2;
          }
      }
      roption.decode.bytes = len + 4;
      return option;
    };
    roption.decode.bytes = 0;
    roption.encodingLength = function(option) {
      if (option.data) {
        return option.data.length + 4;
      }
      const code = optioncodes.toCode(option.code);
      switch (code) {
        case 8:
          const spl = option.sourcePrefixLength || 0;
          return Math.ceil(spl / 8) + 8;
        case 11:
          return typeof option.timeout === "number" ? 6 : 4;
        case 12:
          return option.length + 4;
        case 14:
          return 4 + option.tags.length * 2;
      }
      throw new Error(`Unknown roption code: ${option.code}`);
    };
    var ropt = exports2.opt = {};
    ropt.encode = function(options, buf, offset) {
      if (!buf) buf = Buffer2.alloc(ropt.encodingLength(options));
      if (!offset) offset = 0;
      const oldOffset = offset;
      const rdlen = encodingLengthList(options, roption);
      buf.writeUInt16BE(rdlen, offset);
      offset = encodeList(options, roption, buf, offset + 2);
      ropt.encode.bytes = offset - oldOffset;
      return buf;
    };
    ropt.encode.bytes = 0;
    ropt.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      const options = [];
      let rdlen = buf.readUInt16BE(offset);
      offset += 2;
      let o = 0;
      while (rdlen > 0) {
        options[o++] = roption.decode(buf, offset);
        offset += roption.decode.bytes;
        rdlen -= roption.decode.bytes;
      }
      ropt.decode.bytes = offset - oldOffset;
      return options;
    };
    ropt.decode.bytes = 0;
    ropt.encodingLength = function(options) {
      return 2 + encodingLengthList(options || [], roption);
    };
    var rdnskey = exports2.dnskey = {};
    rdnskey.PROTOCOL_DNSSEC = 3;
    rdnskey.ZONE_KEY = 128;
    rdnskey.SECURE_ENTRYPOINT = 32768;
    rdnskey.encode = function(key2, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rdnskey.encodingLength(key2));
      if (!offset) offset = 0;
      const oldOffset = offset;
      const keydata = key2.key;
      if (!Buffer2.isBuffer(keydata)) {
        throw new Error("Key must be a Buffer");
      }
      offset += 2;
      buf.writeUInt16BE(key2.flags, offset);
      offset += 2;
      buf.writeUInt8(rdnskey.PROTOCOL_DNSSEC, offset);
      offset += 1;
      buf.writeUInt8(key2.algorithm, offset);
      offset += 1;
      keydata.copy(buf, offset, 0, keydata.length);
      offset += keydata.length;
      rdnskey.encode.bytes = offset - oldOffset;
      buf.writeUInt16BE(rdnskey.encode.bytes - 2, oldOffset);
      return buf;
    };
    rdnskey.encode.bytes = 0;
    rdnskey.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      var key2 = {};
      var length = buf.readUInt16BE(offset);
      offset += 2;
      key2.flags = buf.readUInt16BE(offset);
      offset += 2;
      if (buf.readUInt8(offset) !== rdnskey.PROTOCOL_DNSSEC) {
        throw new Error("Protocol must be 3");
      }
      offset += 1;
      key2.algorithm = buf.readUInt8(offset);
      offset += 1;
      key2.key = buf.slice(offset, oldOffset + length + 2);
      offset += key2.key.length;
      rdnskey.decode.bytes = offset - oldOffset;
      return key2;
    };
    rdnskey.decode.bytes = 0;
    rdnskey.encodingLength = function(key2) {
      return 6 + Buffer2.byteLength(key2.key);
    };
    var rrrsig = exports2.rrsig = {};
    rrrsig.encode = function(sig, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rrrsig.encodingLength(sig));
      if (!offset) offset = 0;
      const oldOffset = offset;
      const signature = sig.signature;
      if (!Buffer2.isBuffer(signature)) {
        throw new Error("Signature must be a Buffer");
      }
      offset += 2;
      buf.writeUInt16BE(types.toType(sig.typeCovered), offset);
      offset += 2;
      buf.writeUInt8(sig.algorithm, offset);
      offset += 1;
      buf.writeUInt8(sig.labels, offset);
      offset += 1;
      buf.writeUInt32BE(sig.originalTTL, offset);
      offset += 4;
      buf.writeUInt32BE(sig.expiration, offset);
      offset += 4;
      buf.writeUInt32BE(sig.inception, offset);
      offset += 4;
      buf.writeUInt16BE(sig.keyTag, offset);
      offset += 2;
      name.encode(sig.signersName, buf, offset);
      offset += name.encode.bytes;
      signature.copy(buf, offset, 0, signature.length);
      offset += signature.length;
      rrrsig.encode.bytes = offset - oldOffset;
      buf.writeUInt16BE(rrrsig.encode.bytes - 2, oldOffset);
      return buf;
    };
    rrrsig.encode.bytes = 0;
    rrrsig.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      var sig = {};
      var length = buf.readUInt16BE(offset);
      offset += 2;
      sig.typeCovered = types.toString(buf.readUInt16BE(offset));
      offset += 2;
      sig.algorithm = buf.readUInt8(offset);
      offset += 1;
      sig.labels = buf.readUInt8(offset);
      offset += 1;
      sig.originalTTL = buf.readUInt32BE(offset);
      offset += 4;
      sig.expiration = buf.readUInt32BE(offset);
      offset += 4;
      sig.inception = buf.readUInt32BE(offset);
      offset += 4;
      sig.keyTag = buf.readUInt16BE(offset);
      offset += 2;
      sig.signersName = name.decode(buf, offset);
      offset += name.decode.bytes;
      sig.signature = buf.slice(offset, oldOffset + length + 2);
      offset += sig.signature.length;
      rrrsig.decode.bytes = offset - oldOffset;
      return sig;
    };
    rrrsig.decode.bytes = 0;
    rrrsig.encodingLength = function(sig) {
      return 20 + name.encodingLength(sig.signersName) + Buffer2.byteLength(sig.signature);
    };
    var rrp = exports2.rp = {};
    rrp.encode = function(data, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rrp.encodingLength(data));
      if (!offset) offset = 0;
      const oldOffset = offset;
      offset += 2;
      name.encode(data.mbox || ".", buf, offset, { mail: true });
      offset += name.encode.bytes;
      name.encode(data.txt || ".", buf, offset);
      offset += name.encode.bytes;
      rrp.encode.bytes = offset - oldOffset;
      buf.writeUInt16BE(rrp.encode.bytes - 2, oldOffset);
      return buf;
    };
    rrp.encode.bytes = 0;
    rrp.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      const data = {};
      offset += 2;
      data.mbox = name.decode(buf, offset, { mail: true }) || ".";
      offset += name.decode.bytes;
      data.txt = name.decode(buf, offset) || ".";
      offset += name.decode.bytes;
      rrp.decode.bytes = offset - oldOffset;
      return data;
    };
    rrp.decode.bytes = 0;
    rrp.encodingLength = function(data) {
      return 2 + name.encodingLength(data.mbox || ".") + name.encodingLength(data.txt || ".");
    };
    var typebitmap = {};
    typebitmap.encode = function(typelist, buf, offset) {
      if (!buf) buf = Buffer2.alloc(typebitmap.encodingLength(typelist));
      if (!offset) offset = 0;
      const oldOffset = offset;
      var typesByWindow = [];
      for (var i = 0; i < typelist.length; i++) {
        var typeid = types.toType(typelist[i]);
        if (typesByWindow[typeid >> 8] === void 0) {
          typesByWindow[typeid >> 8] = [];
        }
        typesByWindow[typeid >> 8][typeid >> 3 & 31] |= 1 << 7 - (typeid & 7);
      }
      for (i = 0; i < typesByWindow.length; i++) {
        if (typesByWindow[i] !== void 0) {
          var windowBuf = Buffer2.from(typesByWindow[i]);
          buf.writeUInt8(i, offset);
          offset += 1;
          buf.writeUInt8(windowBuf.length, offset);
          offset += 1;
          windowBuf.copy(buf, offset);
          offset += windowBuf.length;
        }
      }
      typebitmap.encode.bytes = offset - oldOffset;
      return buf;
    };
    typebitmap.encode.bytes = 0;
    typebitmap.decode = function(buf, offset, length) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      var typelist = [];
      while (offset - oldOffset < length) {
        var window = buf.readUInt8(offset);
        offset += 1;
        var windowLength = buf.readUInt8(offset);
        offset += 1;
        for (var i = 0; i < windowLength; i++) {
          var b = buf.readUInt8(offset + i);
          for (var j = 0; j < 8; j++) {
            if (b & 1 << 7 - j) {
              var typeid = types.toString(window << 8 | i << 3 | j);
              typelist.push(typeid);
            }
          }
        }
        offset += windowLength;
      }
      typebitmap.decode.bytes = offset - oldOffset;
      return typelist;
    };
    typebitmap.decode.bytes = 0;
    typebitmap.encodingLength = function(typelist) {
      var extents = [];
      for (var i = 0; i < typelist.length; i++) {
        var typeid = types.toType(typelist[i]);
        extents[typeid >> 8] = Math.max(extents[typeid >> 8] || 0, typeid & 255);
      }
      var len = 0;
      for (i = 0; i < extents.length; i++) {
        if (extents[i] !== void 0) {
          len += 2 + Math.ceil((extents[i] + 1) / 8);
        }
      }
      return len;
    };
    var rnsec = exports2.nsec = {};
    rnsec.encode = function(record, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rnsec.encodingLength(record));
      if (!offset) offset = 0;
      const oldOffset = offset;
      offset += 2;
      name.encode(record.nextDomain, buf, offset);
      offset += name.encode.bytes;
      typebitmap.encode(record.rrtypes, buf, offset);
      offset += typebitmap.encode.bytes;
      rnsec.encode.bytes = offset - oldOffset;
      buf.writeUInt16BE(rnsec.encode.bytes - 2, oldOffset);
      return buf;
    };
    rnsec.encode.bytes = 0;
    rnsec.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      var record = {};
      var length = buf.readUInt16BE(offset);
      offset += 2;
      record.nextDomain = name.decode(buf, offset);
      offset += name.decode.bytes;
      record.rrtypes = typebitmap.decode(buf, offset, length - (offset - oldOffset));
      offset += typebitmap.decode.bytes;
      rnsec.decode.bytes = offset - oldOffset;
      return record;
    };
    rnsec.decode.bytes = 0;
    rnsec.encodingLength = function(record) {
      return 2 + name.encodingLength(record.nextDomain) + typebitmap.encodingLength(record.rrtypes);
    };
    var rnsec3 = exports2.nsec3 = {};
    rnsec3.encode = function(record, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rnsec3.encodingLength(record));
      if (!offset) offset = 0;
      const oldOffset = offset;
      const salt = record.salt;
      if (!Buffer2.isBuffer(salt)) {
        throw new Error("salt must be a Buffer");
      }
      const nextDomain = record.nextDomain;
      if (!Buffer2.isBuffer(nextDomain)) {
        throw new Error("nextDomain must be a Buffer");
      }
      offset += 2;
      buf.writeUInt8(record.algorithm, offset);
      offset += 1;
      buf.writeUInt8(record.flags, offset);
      offset += 1;
      buf.writeUInt16BE(record.iterations, offset);
      offset += 2;
      buf.writeUInt8(salt.length, offset);
      offset += 1;
      salt.copy(buf, offset, 0, salt.length);
      offset += salt.length;
      buf.writeUInt8(nextDomain.length, offset);
      offset += 1;
      nextDomain.copy(buf, offset, 0, nextDomain.length);
      offset += nextDomain.length;
      typebitmap.encode(record.rrtypes, buf, offset);
      offset += typebitmap.encode.bytes;
      rnsec3.encode.bytes = offset - oldOffset;
      buf.writeUInt16BE(rnsec3.encode.bytes - 2, oldOffset);
      return buf;
    };
    rnsec3.encode.bytes = 0;
    rnsec3.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      var record = {};
      var length = buf.readUInt16BE(offset);
      offset += 2;
      record.algorithm = buf.readUInt8(offset);
      offset += 1;
      record.flags = buf.readUInt8(offset);
      offset += 1;
      record.iterations = buf.readUInt16BE(offset);
      offset += 2;
      const saltLength = buf.readUInt8(offset);
      offset += 1;
      record.salt = buf.slice(offset, offset + saltLength);
      offset += saltLength;
      const hashLength = buf.readUInt8(offset);
      offset += 1;
      record.nextDomain = buf.slice(offset, offset + hashLength);
      offset += hashLength;
      record.rrtypes = typebitmap.decode(buf, offset, length - (offset - oldOffset));
      offset += typebitmap.decode.bytes;
      rnsec3.decode.bytes = offset - oldOffset;
      return record;
    };
    rnsec3.decode.bytes = 0;
    rnsec3.encodingLength = function(record) {
      return 8 + record.salt.length + record.nextDomain.length + typebitmap.encodingLength(record.rrtypes);
    };
    var rds = exports2.ds = {};
    rds.encode = function(digest, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rds.encodingLength(digest));
      if (!offset) offset = 0;
      const oldOffset = offset;
      const digestdata = digest.digest;
      if (!Buffer2.isBuffer(digestdata)) {
        throw new Error("Digest must be a Buffer");
      }
      offset += 2;
      buf.writeUInt16BE(digest.keyTag, offset);
      offset += 2;
      buf.writeUInt8(digest.algorithm, offset);
      offset += 1;
      buf.writeUInt8(digest.digestType, offset);
      offset += 1;
      digestdata.copy(buf, offset, 0, digestdata.length);
      offset += digestdata.length;
      rds.encode.bytes = offset - oldOffset;
      buf.writeUInt16BE(rds.encode.bytes - 2, oldOffset);
      return buf;
    };
    rds.encode.bytes = 0;
    rds.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      var digest = {};
      var length = buf.readUInt16BE(offset);
      offset += 2;
      digest.keyTag = buf.readUInt16BE(offset);
      offset += 2;
      digest.algorithm = buf.readUInt8(offset);
      offset += 1;
      digest.digestType = buf.readUInt8(offset);
      offset += 1;
      digest.digest = buf.slice(offset, oldOffset + length + 2);
      offset += digest.digest.length;
      rds.decode.bytes = offset - oldOffset;
      return digest;
    };
    rds.decode.bytes = 0;
    rds.encodingLength = function(digest) {
      return 6 + Buffer2.byteLength(digest.digest);
    };
    var rsshfp = exports2.sshfp = {};
    rsshfp.getFingerprintLengthForHashType = function getFingerprintLengthForHashType(hashType) {
      switch (hashType) {
        case 1:
          return 20;
        case 2:
          return 32;
      }
    };
    rsshfp.encode = function encode(record, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rsshfp.encodingLength(record));
      if (!offset) offset = 0;
      const oldOffset = offset;
      offset += 2;
      buf[offset] = record.algorithm;
      offset += 1;
      buf[offset] = record.hash;
      offset += 1;
      const fingerprintBuf = Buffer2.from(record.fingerprint.toUpperCase(), "hex");
      if (fingerprintBuf.length !== rsshfp.getFingerprintLengthForHashType(record.hash)) {
        throw new Error("Invalid fingerprint length");
      }
      fingerprintBuf.copy(buf, offset);
      offset += fingerprintBuf.byteLength;
      rsshfp.encode.bytes = offset - oldOffset;
      buf.writeUInt16BE(rsshfp.encode.bytes - 2, oldOffset);
      return buf;
    };
    rsshfp.encode.bytes = 0;
    rsshfp.decode = function decode(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      const record = {};
      offset += 2;
      record.algorithm = buf[offset];
      offset += 1;
      record.hash = buf[offset];
      offset += 1;
      const fingerprintLength = rsshfp.getFingerprintLengthForHashType(record.hash);
      record.fingerprint = buf.slice(offset, offset + fingerprintLength).toString("hex").toUpperCase();
      offset += fingerprintLength;
      rsshfp.decode.bytes = offset - oldOffset;
      return record;
    };
    rsshfp.decode.bytes = 0;
    rsshfp.encodingLength = function(record) {
      return 4 + Buffer2.from(record.fingerprint, "hex").byteLength;
    };
    var rnaptr = exports2.naptr = {};
    rnaptr.encode = function(data, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rnaptr.encodingLength(data));
      if (!offset) offset = 0;
      const oldOffset = offset;
      offset += 2;
      buf.writeUInt16BE(data.order || 0, offset);
      offset += 2;
      buf.writeUInt16BE(data.preference || 0, offset);
      offset += 2;
      string.encode(data.flags, buf, offset);
      offset += string.encode.bytes;
      string.encode(data.services, buf, offset);
      offset += string.encode.bytes;
      string.encode(data.regexp, buf, offset);
      offset += string.encode.bytes;
      name.encode(data.replacement, buf, offset);
      offset += name.encode.bytes;
      rnaptr.encode.bytes = offset - oldOffset;
      buf.writeUInt16BE(rnaptr.encode.bytes - 2, oldOffset);
      return buf;
    };
    rnaptr.encode.bytes = 0;
    rnaptr.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      const data = {};
      offset += 2;
      data.order = buf.readUInt16BE(offset);
      offset += 2;
      data.preference = buf.readUInt16BE(offset);
      offset += 2;
      data.flags = string.decode(buf, offset);
      offset += string.decode.bytes;
      data.services = string.decode(buf, offset);
      offset += string.decode.bytes;
      data.regexp = string.decode(buf, offset);
      offset += string.decode.bytes;
      data.replacement = name.decode(buf, offset);
      offset += name.decode.bytes;
      rnaptr.decode.bytes = offset - oldOffset;
      return data;
    };
    rnaptr.decode.bytes = 0;
    rnaptr.encodingLength = function(data) {
      return string.encodingLength(data.flags) + string.encodingLength(data.services) + string.encodingLength(data.regexp) + name.encodingLength(data.replacement) + 6;
    };
    var rtlsa = exports2.tlsa = {};
    rtlsa.encode = function(cert, buf, offset) {
      if (!buf) buf = Buffer2.alloc(rtlsa.encodingLength(cert));
      if (!offset) offset = 0;
      const oldOffset = offset;
      const certdata = cert.certificate;
      if (!Buffer2.isBuffer(certdata)) {
        throw new Error("Certificate must be a Buffer");
      }
      offset += 2;
      buf.writeUInt8(cert.usage, offset);
      offset += 1;
      buf.writeUInt8(cert.selector, offset);
      offset += 1;
      buf.writeUInt8(cert.matchingType, offset);
      offset += 1;
      certdata.copy(buf, offset, 0, certdata.length);
      offset += certdata.length;
      rtlsa.encode.bytes = offset - oldOffset;
      buf.writeUInt16BE(rtlsa.encode.bytes - 2, oldOffset);
      return buf;
    };
    rtlsa.encode.bytes = 0;
    rtlsa.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      const cert = {};
      const length = buf.readUInt16BE(offset);
      offset += 2;
      cert.usage = buf.readUInt8(offset);
      offset += 1;
      cert.selector = buf.readUInt8(offset);
      offset += 1;
      cert.matchingType = buf.readUInt8(offset);
      offset += 1;
      cert.certificate = buf.slice(offset, oldOffset + length + 2);
      offset += cert.certificate.length;
      rtlsa.decode.bytes = offset - oldOffset;
      return cert;
    };
    rtlsa.decode.bytes = 0;
    rtlsa.encodingLength = function(cert) {
      return 5 + Buffer2.byteLength(cert.certificate);
    };
    var renc = exports2.record = function(type) {
      switch (type.toUpperCase()) {
        case "A":
          return ra;
        case "PTR":
          return rptr;
        case "CNAME":
          return rcname;
        case "DNAME":
          return rdname;
        case "TXT":
          return rtxt;
        case "NULL":
          return rnull;
        case "AAAA":
          return raaaa;
        case "SRV":
          return rsrv;
        case "HINFO":
          return rhinfo;
        case "CAA":
          return rcaa;
        case "NS":
          return rns;
        case "SOA":
          return rsoa;
        case "MX":
          return rmx;
        case "OPT":
          return ropt;
        case "DNSKEY":
          return rdnskey;
        case "RRSIG":
          return rrrsig;
        case "RP":
          return rrp;
        case "NSEC":
          return rnsec;
        case "NSEC3":
          return rnsec3;
        case "SSHFP":
          return rsshfp;
        case "DS":
          return rds;
        case "NAPTR":
          return rnaptr;
        case "TLSA":
          return rtlsa;
      }
      return runknown;
    };
    var answer = exports2.answer = {};
    answer.encode = function(a, buf, offset) {
      if (!buf) buf = Buffer2.alloc(answer.encodingLength(a));
      if (!offset) offset = 0;
      const oldOffset = offset;
      name.encode(a.name, buf, offset);
      offset += name.encode.bytes;
      buf.writeUInt16BE(types.toType(a.type), offset);
      if (a.type.toUpperCase() === "OPT") {
        if (a.name !== ".") {
          throw new Error("OPT name must be root.");
        }
        buf.writeUInt16BE(a.udpPayloadSize || 4096, offset + 2);
        buf.writeUInt8(a.extendedRcode || 0, offset + 4);
        buf.writeUInt8(a.ednsVersion || 0, offset + 5);
        buf.writeUInt16BE(a.flags || 0, offset + 6);
        offset += 8;
        ropt.encode(a.options || [], buf, offset);
        offset += ropt.encode.bytes;
      } else {
        let klass = classes.toClass(a.class === void 0 ? "IN" : a.class);
        if (a.flush) klass |= FLUSH_MASK;
        buf.writeUInt16BE(klass, offset + 2);
        buf.writeUInt32BE(a.ttl || 0, offset + 4);
        offset += 8;
        const enc = renc(a.type);
        enc.encode(a.data, buf, offset);
        offset += enc.encode.bytes;
      }
      answer.encode.bytes = offset - oldOffset;
      return buf;
    };
    answer.encode.bytes = 0;
    answer.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const a = {};
      const oldOffset = offset;
      a.name = name.decode(buf, offset);
      offset += name.decode.bytes;
      a.type = types.toString(buf.readUInt16BE(offset));
      if (a.type === "OPT") {
        a.udpPayloadSize = buf.readUInt16BE(offset + 2);
        a.extendedRcode = buf.readUInt8(offset + 4);
        a.ednsVersion = buf.readUInt8(offset + 5);
        a.flags = buf.readUInt16BE(offset + 6);
        a.flag_do = (a.flags >> 15 & 1) === 1;
        a.options = ropt.decode(buf, offset + 8);
        offset += 8 + ropt.decode.bytes;
      } else {
        const klass = buf.readUInt16BE(offset + 2);
        a.ttl = buf.readUInt32BE(offset + 4);
        a.class = classes.toString(klass & NOT_FLUSH_MASK);
        a.flush = !!(klass & FLUSH_MASK);
        const enc = renc(a.type);
        a.data = enc.decode(buf, offset + 8);
        offset += 8 + enc.decode.bytes;
      }
      answer.decode.bytes = offset - oldOffset;
      return a;
    };
    answer.decode.bytes = 0;
    answer.encodingLength = function(a) {
      const data = a.data !== null && a.data !== void 0 ? a.data : a.options;
      return name.encodingLength(a.name) + 8 + renc(a.type).encodingLength(data);
    };
    var question = exports2.question = {};
    question.encode = function(q, buf, offset) {
      if (!buf) buf = Buffer2.alloc(question.encodingLength(q));
      if (!offset) offset = 0;
      const oldOffset = offset;
      name.encode(q.name, buf, offset);
      offset += name.encode.bytes;
      buf.writeUInt16BE(types.toType(q.type), offset);
      offset += 2;
      buf.writeUInt16BE(classes.toClass(q.class === void 0 ? "IN" : q.class), offset);
      offset += 2;
      question.encode.bytes = offset - oldOffset;
      return q;
    };
    question.encode.bytes = 0;
    question.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      const q = {};
      q.name = name.decode(buf, offset);
      offset += name.decode.bytes;
      q.type = types.toString(buf.readUInt16BE(offset));
      offset += 2;
      q.class = classes.toString(buf.readUInt16BE(offset));
      offset += 2;
      const qu = !!(q.class & QU_MASK);
      if (qu) q.class &= NOT_QU_MASK;
      question.decode.bytes = offset - oldOffset;
      return q;
    };
    question.decode.bytes = 0;
    question.encodingLength = function(q) {
      return name.encodingLength(q.name) + 4;
    };
    exports2.AUTHORITATIVE_ANSWER = 1 << 10;
    exports2.TRUNCATED_RESPONSE = 1 << 9;
    exports2.RECURSION_DESIRED = 1 << 8;
    exports2.RECURSION_AVAILABLE = 1 << 7;
    exports2.AUTHENTIC_DATA = 1 << 5;
    exports2.CHECKING_DISABLED = 1 << 4;
    exports2.DNSSEC_OK = 1 << 15;
    exports2.encode = function(result, buf, offset) {
      const allocing = !buf;
      if (allocing) buf = Buffer2.alloc(exports2.encodingLength(result));
      if (!offset) offset = 0;
      const oldOffset = offset;
      if (!result.questions) result.questions = [];
      if (!result.answers) result.answers = [];
      if (!result.authorities) result.authorities = [];
      if (!result.additionals) result.additionals = [];
      header.encode(result, buf, offset);
      offset += header.encode.bytes;
      offset = encodeList(result.questions, question, buf, offset);
      offset = encodeList(result.answers, answer, buf, offset);
      offset = encodeList(result.authorities, answer, buf, offset);
      offset = encodeList(result.additionals, answer, buf, offset);
      exports2.encode.bytes = offset - oldOffset;
      if (allocing && exports2.encode.bytes !== buf.length) {
        return buf.slice(0, exports2.encode.bytes);
      }
      return buf;
    };
    exports2.encode.bytes = 0;
    exports2.decode = function(buf, offset) {
      if (!offset) offset = 0;
      const oldOffset = offset;
      const result = header.decode(buf, offset);
      offset += header.decode.bytes;
      offset = decodeList(result.questions, question, buf, offset);
      offset = decodeList(result.answers, answer, buf, offset);
      offset = decodeList(result.authorities, answer, buf, offset);
      offset = decodeList(result.additionals, answer, buf, offset);
      exports2.decode.bytes = offset - oldOffset;
      return result;
    };
    exports2.decode.bytes = 0;
    exports2.encodingLength = function(result) {
      return header.encodingLength(result) + encodingLengthList(result.questions || [], question) + encodingLengthList(result.answers || [], answer) + encodingLengthList(result.authorities || [], answer) + encodingLengthList(result.additionals || [], answer);
    };
    exports2.streamEncode = function(result) {
      const buf = exports2.encode(result);
      const sbuf = Buffer2.alloc(2);
      sbuf.writeUInt16BE(buf.byteLength);
      const combine = Buffer2.concat([sbuf, buf]);
      exports2.streamEncode.bytes = combine.byteLength;
      return combine;
    };
    exports2.streamEncode.bytes = 0;
    exports2.streamDecode = function(sbuf) {
      const len = sbuf.readUInt16BE(0);
      if (sbuf.byteLength < len + 2) {
        return null;
      }
      const result = exports2.decode(sbuf.slice(2));
      exports2.streamDecode.bytes = exports2.decode.bytes;
      return result;
    };
    exports2.streamDecode.bytes = 0;
    function encodingLengthList(list, enc) {
      let len = 0;
      for (let i = 0; i < list.length; i++) len += enc.encodingLength(list[i]);
      return len;
    }
    function encodeList(list, enc, buf, offset) {
      for (let i = 0; i < list.length; i++) {
        enc.encode(list[i], buf, offset);
        offset += enc.encode.bytes;
      }
      return offset;
    }
    function decodeList(list, enc, buf, offset) {
      for (let i = 0; i < list.length; i++) {
        list[i] = enc.decode(buf, offset);
        offset += enc.decode.bytes;
      }
      return offset;
    }
  }
});

// node_modules/.pnpm/thunky@1.1.0/node_modules/thunky/index.js
var require_thunky = __commonJS({
  "node_modules/.pnpm/thunky@1.1.0/node_modules/thunky/index.js"(exports2, module2) {
    "use strict";
    var nextTick = nextTickArgs;
    process.nextTick(upgrade, 42);
    module2.exports = thunky;
    function thunky(fn) {
      var state = run;
      return thunk;
      function thunk(callback) {
        state(callback || noop);
      }
      function run(callback) {
        var stack = [callback];
        state = wait;
        fn(done);
        function wait(callback2) {
          stack.push(callback2);
        }
        function done(err) {
          var args = arguments;
          state = isError(err) ? run : finished;
          while (stack.length) finished(stack.shift());
          function finished(callback2) {
            nextTick(apply, callback2, args);
          }
        }
      }
    }
    function isError(err) {
      return Object.prototype.toString.call(err) === "[object Error]";
    }
    function noop() {
    }
    function apply(callback, args) {
      callback.apply(null, args);
    }
    function upgrade(val) {
      if (val === 42) nextTick = process.nextTick;
    }
    function nextTickArgs(fn, a, b) {
      process.nextTick(function() {
        fn(a, b);
      });
    }
  }
});

// node_modules/.pnpm/multicast-dns@7.2.5/node_modules/multicast-dns/index.js
var require_multicast_dns = __commonJS({
  "node_modules/.pnpm/multicast-dns@7.2.5/node_modules/multicast-dns/index.js"(exports2, module2) {
    var packet = require_dns_packet();
    var dgram = require("dgram");
    var thunky = require_thunky();
    var events = require("events");
    var os2 = require("os");
    var noop = function() {
    };
    module2.exports = function(opts) {
      if (!opts) opts = {};
      var that = new events.EventEmitter();
      var port = typeof opts.port === "number" ? opts.port : 5353;
      var type = opts.type || "udp4";
      var ip = opts.ip || opts.host || (type === "udp4" ? "224.0.0.251" : null);
      var me = { address: ip, port };
      var memberships = {};
      var destroyed = false;
      var interval = null;
      if (type === "udp6" && (!ip || !opts.interface)) {
        throw new Error("For IPv6 multicast you must specify `ip` and `interface`");
      }
      var socket = opts.socket || dgram.createSocket({
        type,
        reuseAddr: opts.reuseAddr !== false,
        toString: function() {
          return type;
        }
      });
      socket.on("error", function(err) {
        if (err.code === "EACCES" || err.code === "EADDRINUSE") that.emit("error", err);
        else that.emit("warning", err);
      });
      socket.on("message", function(message, rinfo) {
        try {
          message = packet.decode(message);
        } catch (err) {
          that.emit("warning", err);
          return;
        }
        that.emit("packet", message, rinfo);
        if (message.type === "query") that.emit("query", message, rinfo);
        if (message.type === "response") that.emit("response", message, rinfo);
      });
      socket.on("listening", function() {
        if (!port) port = me.port = socket.address().port;
        if (opts.multicast !== false) {
          that.update();
          interval = setInterval(that.update, 5e3);
          socket.setMulticastTTL(opts.ttl || 255);
          socket.setMulticastLoopback(opts.loopback !== false);
        }
      });
      var bind = thunky(function(cb) {
        if (!port || opts.bind === false) return cb(null);
        socket.once("error", cb);
        socket.bind(port, opts.bind || opts.interface, function() {
          socket.removeListener("error", cb);
          cb(null);
        });
      });
      bind(function(err) {
        if (err) return that.emit("error", err);
        that.emit("ready");
      });
      that.send = function(value, rinfo, cb) {
        if (typeof rinfo === "function") return that.send(value, null, rinfo);
        if (!cb) cb = noop;
        if (!rinfo) rinfo = me;
        else if (!rinfo.host && !rinfo.address) rinfo.address = me.address;
        bind(onbind);
        function onbind(err) {
          if (destroyed) return cb();
          if (err) return cb(err);
          var message = packet.encode(value);
          socket.send(message, 0, message.length, rinfo.port, rinfo.address || rinfo.host, cb);
        }
      };
      that.response = that.respond = function(res, rinfo, cb) {
        if (Array.isArray(res)) res = { answers: res };
        res.type = "response";
        res.flags = (res.flags || 0) | packet.AUTHORITATIVE_ANSWER;
        that.send(res, rinfo, cb);
      };
      that.query = function(q, type2, rinfo, cb) {
        if (typeof type2 === "function") return that.query(q, null, null, type2);
        if (typeof type2 === "object" && type2 && type2.port) return that.query(q, null, type2, rinfo);
        if (typeof rinfo === "function") return that.query(q, type2, null, rinfo);
        if (!cb) cb = noop;
        if (typeof q === "string") q = [{ name: q, type: type2 || "ANY" }];
        if (Array.isArray(q)) q = { type: "query", questions: q };
        q.type = "query";
        that.send(q, rinfo, cb);
      };
      that.destroy = function(cb) {
        if (!cb) cb = noop;
        if (destroyed) return process.nextTick(cb);
        destroyed = true;
        clearInterval(interval);
        for (var iface in memberships) {
          try {
            socket.dropMembership(ip, iface);
          } catch (e) {
          }
        }
        memberships = {};
        socket.close(cb);
      };
      that.update = function() {
        var ifaces = opts.interface ? [].concat(opts.interface) : allInterfaces();
        var updated = false;
        for (var i = 0; i < ifaces.length; i++) {
          var addr = ifaces[i];
          if (memberships[addr]) continue;
          try {
            socket.addMembership(ip, addr);
            memberships[addr] = true;
            updated = true;
          } catch (err) {
            that.emit("warning", err);
          }
        }
        if (updated) {
          if (socket.setMulticastInterface) {
            try {
              socket.setMulticastInterface(opts.interface || defaultInterface());
            } catch (err) {
              that.emit("warning", err);
            }
          }
          that.emit("networkInterface");
        }
      };
      return that;
    };
    function defaultInterface() {
      var networks = os2.networkInterfaces();
      var names = Object.keys(networks);
      for (var i = 0; i < names.length; i++) {
        var net = networks[names[i]];
        for (var j = 0; j < net.length; j++) {
          var iface = net[j];
          if (isIPv4(iface.family) && !iface.internal) {
            if (os2.platform() === "darwin" && names[i] === "en0") return iface.address;
            return "0.0.0.0";
          }
        }
      }
      return "127.0.0.1";
    }
    function allInterfaces() {
      var networks = os2.networkInterfaces();
      var names = Object.keys(networks);
      var res = [];
      for (var i = 0; i < names.length; i++) {
        var net = networks[names[i]];
        for (var j = 0; j < net.length; j++) {
          var iface = net[j];
          if (isIPv4(iface.family)) {
            res.push(iface.address);
            break;
          }
        }
      }
      return res;
    }
    function isIPv4(family) {
      return family === 4 || family === "IPv4";
    }
  }
});

// node_modules/.pnpm/fast-deep-equal@3.1.3/node_modules/fast-deep-equal/es6/index.js
var require_es6 = __commonJS({
  "node_modules/.pnpm/fast-deep-equal@3.1.3/node_modules/fast-deep-equal/es6/index.js"(exports2, module2) {
    "use strict";
    module2.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a instanceof Map && b instanceof Map) {
          if (a.size !== b.size) return false;
          for (i of a.entries())
            if (!b.has(i[0])) return false;
          for (i of a.entries())
            if (!equal(i[1], b.get(i[0]))) return false;
          return true;
        }
        if (a instanceof Set && b instanceof Set) {
          if (a.size !== b.size) return false;
          for (i of a.entries())
            if (!b.has(i[0])) return false;
          return true;
        }
        if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (a[i] !== b[i]) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key2 = keys[i];
          if (!equal(a[key2], b[key2])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/mdns-server.js
var require_mdns_server = __commonJS({
  "node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/mdns-server.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Server = void 0;
    var multicast_dns_1 = __importDefault(require_multicast_dns());
    var es6_1 = __importDefault(require_es6());
    var dns_equal_1 = __importDefault(require_dns_equal());
    var Server = class {
      constructor(opts, errorCallback) {
        this.registry = {};
        this.mdns = (0, multicast_dns_1.default)(opts);
        this.mdns.setMaxListeners(0);
        this.mdns.on("query", this.respondToQuery.bind(this));
        this.errorCallback = errorCallback !== null && errorCallback !== void 0 ? errorCallback : function(err) {
          throw err;
        };
      }
      register(records) {
        const shouldRegister = (record) => {
          var subRegistry = this.registry[record.type];
          if (!subRegistry) {
            subRegistry = this.registry[record.type] = [];
          } else if (subRegistry.some(this.isDuplicateRecord(record))) {
            return;
          }
          subRegistry.push(record);
        };
        if (Array.isArray(records)) {
          records.forEach(shouldRegister);
        } else {
          shouldRegister(records);
        }
      }
      unregister(records) {
        const shouldUnregister = (record) => {
          let type = record.type;
          if (!(type in this.registry)) {
            return;
          }
          this.registry[type] = this.registry[type].filter((i) => i.name !== record.name);
        };
        if (Array.isArray(records)) {
          records.forEach(shouldUnregister);
        } else {
          shouldUnregister(records);
        }
      }
      respondToQuery(query) {
        let self = this;
        query.questions.forEach((question) => {
          var type = question.type;
          var name = question.name;
          var answers = type === "ANY" ? Object.keys(self.registry).map(self.recordsFor.bind(self, name)).flat(1) : self.recordsFor(name, type);
          if (answers.length === 0)
            return;
          var additionals = [];
          if (type !== "ANY") {
            answers.forEach((answer) => {
              if (answer.type !== "PTR")
                return;
              additionals = additionals.concat(self.recordsFor(answer.data, "SRV")).concat(self.recordsFor(answer.data, "TXT"));
            });
            additionals.filter(function(record) {
              return record.type === "SRV";
            }).map(function(record) {
              return record.data.target;
            }).filter(this.unique()).forEach(function(target) {
              additionals = additionals.concat(self.recordsFor(target, "A")).concat(self.recordsFor(target, "AAAA"));
            });
          }
          self.mdns.respond({ answers, additionals }, (err) => {
            if (err) {
              this.errorCallback(err);
            }
          });
        });
      }
      recordsFor(name, type) {
        if (!(type in this.registry)) {
          return [];
        }
        return this.registry[type].filter((record) => {
          var _name = ~name.indexOf(".") ? record.name : record.name.split(".")[0];
          return (0, dns_equal_1.default)(_name, name);
        });
      }
      isDuplicateRecord(a) {
        return (b) => {
          return a.type === b.type && a.name === b.name && (0, es6_1.default)(a.data, b.data);
        };
      }
      unique() {
        var set = [];
        return (obj) => {
          if (~set.indexOf(obj))
            return false;
          set.push(obj);
          return true;
        };
      }
    };
    exports2.Server = Server;
    exports2.default = Server;
  }
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/utils/filter-service.js
var require_filter_service = __commonJS({
  "node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/utils/filter-service.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = (service, txtQuery) => {
      if (txtQuery === void 0)
        return true;
      let serviceTxt = service.txt;
      let query = Object.entries(txtQuery).map(([key2, value]) => {
        let queryValue = serviceTxt[key2];
        if (queryValue === void 0)
          return false;
        if (value != queryValue)
          return false;
        return true;
      });
      if (query.length == 0)
        return true;
      if (query.includes(false))
        return false;
      return true;
    };
  }
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/utils/filter-txt.js
var require_filter_txt = __commonJS({
  "node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/utils/filter-txt.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = (data) => Object.keys(data).filter((key2) => !key2.includes("binary")).reduce((cur, key2) => {
      return Object.assign(cur, { [key2]: data[key2] });
    }, {});
  }
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/utils/equal-txt.js
var require_equal_txt = __commonJS({
  "node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/utils/equal-txt.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = equalTxt;
    function equalTxt(a, b) {
      if (a === void 0 || b === void 0)
        return false;
      let aKeys = Object.keys(a);
      let bKeys = Object.keys(b);
      if (aKeys.length != bKeys.length)
        return false;
      for (let key2 of aKeys) {
        if (a[key2] != b[key2])
          return false;
      }
      return true;
    }
  }
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/browser.js
var require_browser = __commonJS({
  "node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/browser.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Browser = void 0;
    var dns_txt_1 = __importDefault(require_dns_txt());
    var dns_equal_1 = __importDefault(require_dns_equal());
    var events_1 = require("events");
    var service_types_1 = require_service_types();
    var filter_service_1 = __importDefault(require_filter_service());
    var filter_txt_1 = __importDefault(require_filter_txt());
    var equal_txt_1 = __importDefault(require_equal_txt());
    var TLD = ".local";
    var WILDCARD = "_services._dns-sd._udp" + TLD;
    var Browser = class _Browser extends events_1.EventEmitter {
      constructor(mdns, opts, onup) {
        super();
        this.onresponse = void 0;
        this.serviceMap = {};
        this.wildcard = false;
        this._services = [];
        if (typeof opts === "function")
          return new _Browser(mdns, null, opts);
        this.mdns = mdns;
        this.txt = new dns_txt_1.default(opts !== null && opts.txt != null ? opts.txt : void 0);
        if (opts === null || opts.type === void 0) {
          this.name = WILDCARD;
          this.wildcard = true;
        } else {
          this.name = (0, service_types_1.toString)({ name: opts.type, protocol: opts.protocol || "tcp" }) + TLD;
          if (opts.name)
            this.name = opts.name + "." + this.name;
          this.wildcard = false;
        }
        if (opts != null && opts.txt !== void 0)
          this.txtQuery = (0, filter_txt_1.default)(opts.txt);
        if (onup)
          this.on("up", onup);
        this.start();
      }
      start() {
        if (this.onresponse || this.name === void 0)
          return;
        var self = this;
        var nameMap = {};
        if (!this.wildcard)
          nameMap[this.name] = true;
        this.onresponse = (packet, rinfo) => {
          if (self.wildcard) {
            packet.answers.forEach((answer) => {
              if (answer.type !== "PTR" || answer.name !== self.name || answer.name in nameMap)
                return;
              nameMap[answer.data] = true;
              self.mdns.query(answer.data, "PTR");
            });
          }
          const receiveTime = Date.now();
          Object.keys(nameMap).forEach(function(name) {
            self.goodbyes(name, packet).forEach(self.removeService.bind(self));
            var matches = self.buildServicesFor(name, packet, self.txt, rinfo, receiveTime);
            if (matches.length === 0)
              return;
            matches.forEach((service) => {
              const existingService = self._services.find((s) => (0, dns_equal_1.default)(s.fqdn, service.fqdn));
              if (existingService) {
                self.updateServiceSrv(existingService, service);
                self.updateServiceTxt(existingService, service);
                return;
              }
              self.addService(service);
            });
          });
        };
        this.mdns.on("response", this.onresponse);
        this.update();
      }
      stop() {
        if (!this.onresponse)
          return;
        this.mdns.removeListener("response", this.onresponse);
        this.onresponse = void 0;
      }
      update() {
        this.mdns.query(this.name, "PTR");
      }
      expire() {
        const currentTime = Date.now();
        this._services = this._services.filter((service) => {
          if (!service.ttl || service.lastSeen === void 0)
            return true;
          const expireTime = service.lastSeen + service.ttl * 1e3;
          if (expireTime < currentTime) {
            this.emit("down", service);
            return false;
          }
          return true;
        });
      }
      get services() {
        return this._services;
      }
      addService(service) {
        if ((0, filter_service_1.default)(service, this.txtQuery) === false)
          return;
        this._services.push(service);
        this.serviceMap[service.fqdn] = true;
        this.emit("up", service);
      }
      updateServiceSrv(existingService, newService) {
        if (existingService.name !== newService.name || existingService.host !== newService.host || existingService.port !== newService.port || existingService.type !== newService.type || existingService.protocol !== newService.protocol) {
          this.replaceService(newService);
          this.emit("srv-update", newService, existingService);
        }
      }
      updateServiceTxt(existingService, service) {
        if ((0, equal_txt_1.default)(service.txt, (existingService === null || existingService === void 0 ? void 0 : existingService.txt) || {}))
          return;
        if (!(0, filter_service_1.default)(service, this.txtQuery)) {
          this.removeService(service.fqdn);
          return;
        }
        this.replaceService(service);
        this.emit("txt-update", service, existingService);
      }
      replaceService(service) {
        this._services = this._services.map((s) => {
          if (!(0, dns_equal_1.default)(s.fqdn, service.fqdn))
            return s;
          return service;
        });
      }
      removeService(fqdn) {
        var service, index;
        this._services.some(function(s, i) {
          if ((0, dns_equal_1.default)(s.fqdn, fqdn)) {
            service = s;
            index = i;
            return true;
          }
        });
        if (!service || index === void 0)
          return;
        this._services.splice(index, 1);
        delete this.serviceMap[fqdn];
        this.emit("down", service);
      }
      goodbyes(name, packet) {
        return packet.answers.concat(packet.additionals).filter((rr) => rr.type === "PTR" && rr.ttl === 0 && (0, dns_equal_1.default)(rr.name, name)).map((rr) => rr.data);
      }
      buildServicesFor(name, packet, txt, referer, receiveTime) {
        var records = packet.answers.concat(packet.additionals).filter((rr) => rr.ttl > 0);
        return records.filter((rr) => rr.type === "PTR" && (0, dns_equal_1.default)(rr.name, name)).map((ptr) => {
          const service = {
            addresses: [],
            subtypes: [],
            ttl: ptr.ttl,
            lastSeen: receiveTime
          };
          records.filter((rr) => {
            return rr.type === "PTR" && (0, dns_equal_1.default)(rr.data, ptr.data) && rr.name.includes("._sub");
          }).forEach((rr) => {
            const types = (0, service_types_1.toType)(rr.name);
            service.subtypes.push(types.subtype);
          });
          records.filter((rr) => {
            return (rr.type === "SRV" || rr.type === "TXT") && (0, dns_equal_1.default)(rr.name, ptr.data);
          }).forEach((rr) => {
            if (rr.type === "SRV") {
              var parts = rr.name.split(".");
              var name2 = parts[0];
              var types = (0, service_types_1.toType)(parts.slice(1, -1).join("."));
              service.name = name2;
              service.fqdn = rr.name;
              service.host = rr.data.target;
              service.referer = referer;
              service.port = rr.data.port;
              service.type = types.name;
              service.protocol = types.protocol;
            } else if (rr.type === "TXT") {
              service.rawTxt = rr.data;
              service.txt = this.txt.decodeAll(rr.data);
            }
          });
          if (!service.name)
            return;
          records.filter((rr) => (rr.type === "A" || rr.type === "AAAA") && (0, dns_equal_1.default)(rr.name, service.host)).forEach((rr) => service.addresses.push(rr.data));
          return service;
        }).filter((rr) => !!rr);
      }
    };
    exports2.Browser = Browser;
    exports2.default = Browser;
  }
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/bonjour.js
var require_bonjour = __commonJS({
  "node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/lib/bonjour.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Browser = exports2.Service = void 0;
    var registry_1 = __importDefault(require_registry());
    var mdns_server_1 = __importDefault(require_mdns_server());
    var browser_1 = __importDefault(require_browser());
    exports2.Browser = browser_1.default;
    var service_1 = __importDefault(require_service());
    exports2.Service = service_1.default;
    var Bonjour2 = class {
      constructor(opts = {}, errorCallback) {
        this.server = new mdns_server_1.default(opts, errorCallback);
        this.registry = new registry_1.default(this.server);
      }
      publish(opts) {
        return this.registry.publish(opts);
      }
      unpublishAll(callback) {
        return this.registry.unpublishAll(callback);
      }
      find(opts = null, onup) {
        return new browser_1.default(this.server.mdns, opts, onup);
      }
      findOne(opts = null, timeout = 1e4, callback) {
        const browser = new browser_1.default(this.server.mdns, opts);
        var timer;
        browser.once("up", (service) => {
          if (timer !== void 0)
            clearTimeout(timer);
          browser.stop();
          if (callback)
            callback(service);
        });
        timer = setTimeout(() => {
          browser.stop();
          if (callback)
            callback(null);
        }, timeout);
        return browser;
      }
      destroy(callback) {
        this.registry.destroy();
        this.server.mdns.destroy(callback);
      }
    };
    exports2.default = Bonjour2;
  }
});

// node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/index.js
var require_dist = __commonJS({
  "node_modules/.pnpm/bonjour-service@1.4.4/node_modules/bonjour-service/dist/index.js"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    var bonjour_1 = __importDefault(require_bonjour());
    var imported = __importStar(require_bonjour());
    var Bonjour2 = class extends bonjour_1.default {
    };
    var BonjourClass = Bonjour2;
    (function(Bonjour3) {
      Bonjour3.Bonjour = BonjourClass;
      Bonjour3.Service = imported.Service;
      Bonjour3.Browser = imported.Browser;
    })(Bonjour2 || (Bonjour2 = {}));
    Object.defineProperty(Bonjour2, "default", {
      enumerable: true,
      value: Bonjour2
    });
    module2.exports.Bonjour = Bonjour2;
    module2.exports.Service = imported.Service;
    module2.exports.Browser = imported.Browser;
    module2.exports.default = Bonjour2;
    module2.exports = Bonjour2;
  }
});

// electron/lan-service.mjs
var lan_service_exports = {};
__export(lan_service_exports, {
  LanService: () => LanService
});
module.exports = __toCommonJS(lan_service_exports);
var import_node_http = __toESM(require("node:http"), 1);
var import_node_os = __toESM(require("node:os"), 1);
var import_bonjour_service = __toESM(require_dist(), 1);

// shared/lan-crypto.mjs
function base64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
function unbase64(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error("Invalid encrypted message.");
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
async function key(secret) {
  const bytes = unbase64(secret);
  if (bytes.length !== 32) throw new Error("Invalid pairing key.");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
var aad = new TextEncoder().encode("Guitar.io LAN v1");
async function seal(secret, value) {
  const nonce = crypto.getRandomValues(new Uint8Array(12)), data = new TextEncoder().encode(JSON.stringify(value)), body = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, await key(secret), data);
  return { v: 1, nonce: base64(nonce), body: base64(new Uint8Array(body)) };
}
async function open(secret, envelope) {
  if (envelope?.v !== 1) throw new Error("Incompatible sync protocol.");
  const nonce = unbase64(envelope.nonce);
  if (nonce.length !== 12) throw new Error("Invalid nonce.");
  const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, await key(secret), unbase64(envelope.body));
  return JSON.parse(new TextDecoder().decode(bytes));
}
function privateIPv4(host) {
  if (typeof host !== "string") return false;
  const parts = host.replace(/^::ffff:/, "").split(".").map(Number);
  if (parts.length !== 4 || !parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31 || a === 169 && b === 254;
}
function localEndpoint(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !privateIPv4(url.hostname) || url.username || url.password || url.pathname !== "/sync" || url.search || url.hash || !url.port) throw new Error("Use a private LAN IPv4 address and the Guitar.io sync port.");
  return url.href;
}

// electron/lan-service.mjs
var LanService = class {
  constructor(handler) {
    this.handler = handler;
    this.peers = /* @__PURE__ */ new Map();
    this.replay = /* @__PURE__ */ new Map();
    this.server = void 0;
    this.bonjour = void 0;
    this.config = void 0;
    this.pending = 0;
  }
  status() {
    return { available: true, enabled: !!this.server, name: this.config?.name || import_node_os.default.hostname(), endpoints: this.endpoints || [], discovered: [...this.peers.values()], error: this.error || "" };
  }
  addresses() {
    const port = this.server?.address()?.port, addresses = port ? Object.values(import_node_os.default.networkInterfaces()).flat().filter((a) => a?.family === "IPv4" && !a.internal && privateIPv4(a.address)).map((a) => `http://${a.address}:${port}/sync`) : [];
    const routed = addresses.filter((a) => !a.includes("169.254."));
    return routed.length ? routed : addresses;
  }
  advertise() {
    this.service = this.bonjour.publish({ name: `Guitar.io ${this.config.id}`, type: "guitario", port: this.server.address().port, txt: { id: this.config.id, name: this.config.name, protocol: "1", code: this.config.pairingCode || "" } });
  }
  async configure(config) {
    if (!config.enabled) {
      await this.stop();
      return this.status();
    }
    if (typeof config.id !== "string" || config.id.length > 200 || typeof config.secret !== "string" || typeof config.name !== "string" || config.name.length > 100) throw new Error("Invalid LAN configuration.");
    if (this.server && this.config?.secret === config.secret && this.config?.name === config.name && this.config?.pairingCode === config.pairingCode) return this.status();
    await this.stop();
    this.config = config;
    this.error = "";
    this.server = import_node_http.default.createServer(async (request, response) => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      if (request.method !== "POST" || request.url !== "/sync" || !privateIPv4(request.socket.remoteAddress || "")) {
        response.writeHead(403);
        response.end();
        return;
      }
      if (this.pending >= 4) {
        response.writeHead(429);
        response.end();
        return;
      }
      this.pending++;
      try {
        let size = 0;
        const chunks = [];
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 48 * 1024 * 1024) throw new Error("Sync page too large.");
          chunks.push(chunk);
        }
        const envelope = JSON.parse(Buffer.concat(chunks).toString());
        if (envelope?.op === "pair:init" || envelope?.op === "pair:reveal" || envelope?.op === "pair:finish") {
          if (size > 4096) throw new Error("Pairing request too large.");
          const payload2 = await this.handler(envelope, "pairing");
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify(payload2));
          return;
        }
        const message = await open(this.config.secret, envelope);
        if (Math.abs(Date.now() - message.at) > 12e4 || typeof message.requestId !== "string" || message.requestId.length > 100 || this.replay.has(message.requestId) || typeof message.deviceId !== "string" || message.deviceId.length > 200) throw new Error("Expired or replayed request.");
        this.replay.set(message.requestId, Date.now());
        for (const [id, time] of this.replay) if (time < Date.now() - 12e4) this.replay.delete(id);
        if (this.replay.size > 2e4) throw new Error("Too many sync requests.");
        let payload;
        try {
          payload = await this.handler(message.payload, message.deviceId);
        } catch (e) {
          payload = { error: e.message || "Sync request failed." };
        }
        const result = await seal(this.config.secret, { requestId: message.requestId, deviceId: this.config.id, payload });
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(result));
      } catch {
        response.writeHead(403);
        response.end();
      } finally {
        this.pending--;
      }
    });
    this.server.requestTimeout = 3e4;
    this.server.headersTimeout = 1e4;
    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "0.0.0.0", resolve);
    });
    const port = this.server.address().port;
    this.endpoints = this.addresses();
    try {
      this.bonjour = new import_bonjour_service.Bonjour();
      this.advertise();
      const discovered = (service) => {
        const id = service.txt?.id;
        if (!id || id === config.id) return;
        const all = (service.addresses || []).filter(privateIPv4).map((address) => `http://${address}:${service.port}/sync`), routed = all.filter((a) => !a.includes("169.254.")), endpoints = routed.length ? routed : all;
        if (endpoints.length) this.peers.set(id, { id, name: service.txt?.name || "Guitar.io", code: service.txt?.code || this.peers.get(id)?.code || "", endpoints });
      };
      this.browser = this.bonjour.find({ type: "guitario" }, discovered);
      this.browser.on("txt-update", discovered);
      this.browser.on("srv-update", discovered);
      this.browser.on("down", (service) => this.peers.delete(service.txt?.id));
      this.networkTimer = setInterval(() => {
        const addresses = this.addresses();
        if (JSON.stringify(addresses) !== JSON.stringify(this.endpoints)) {
          this.endpoints = addresses;
          this.service?.stop(() => {
            if (this.server && this.bonjour) this.advertise();
          });
        }
      }, 5e3);
      this.networkTimer.unref();
    } catch (e) {
      this.error = "Automatic discovery unavailable. Use the pairing address. " + e.message;
    }
    return this.status();
  }
  async request(endpoint, body) {
    localEndpoint(endpoint);
    const result = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(25e3), redirect: "error" });
    if (!result.ok) throw new Error(result.status === 403 ? "Pairing rejected. Check the pairing code and device clocks." : `LAN connection failed (${result.status}).`);
    const text = await result.text();
    if (text.length > 64 * 1024 * 1024) throw new Error("Sync response too large.");
    return JSON.parse(text);
  }
  async stop() {
    if (this.networkTimer) clearInterval(this.networkTimer);
    this.browser?.stop();
    this.bonjour?.unpublishAll();
    this.bonjour?.destroy();
    this.bonjour = void 0;
    this.browser = void 0;
    this.peers.clear();
    this.endpoints = [];
    if (this.server) {
      const server = this.server;
      this.server = void 0;
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LanService
});
