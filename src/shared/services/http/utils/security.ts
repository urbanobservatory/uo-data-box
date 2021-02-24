// Initial Author: Salvador Guerrero - https://gist.github.com/ObjSal/8a8bbe7809553c81e0ab309b67b4dd51#file-encoding-util-js

import * as querystring from "querystring";
import { log } from "shared/services";
import { File, Parameter, ApplicationType } from "../types";

function endRequestWithError(
  response: any,
  body: any,
  statusCode: any,
  message: any,
  cb: any
) {
  response.statusCode = statusCode;
  if (message && message.length > 0) {
    response.setHeader("Content-Type", "application/json");
    body.end(JSON.stringify({ message: message }));
    if (cb) cb(new Error(message));
  } else {
    body.end();
    if (cb) cb(new Error(`Error with statusCode: ${statusCode}`));
  }
}

function getMatching(string: any, regex: any) {
  // Helper function when using non-matching groups
  const matches = string.match(regex);
  if (!matches || matches.length < 2) {
    return null;
  }
  return matches[1];
}

function getBoundary(contentTypeArray: any) {
  const boundaryPrefix = "boundary=";
  let boundary = contentTypeArray.find((item: string) =>
    item.startsWith(boundaryPrefix)
  );
  if (!boundary) return null;
  boundary = boundary.slice(boundaryPrefix.length);
  if (boundary) boundary = boundary.trim();
  return boundary;
}

export function readRequestDataInMemory(
  request: any,
  response: any,
  body: any,
  maxLength: any,
  callback: any
) {
  const contentLength = parseInt(request.headers["content-length"]);
  if (isNaN(contentLength)) {
    endRequestWithError(response, body, 411, "Length required", callback);
    return;
  }

  // Don't need to validate while reading, V8 runtime only reads what content-length specifies.
  if (contentLength > maxLength) {
    endRequestWithError(
      response,
      body,
      413,
      `Content length is greater than ${maxLength} Bytes`,
      callback
    );
    return;
  }

  let contentType = request.headers["content-type"];
  const contentTypeArray = contentType
    .split(";")
    .map((item: string) => item.trim());
  if (contentTypeArray && contentTypeArray.length) {
    contentType = contentTypeArray[0];
  }

  if (!contentType) {
    endRequestWithError(
      response,
      body,
      400,
      "Content type not specified",
      callback
    );
    return;
  }

  if (
    !/((application\/(json|x-www-form-urlencoded))|multipart\/form-data)/.test(
      contentType
    )
  ) {
    endRequestWithError(
      response,
      body,
      400,
      "Content type is not supported",
      callback
    );
    return;
  }

  if (contentType === ApplicationType.FORM) {
    // Use latin1 encoding to parse binary files correctly
    request.setEncoding("latin1");
  } else {
    request.setEncoding("utf8");
  }

  let rawData = "";
  request.on("data", (chunk: any) => {
    rawData += chunk;
  });

  request.on("end", () => {
    switch (contentType) {
      case ApplicationType.JSON: {
        try {
          callback(null, JSON.parse(rawData));
        } catch (e) {
          endRequestWithError(
            response,
            body,
            400,
            "There was an error trying to parse the data as JSON",
            callback(e)
          );
        }
        break;
      }
      case ApplicationType.URL: {
        try {
          let parsedData = querystring.decode(rawData);
          callback(null, parsedData);
        } catch (e) {
          endRequestWithError(
            response,
            body,
            400,
            "There was an error trying to parse the form data",
            callback(e)
          );
        }
        break;
      }
      case ApplicationType.FORM: {
        const boundary = getBoundary(contentTypeArray);
        if (!boundary) {
          endRequestWithError(
            response,
            body,
            400,
            "Boundary information missing",
            callback
          );
          return;
        }
        let files: File[] = [];
        let values: Parameter[] = [];
        const rawDataArray = rawData.split(boundary);
        for (let item of rawDataArray) {
          // Use non-matching groups to exclude part of the result
          let name: string = getMatching(item, /(?:name=")(.+?)(?:")/);
          if (!name || !(name = name.trim())) continue;
          let value = getMatching(item, /(?:\r\n\r\n)([\S\s]*)(?:\r\n--$)/);
          if (!value) continue;
          let filename = getMatching(item, /(?:filename=")(.*?)(?:")/);
          if (filename && (filename = filename.trim())) {
            let file: File = {
              filename: filename,
              name: name,
              data: value,
              type: "",
            };
            let contentType = getMatching(
              item,
              /(?:Content-Type:)(.*?)(?:\r\n)/
            );
            if (contentType && (contentType = contentType.trim())) {
              file.type = contentType;
            }
            files.push(file);
          } else {
            values.push({ name, value });
          }
        }
        callback(null, { values, files });
        break;
      }
      default: {
        callback(null, rawData);
      }
    }
  });
}
