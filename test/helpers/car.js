import { sha256 } from 'multiformats/hashes/sha2'
import { CID } from 'multiformats/cid'

/** @param {Uint8Array} bytes */
export const createCID = async bytes => CID.createV1(0x0202, await sha256.digest(bytes))
