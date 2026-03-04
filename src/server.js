const app = require('./app');
const dotenv = require('dotenv');
const http = require('http');
const socket = require('./utils/socket');

dotenv.config();

const server = http.createServer(app);
const io = socket.init(server);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});
