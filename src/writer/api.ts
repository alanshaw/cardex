import { Await } from '../api.js'

export interface Writable<T> {
  readonly locked: boolean
  getWriter(): Writer<T>
}

export interface Writer<T> {
  readonly desiredSize: number | null
  releaseLock(): void
  ready: Await<void>

  write(data: T): Await<void>

  close(): Await<void>

  abort(reason: Error): Await<void>
}
