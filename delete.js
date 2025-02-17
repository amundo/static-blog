import { extract } from "jsr:@std/front-matter/any";

const output = `---
{
  "title": "Three dashes marks the spot"
}
---
Hello, world!`;
const result = extract(output);


console.log(result)

const output2 = `---
title: Three dashes marks the spot.
---
Hello, world!`;
const result2 = extract(output2);


console.log(result2)


const output3 = `---
title: Three dashes marks the spot.
tags: [
  {
    "x": "a"
  },
  {
    "x": "b"
  },
  {
    "x": "c"
  }
]
omg: [o, m, g]
---
Hello, world!`;
const result3 = extract(output3);


console.log(result3)
