import { Config } from 'shared/services/config'

const organisationName: string = Config.getValue('db_organisation') || 'uo'
const systemName: string | null = Config.getValue('db_system') || null

export class SQL {
  static TableName(tableName: string): string {
    let completeName: string = tableName

    if (systemName) {
      completeName = `${systemName}_${completeName}`
    }

    if (organisationName) {
      completeName = `${organisationName}_${completeName}`
    }

    return completeName
  }
}
