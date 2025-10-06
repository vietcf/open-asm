// Simple HTTP access logging middleware
function accessLog(req, res, next) {
  // Skip static files
  if (req.path.startsWith('/css/') || 
      req.path.startsWith('/js/') || 
      req.path.startsWith('/img/') || 
      req.path.startsWith('/vendor/') ||
      req.path === '/favicon.ico') {
    return next();
  }

  const startTime = Date.now();
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const user = req.session?.user?.username || 'anonymous';
  
  // Simple console log
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${ip} - ${user}`);

  // Log response time when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  });

  next();
}

export default accessLog;
