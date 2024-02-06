import { Link } from 'multiformats/link'
import { Writer } from './writer/api.js'
import { Reader, ReadResult } from './reader/api.js'

export type Unit = {}
export type CARLink = Link<Uint8Array, 0x0202>

export type MultihashCodec = number
export type DigestLength = number

export type Await<T> = T | PromiseLike<T>

export interface ReaderState {
  bytesReader: BytesReaderState
}

export interface BytesReaderState {
  pos: number
  have: number
  offset: number
  currentChunk: Uint8Array
}

export interface CloseOptions {
  releaseLock?: boolean
  closeWriter?: boolean
}

export interface IndexWriter<S, V extends Unit> {
  writer: Writer<Uint8Array>
  state: S
  add (item: V): Await<IndexWriter<S, V>>
  close (options?: CloseOptions): Await<void>
}

export interface IndexReader<S extends ReaderState, V extends Unit> {
  reader: Reader<Uint8Array>
  state: S
  read (): Await<ReadResult<V>>
  cancel (reason?: any): Await<void>
}
