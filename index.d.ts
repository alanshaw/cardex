import type { CID } from 'multiformats'

export interface BlockIndexData {
  cid: CID
  offset: number
}

export interface IndexEntry {
  digest: Uint8Array
  offset: number
}

export interface IndexWriter {
  put (b: BlockIndexData): Promise<void>
  close (): Promise<void>
}

export interface IndexReader {
  entries (): AsyncIterable<IndexEntry>
}

export interface BytesReader {
  upTo (length: number): Promise<Uint8Array>
  exactly (length: number): Promise<Uint8Array>
  seek (length: number): void
  pos: number
}

export interface BytesWriter {
  write (d: Uint8Array): Promise<void>
  end (): Promise<void>
}

export interface IteratorChannel_Writer<T> {
  write (chunk: T): Promise<void>
  end (): Promise<void>
}

export interface IteratorChannel<T> {
  writer: IteratorChannel_Writer<T>
  iterator: AsyncIterator<T>
}
