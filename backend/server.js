const { server } = require('./app');
const connectDB = require('./config/db');
const ensureAdmin = require('./utils/ensureAdmin');

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  await ensureAdmin();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} with Socket.io`);
  });
})();