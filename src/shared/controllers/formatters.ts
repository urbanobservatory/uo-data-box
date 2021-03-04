import { Request, Response } from 'express'
import json2csv from 'json2csv'

import { Config } from 'shared/services/config'
import { parseSearchTerms } from 'shared/services/search'
import { log } from 'shared/services/log'

let stripPrefixes: any = null

export function fuzzyName(name: string) {
  console.log(`Attempting fuzzy match: ${name}`)
  const fuzzy = `(.*)${name
    .replace(/([\(\)])/gi, '\\$1')
    .replace(/[- ]+/g, '([^a-z0-9()]+)')}$`
  console.log(`  Fuzzy version: ${fuzzy}`)
  return fuzzy
}

export function uriName(name: string | string[] = ''): any {
  // Allow common prefixes to be removed
  if (stripPrefixes === null) {
    stripPrefixes =
      parseSearchTerms(Config.getValue('api_url_exclusions')) || []
  }

  if (!Array.isArray(name) && stripPrefixes && name) {
    stripPrefixes.forEach((p: string) => {
      if (!p) return
      name = (<string>name).replace(p, '')
    })
  }

  return Array.isArray(name)
    ? name.map((n: string) => uriName(n)).join('/')
    : name
        .replace(/[^a-z0-9()]+/gi, '-')
        .replace(/(^-|-$)/, '')
        .toLowerCase()
}

export function csvTransform(transform: Function) {
  return (request: Request, response: Response, next: any) => {
    const originalJson = response.json
    response.json = (json, ...j) => {
      const requestQuery =
        request.query.outputAs instanceof String ? request.query.outputAs : ''
      if (request.query.outputAs && requestQuery.toLowerCase() === 'csv') {
        const { headers, data, filename } = transform(json)

        // Could not convert
        if (data === false) {
          originalJson.call(response, json, ...j)
          return response
        }

        const csv =
          (headers || []).map((l: string) => `# ${l}`).join('\n') +
          '\n' +
          json2csv({ data })

        try {
          if (!response.headersSent) {
            response.header('Content-Type', 'text/csv')
            response.header(
              'Content-Disposition',
              `attachment; filename=uo-data${
                filename ? `-${filename}` : ''
              }.csv`
            )
          }
          response.send(csv)
          return response
        } catch (e) {
          log.warn(`Error converting to CSV`)
          log.warn(`  ${e.message}`)
          log.debug(`  ${e.stack}`)
          response.status(500)
          originalJson.call(response, {
            error: true,
            message: 'Error while converting to CSV output.',
            code: 'InternalServerError',
          })
          return response
        }
      }
      originalJson.call(response, json, ...j)
      return response
    }
    next()
  }
}
