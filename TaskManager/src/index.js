import app from './app.js';
import dotenv from 'dotenv';
import connectDB from './db/index.js';
import http from 'http';
import { SocketManager } from './sockets/index.js';
import { Logger } from './logger/logger.js';

dotenv.config({
    path:"./.env"
});

const PORT = process.env.PORT || 9000;
const logger = new Logger('server', 'server.log');

connectDB().then(()=>{
    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket Manager
    const socketManager = new SocketManager({
        server,
        cors: {
            origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
            credentials: true,
        },
        logger: new Logger('socket', 'socket.log'),
    });

    // Make socketManager available globally (optional, for use in controllers)
    app.locals.socketManager = socketManager;

    // Start server
    server.listen(PORT, () => {
        logger.info(`Server is running on port ${PORT}`, {
            port: PORT,
            environment: process.env.NODE_ENV || 'development',
        });
    });

    // Handle server errors
    server.on('error', (error) => {
        logger.error('Server error', { error: error.message });
        process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        logger.info('SIGTERM signal received: closing HTTP server');
        server.close(() => {
            logger.info('HTTP server closed');
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        logger.info('SIGINT signal received: closing HTTP server');
        server.close(() => {
            logger.info('HTTP server closed');
            process.exit(0);
        });
    });
}).catch((err)=>{
    logger.error('MongoDB connection error', { error: err.message });
    process.exit(1);
});