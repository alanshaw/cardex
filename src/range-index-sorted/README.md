# Format

```
varint codec
uint32 number of multihash codecs
    (for each)
    uint64 multihash codec
    uint32 number of "width" groups
        (for each)
        uint32 group "width"
        uint64 group length
            (for each)
            digest
            uint64 offset
            uint64 bytes offset
            uint64 bytes length
```