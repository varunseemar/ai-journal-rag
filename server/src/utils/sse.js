// Server-Sent Events: keep the HTTP response open and write `event:` / `data:` blocks to it.
// One-way (server -> browser) is all the chat needs, and it is plain HTTP, so no extra library.
export function openSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Stops reverse proxies (nginx, Render) from buffering the stream.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  return {
    send(event, data) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      if (!res.writableEnded) res.end();
    },
  };
}
