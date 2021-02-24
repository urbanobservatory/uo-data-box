// Initial Author: Salvador Guerrero - https://gist.github.com/ObjSal/8a8bbe7809553c81e0ab309b67b4dd51#file-encoding-util-js

// https://nodejs.org/api/zlib.html
import * as zlib from "zlib";

import { EncodingInfo, Encoder } from "../types";

class EncoderInfo {
  public name: string;
  constructor(name: string) {
    this.name = name;
  }
  isIdentity() {
    return this.name === Encoder.IDENTITY;
  }
  createEncoder() {
    switch (this.name) {
      case Encoder.GZIP:
        return zlib.createGzip();
      case Encoder.DEFLATE:
        return zlib.createDeflate();
      case Encoder.BR:
        return zlib.createBrotliCompress();
      default:
        return null;
    }
  }
}

class ClientEncodingInfo {
  public name: string;
  public qvalue: number;
  constructor(info: EncodingInfo) {
    this.name = info.name;
    this.qvalue = info.qvalue;
  }
}

export function getSupportedEncoderInfo(request: any) {
  // See https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
  const acceptEncoding = request.headers["accept-encoding"];
  let acceptEncodings = [];
  let knownEncodings = [
    Encoder.GZIP,
    Encoder.DEFLATE,
    Encoder.BR,
    Encoder.ANY,
    Encoder.IDENTITY,
  ];
  // If explicit is true, then it means the client sent *;q=0, meaning accept only given encodings
  let explicit = false;
  if (!acceptEncoding || acceptEncoding.trim().length === 0) {
    // If the Accept-Encoding field-value is empty, then only the "identity" encoding is acceptable.
    knownEncodings = [Encoder.IDENTITY];
    acceptEncodings = [
      new ClientEncodingInfo({ name: Encoder.IDENTITY, qvalue: 1 }),
    ];
  } else {
    // NOTE: Only return 406 if the client sends 'identity;q=0' or a '*;q=0'
    let acceptEncodingArray = acceptEncoding.split(",");
    for (let encoding of acceptEncodingArray) {
      encoding = encoding.trim();
      if (/[a-z*];q=0$/.test(encoding)) {
        // The "identity" content-coding is always acceptable, unless
        // specifically refused because the Accept-Encoding field includes
        // "identity;q=0", or because the field includes "*;q=0" and does
        // not explicitly include the "identity" content-coding.
        let split = encoding.split(";");
        let name = split[0].trim();
        if (name === Encoder.ANY) {
          explicit = true;
        }
        knownEncodings.splice(knownEncodings.indexOf(name), 1);
      } else if (/[a-z*]+;q=\d+(.\d+)*/.test(encoding)) {
        // This string contains a qvalue.
        let split = encoding.split(";");
        let name: string = split[0].trim();
        let value = split[1].trim();
        value = value.split("=")[1];
        value = parseFloat(value);
        acceptEncodings.push(new ClientEncodingInfo({ name, qvalue: value }));
      } else {
        // No qvalue, treat it as q=1.0
        acceptEncodings.push(
          new ClientEncodingInfo({ name: encoding.trim(), qvalue: 1.0 })
        );
      }
    }
    // order by qvalue, max to min
    acceptEncodings.sort((a: any, b: any) => {
      return b.qvalue - a.qvalue;
    });
  }
  // `acceptEncodings` is sorted by priority
  // Pick the first known encoding.
  let encoding = "";
  for (let encodingInfo of acceptEncodings) {
    if (knownEncodings.indexOf(encodingInfo.name) !== -1) {
      encoding = encodingInfo.name;
      break;
    }
  }

  // If any, pick a known encoding
  if (encoding === Encoder.ANY) {
    for (let knownEncoding of knownEncodings) {
      if (knownEncoding === Encoder.ANY) {
        continue;
      } else {
        encoding = knownEncoding;
        break;
      }
    }
  }

  // If no known encoding was set, then use identity if not excluded
  if (encoding.length === 0) {
    if (!explicit && knownEncodings.indexOf(Encoder.IDENTITY) !== -1) {
      encoding = Encoder.IDENTITY;
    } else {
      console.error(
        "No known encoding were found in accept-encoding, return http status code 406"
      );
      return null;
    }
  }

  return new EncoderInfo(encoding);
}
