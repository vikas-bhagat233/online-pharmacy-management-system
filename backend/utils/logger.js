exports.log = (message, level = 'info') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
};

exports.error = (error) => {
  console.error(`[${new Date().toISOString()}] ERROR:`, error);
};