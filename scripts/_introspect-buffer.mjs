const res = await fetch('https://api.buffer.com/mcp/graphql', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.BUFFER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: `{
      __type(name: "CreatePostInput") {
        inputFields { name type { kind name ofType { name kind } } }
      }
      __schema {
        mutationType { fields { name } }
      }
    }`,
  }),
})
console.log('status', res.status, 'retry-after', res.headers.get('retry-after'))
console.log(await res.text())
