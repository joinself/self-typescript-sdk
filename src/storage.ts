import * as fs from 'fs'

import * as sqlite from 'sqlite'

import * as path from 'path';

export interface IOManager {
  write(path:string, value:string, opts?)
  read(path:string): string
  exists(path: string): boolean
}

export class FsStore {
  public write(path:string, value:string, opts={ flag: 'w' }) {
    fs.writeFileSync(path, value, opts)
  }

  public read(path:string):string {
    let offset = fs.readFileSync(path, { flag: 'r' })
    return offset.toString()
  }

  public exists(path: string): boolean {
    return fs.existsSync(path)
  }
}

export interface SessionStorage {
  appID: string

  setup()
  tx(callback: Function)
  accountExists(): Promise<boolean>
  createAccount(olm: string)
  updateAccount(olm: string, offset?: number)
  getAccountOlm(): Promise<string>
  getAccountOffset(): Promise<number>
  setAccountOffset(offset: number)
  createSession(sid: string, olm: string)
  updateSession(sid: string, olm: string)
  getSessionOlm(sid:string): Promise<string>
  sessionExists(sid: string): Promise<boolean>
  sid(self_id:string, device: string): string
}

export interface txCallback { (): void }

export default class SQLiteStorage {
  appID: string
  appDevice: string
  storageFolder: string
  db: any

  constructor(appID: string, appDevice: string, storageFolder: string) {
    this.appID = this.sid(appID, appDevice)
    this.appDevice = appDevice
    this.storageFolder = storageFolder
    this.db = null
    this.createDirectorySkel(`${storageFolder}/identities/devices/${this.appDevice}`)
  }

  public async setup() {
    this.db = await sqlite.open(`${this.storageFolder}/identities/devices/${this.appDevice}/self.db`)

    await this.setPragmas()
    await this.createAccountsTable()
    await this.createSessionsTable()

    //TODO: add the migration stuff ...
    const migrator = new FileToSQLiteStorageMigrator(this.db, this.storageFolder, this.appID)
    await migrator.migrate()
  }

  public async tx(callback: txCallback) {
    try {
      var sql = "BEGIN TRANSACTION;"
      await this.db.exec(sql); //useTransaction = false
      await callback()
      await this.db.exec('COMMIT TRANSACTION;'); //useTransaction = false
    } catch (e) {
      await this.db.exec('ROLLBACK TRANSACTION;'); //useTransaction = false
    }
  }
  public async accountExists(): Promise<boolean> {
    const result = await this.db.get(
      'SELECT olm_account FROM accounts WHERE as_identifier = ?;',
      this.appID
    );

    return result !== undefined;
  }

  public async createAccount(olm: string) {
    await this.db.run(
      'INSERT INTO accounts (as_identifier, offset, olm_account) VALUES (?, ?, ?);',
      this.appID, 0, olm
    );
  }

  public async updateAccount(olm: string, offset?: number) {
    await this.db.run(
      'UPDATE accounts SET olm_account = ? WHERE as_identifier = ?',
      olm,
      this.appID
    );
  }

  public async getAccountOlm(): Promise<string> {
    const row = await this.db.get(
      'SELECT olm_account FROM accounts WHERE as_identifier = ?;',
      [this.appID]
    );
    if (!row) {
        return null;
    }
    return row.olm_account;
  }

  public async getAccountOffset(): Promise<number> {
    const row = await this.db.get(
      'SELECT offset FROM accounts WHERE as_identifier = ?;',
      [this.appID]
    );
    if (!row) {
        return null;
    }
    return row.offset;
  }

  public async setAccountOffset(offset: number) {
    await this.db.run(
      'UPDATE accounts SET offset = ? WHERE as_identifier = ?;',
      offset.toString(),
      this.appID
    );
  }

  public async createSession(sid: string, olm: string) {
    let res = await this.db.run(
      'INSERT INTO sessions (as_identifier, with_identifier, olm_session) VALUES (?, ?, ?);',
      this.appID,
      sid,
      olm
    );
  }

  public async updateSession(sid: string, olm: string) {
    let row = await this.db.get('SELECT olm_session FROM sessions WHERE as_identifier = ? AND with_identifier = ?;', [this.appID, sid]);
    if (!row) {
      await this.createSession(sid, olm);
    } else {
        await this.db.run(
          'UPDATE sessions SET olm_session = ? WHERE as_identifier = ? AND with_identifier = ?;',
          [olm, this.appID, sid]
        );
    }
  }
  public async getSessionOlm(sid: string): Promise<string> {
    const row = await this.db.get(
      `SELECT olm_session FROM sessions WHERE as_identifier = "${this.appID}" AND with_identifier = "${sid}"`
    );
    if (!row) {
        return null;
    }
    return row.olm_session;
   }

   public async sessionExists(sid: string): Promise<boolean> {
    const result = await this.db.get(
      'SELECT olm_session FROM sessions WHERE as_identifier = ? AND with_identifier = ?;',
      this.appID, sid
    );

    return result !== undefined;
  }

  public sid(self_id:string, device: string): string {
    return `${self_id}:${device}`
  }

  private createDirectorySkel(storageFolder: string): void {
    try {
        if (!fs.existsSync(storageFolder)) {
            fs.mkdirSync(storageFolder, { recursive: true });
        }
    } catch (error) {
        throw new Error("Invalid directory");
    }
  }

  private async setPragmas() {
    await this.db.exec(`
      PRAGMA synchronous = NORMAL;
      PRAGMA journal_mode = WAL;
      PRAGMA temp_store = MEMORY;
    `)
  }
  private async createAccountsTable() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        as_identifier TEXT NOT NULL,
        offset INTEGER NOT NULL,
        olm_account BLOB NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_as_identifier
      ON accounts (as_identifier);
    `)
  }
  private async createSessionsTable() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        as_identifier TEXT NOT NULL,
        with_identifier TEXT NOT NULL,
        olm_session BLOB NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_with_identifier
      ON sessions (as_identifier, with_identifier);
`)
  }

}

interface Account {
  sessions?: string;
  offset?: string
  with?: string;
  account?: string;
}

class FileToSQLiteStorageMigrator {
  db: sqlite.Database
  basePath: string
  appID: string

  constructor(db, storageFolder, appID) {
    this.db = db
    this.basePath = `${storageFolder}/${appID.split(':')[0]}`
    this.appID = appID
  }

  async migrate() {
    // Skip if base path doesn't exist
    if (!fs.existsSync(this.basePath)) {
      return;
    }

    // Parse and persist the account information.
    const accounts = this.parseAccounts()
    await this.persistAccounts(accounts)

    // Depreciate the base path.
    fs.renameSync(`${this.basePath}`, `${this.basePath}-depreciated`);
  }

  private parseAccounts(): Map<string, Account> {
    const accounts = new Map();

    fs.readdirSync(this.basePath, { withFileTypes: true }).forEach((dirent) => {
        const filePath = `${this.basePath}/${dirent.name}`;

        if (dirent.isDirectory()) {
            return;
        }

        switch (path.extname(filePath)) {
            case ".offset":
                const fileName = path.basename(filePath, ".offset");
                const offset = Number(fs.readFileSync(filePath, { encoding: "utf8" }).slice(0, 19));

                if (!accounts.hasOwnProperty(fileName)) {
                    accounts[fileName] = {};
                }
                accounts[fileName].offset = offset;
                break;
            case ".pickle":
                const file_name = path.basename(filePath, ".pickle");
                const content = fs.readFileSync(filePath, { encoding: "utf8" });

                if (file_name === "account") {
                    if (!accounts.hasOwnProperty(this.appID)) {
                        accounts[this.appID] = {};
                    }
                    accounts[this.appID].account = content;
                } else {
                    if (accounts.hasOwnProperty(this.appID)) {
                        if (!accounts[this.appID].hasOwnProperty("sessions")) {
                            accounts[this.appID].sessions = [];
                        }
                        accounts[this.appID].sessions.push({
                            with: file_name.replace("-session", ""),
                            session: content,
                        });
                    } else {
                      if (!accounts.hasOwnProperty(this.appID)) {
                        accounts[this.appID] = {};
                      }
                      accounts[this.appID].account = content;
                    }
                }
        }
    });

    return accounts
  }


  private async persistAccounts(accounts: Map<string, Account>) {
    try {
      await this.db.exec('BEGIN TRANSACTION;'); //useTransaction = false

      for (const [inbox_id, account] of Object.entries(accounts)) {
        await this.db.run(
          'INSERT INTO accounts (as_identifier, offset, olm_account) VALUES (?, ?, ?)',
          inbox_id, account.offset, account.account
        );

        if (account.sessions) {
          for (const session of account.sessions) {
            await this.db.run(
              'INSERT INTO sessions (as_identifier, with_identifier, olm_session) VALUES (?, ?, ?)',
              inbox_id, session.with, session.session);
          }
        }
      }

      await this.db.exec('COMMIT TRANSACTION;'); //useTransaction = false
    } catch (e) {
      await this.db.exec('ROLLBACK TRANSACTION;'); //useTransaction = false
    }
  }

}
