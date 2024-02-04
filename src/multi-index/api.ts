import { Await, CARLink, ReaderState, IndexReader, Unit } from '../api.js'
import { Reader } from '../reader/api.js'
import { Writer } from '../writer/api.js'

export interface MultiIndexReaderState extends ReaderState {
  started: boolean
  carsCount: number
  carIndex: number
  car: CARLink | null
  index: IndexReader<ReaderState, Unit> | null
  done: boolean
  indexReaders: Map<number, IndexReaderFactory<ReaderState, Unit>>
}

export interface WriterReceiver {
  (view: { writer: Writer<Uint8Array> }): Await<void>
}

export interface MultiIndexWriterState {
  builders: Array<{ cid: CARLink, builder: WriterReceiver }>
}

export interface MultiIndexItem {
  origin: CARLink
}

export interface IndexReaderFactory<S extends ReaderState, V extends Unit> {
  codec: number
  createReader (config: { reader: Reader<Uint8Array>, state?: S }): IndexReader<S, V>
}
