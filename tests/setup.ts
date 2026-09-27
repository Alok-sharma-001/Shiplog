// Ensure WebSocket is available in happy-dom test environment
if (typeof globalThis.WebSocket === 'undefined') {
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = 1;
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  }
  globalThis.WebSocket = MockWebSocket as any;
}
