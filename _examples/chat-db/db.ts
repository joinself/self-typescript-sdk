var Client = require('pg-native')

export default class DBStore {
  client: any

  public static build() {

    const client = new Client();
    client.connectSync(process.env.PG_URI);


    let createTableQuery = `
      CREATE TABLE IF NOT EXISTS selfsdk(
        path varchar PRIMARY KEY NOT NULL ,
        val text,
        date TIMESTAMP NOT NULL DEFAULT current_timestamp
      );
    `;
    const res = client.querySync(createTableQuery);

    let db = new DBStore()
    db.client = client

    return db
  }

  public write(path:string, value:string, opts={ flag: 'w' }) {
    let insertRow = this.client.querySync(`
      INSERT INTO selfsdk(path, val)
      VALUES($1, $2)
      ON CONFLICT (path)
        DO
      UPDATE SET val = $2;
    `, [`${path}`,`${value}`]);
  }

  public read(path:string):string|null {
    const entries = this.client.querySync('SELECT * FROM selfsdk WHERE path = $1;', [path]);
    if (entries.length == 0) {
      return null
    }

    return entries[0].val
  }

  public exists(path: string): boolean {
    return null != this.read(path)
  }
}
