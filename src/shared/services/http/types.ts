export interface File {
  name: string;
  filename: string;
  type: string;
  data: any;
}
export interface Parameter {
  name: string;
  value: any;
}

export interface EncodingInfo {
  name: string;
  qvalue: number;
}

export enum Encoder {
  GZIP = "gzip",
  DEFLATE = "deflate",
  BR = "br",
  IDENTITY = "identity",
  ANY = "*",
}

export enum ApplicationType {
  JSON = "application/json",
  URL = "application/x-www-form-urlencoded",
  FORM = "multipart/form-data",
}
