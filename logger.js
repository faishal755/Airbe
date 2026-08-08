/**
 * Request Logger Middleware
 * Logs details about every incoming HTTP request and its corresponding response.
 */
const logger = (req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // 1. Log incoming request details
  console.log(`\n[${timestamp}] >>> [INCOMING REQUEST] ${req.method} ${req.originalUrl}`);

  if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
    console.log(`   Body:`, JSON.stringify(req.body, null, 2));
  }

  // 2. Set up a watchdog timer to detect hung/pending requests (e.g., 5 seconds)
  const pendingWarningTimeout = setTimeout(() => {
    console.warn(`\n⚠️[WARNING - REQUEST PENDING] ${req.method} ${req.originalUrl} has been pending for over 5 seconds.`);
    console.warn(`   Possible reasons for hang:`);
    console.warn(`   - The route handler did not call res.send(), res.json(), or res.end().`);
    console.warn(`   - An awaited asynchronous Promise (e.g. database query, await call) is unresolved or deadlocked.`);
    console.warn(`   - A middleware called before the route did not execute next() or return a response.`);
    console.warn(`   - Windows Loopback/DNS proxy issue (if Client claims it sent but Server hasn't received anything).`);
  }, 5000);

  // 3. Log response details once the response is fully sent
  res.on('finish', () => {
    clearTimeout(pendingWarningTimeout);
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] <<< [RESPONSE SENT] ${req.method} ${req.originalUrl} - Status: ${res.statusCode}(Duration: ${duration}ms)`);
  });

  res.on('close', () => {
    clearTimeout(pendingWarningTimeout);
  });

  next();
};

export default logger;