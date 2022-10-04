import * as fs from 'fs'

export interface IOManager {
  write(path:string, value:string, opts?)
  read(path:string): string
  exists(path: string): boolean
}

export default class FsStore {
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
