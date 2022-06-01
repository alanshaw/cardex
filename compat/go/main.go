package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/ipld/go-car/v2"
	"github.com/ipld/go-car/v2/index"
	"github.com/multiformats/go-multicodec"
)

func main() {
	var idxFmt string
	flag.StringVar(&idxFmt, "format", "MultihashIndexSorted", "Index format to use: \"IndexSorted\" or \"MultihashIndexSorted\"")
	flag.StringVar(&idxFmt, "f", "MultihashIndexSorted", "Index format to use: \"IndexSorted\" or \"MultihashIndexSorted\"")
	var outPath string
	flag.StringVar(&outPath, "output", "", "Output path.")
	flag.StringVar(&outPath, "o", "", "Output path.")
	flag.Parse()
	carPath := flag.Arg(0)

	if carPath == "" {
		panic("missing CAR path argument")
	}

	fmtCodec := multicodec.CarMultihashIndexSorted
	if idxFmt == "IndexSorted" {
		fmtCodec = multicodec.CarIndexSorted
	}
	fmt.Printf("Generating index in %s (%d) format...\n", idxFmt, fmtCodec)

	if outPath == "" {
		outPath = carPath + ".idx"
	}

	in, err := os.Open(carPath)
	if err != nil {
		panic(err)
	}
	defer in.Close()

	idx, err := car.GenerateIndex(in, car.UseIndexCodec(fmtCodec))
	if err != nil {
		panic(err)
	}

	out, err := os.OpenFile(outPath, os.O_RDWR|os.O_CREATE, 0755)
	if err != nil {
		panic(err)
	}
	defer out.Close()

	_, err = index.WriteTo(idx, out)
	if err != nil {
		panic(err)
	}
}
