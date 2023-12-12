import { Await } from '../api.js'

export interface Readable<T> {
  getReader(): Reader<T>
}

export interface ReadDoneResult<T> {
  done: true
  value?: T
}

export interface ReadValueResult<T> {
  done: false
  value: T
}

export type ReadResult<T> = ReadValueResult<T> | ReadDoneResult<T>

export interface Reader<T> {
  read(): Await<ReadResult<T>>
  releaseLock(): void
  cancel(reason?: any): Await<void>
}
