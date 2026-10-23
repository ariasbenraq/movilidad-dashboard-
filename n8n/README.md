# n8n parser

Pure CommonJS parser for the plain-text body of the Google Forms
`FORMULARIO GASTOS DE MOVILIDAD` receipt email. It has no dependencies and does
no I/O, so `parser.js` can be pasted unchanged into an n8n Code node.

## Run the tests

```bash
cd n8n
npm test
```

The tests read the valid `NN-*.txt` + `NN-*.expected.json` pairs directly from
`../fixtures` and also cover synthetic edge cases in code.

`costo_movilidad` and `otros_gastos` are always numbers: a label that is absent
or present but empty becomes `0`. Non-numeric amount content throws
`INVALID_AMOUNT`. Blank or incomplete overtime times become `null`.

## Use in an n8n Code node

Paste the full contents of `parser.js` into the Code node, then call
`parseMovilidad` with the incoming plain-text body. This snippet is
illustrative only; the real workflow is a later task.

```js
// Illustrative Code node snippet.
const body = $input.first().json.body;

try {
  return [{ json: parseMovilidad(body) }];
} catch (error) {
  return [
    {
      json: {
        parse_error: true,
        code: error.code || 'UNKNOWN',
        message: error.message,
      },
    },
  ];
}
```
