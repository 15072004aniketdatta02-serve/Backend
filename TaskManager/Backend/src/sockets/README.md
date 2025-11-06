# Socket Manager

A production-ready WebSocket manager for real-time communication in the TaskManager application.

## Features

- ✅ **OOP Design**: Clean class-based architecture with separation of concerns
- ✅ **Authentication**: JWT-based authentication for socket connections
- ✅ **Room Management**: Automatic project and user room management
- ✅ **Event Handling**: Comprehensive event handlers for tasks, projects, and notes
- ✅ **Connection Tracking**: Track connected users and their socket connections
- ✅ **Error Handling**: Robust error handling with logging
- ✅ **Graceful Shutdown**: Proper cleanup on server shutdown

## Installation

Make sure `socket.io` is installed:

```bash
npm install socket.io
```

## Architecture

### Classes

1. **SocketManager**: Main class that manages all socket connections
2. **SocketAuthentication**: Handles JWT authentication for socket connections
3. **SocketEventHandlers**: Handles business logic for socket events

## Usage

### Server Setup

The socket manager is already integrated in `src/index.js`. It automatically:
- Creates an HTTP server
- Initializes Socket.IO
- Sets up authentication middleware
- Registers event handlers

### Client-Side Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:9000', {
  auth: {
    token: 'your-jwt-access-token'
  },
  transports: ['websocket', 'polling']
});

// Connection events
socket.on('connected', (data) => {
  console.log('Connected:', data);
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

### Joining Project Rooms

```javascript
// Join a project room
socket.emit('join:project', { projectId: 'project-id-here' });

socket.on('joined:project', (data) => {
  console.log('Joined project:', data);
});

// Leave a project room
socket.emit('leave:project', { projectId: 'project-id-here' });
```

### Listening to Events

```javascript
// Task events
socket.on('task:created', (data) => {
  console.log('Task created:', data);
});

socket.on('task:updated', (data) => {
  console.log('Task updated:', data);
});

socket.on('task:deleted', (data) => {
  console.log('Task deleted:', data);
});

// Project events
socket.on('project:updated', (data) => {
  console.log('Project updated:', data);
});

// User presence
socket.on('user:joined', (data) => {
  console.log('User joined project:', data);
});

socket.on('user:left', (data) => {
  console.log('User left project:', data);
});

// Typing indicators
socket.on('typing:start', (data) => {
  console.log('User is typing:', data);
});

socket.on('typing:stop', (data) => {
  console.log('User stopped typing:', data);
});
```

### Emitting Events

```javascript
// Notify task creation
socket.emit('task:created', {
  projectId: 'project-id',
  task: { /* task object */ }
});

// Notify task update
socket.emit('task:updated', {
  projectId: 'project-id',
  task: { /* updated task object */ }
});

// Typing indicators
socket.emit('typing:start', { projectId: 'project-id' });
socket.emit('typing:stop', { projectId: 'project-id' });
```

## Server-Side Usage (Controllers)

### Accessing Socket Manager in Controllers

```javascript
// In your controller
export const createTask = async (req, res) => {
  try {
    // ... create task logic ...
    const task = await Task.create(taskData);

    // Get socket manager from app.locals
    const socketManager = req.app.locals.socketManager;

    // Emit to all users in the project
    socketManager.emitToProject(
      task.project.toString(),
      'task:created',
      {
        task,
        createdBy: req.user._id.toString(),
        timestamp: new Date().toISOString(),
      },
      req.user._id.toString() // Exclude the creator
    );

    res.status(201).json(new ApiResponse(201, task, 'Task created'));
  } catch (error) {
    // ... error handling ...
  }
};
```

### Available Methods

#### `emitToUser(userId, event, data)`
Emits an event to a specific user.

```javascript
socketManager.emitToUser(userId, 'notification', {
  message: 'You have a new task',
  type: 'task_assignment'
});
```

#### `emitToProject(projectId, event, data, excludeUserId)`
Emits an event to all users in a project room.

```javascript
socketManager.emitToProject(
  projectId,
  'task:updated',
  { task, updatedBy: userId },
  userId // Optional: exclude this user
);
```

#### `emitToAll(event, data)`
Emits an event to all connected users.

```javascript
socketManager.emitToAll('system:maintenance', {
  message: 'System maintenance in 5 minutes'
});
```

#### `isUserConnected(userId)`
Checks if a user is currently connected.

```javascript
if (socketManager.isUserConnected(userId)) {
  // Send real-time notification
} else {
  // Send email notification instead
}
```

#### `getConnectedUsersCount()`
Gets the number of unique connected users.

#### `getTotalConnections()`
Gets the total number of socket connections.

## Events Reference

### Client → Server Events

- `join:project` - Join a project room
- `leave:project` - Leave a project room
- `task:created` - Notify task creation
- `task:updated` - Notify task update
- `task:deleted` - Notify task deletion
- `project:created` - Notify project creation
- `project:updated` - Notify project update
- `note:created` - Notify note creation
- `typing:start` - Start typing indicator
- `typing:stop` - Stop typing indicator
- `ping` - Health check

### Server → Client Events

- `connected` - Connection established
- `joined:project` - Successfully joined project room
- `left:project` - Left project room
- `task:created` - Task created notification
- `task:updated` - Task updated notification
- `task:deleted` - Task deleted notification
- `project:updated` - Project updated notification
- `note:created` - Note created notification
- `user:joined` - User joined project room
- `user:left` - User left project room
- `typing:start` - User started typing
- `typing:stop` - User stopped typing
- `pong` - Response to ping
- `error` - Error occurred

## Security

- All connections require valid JWT authentication
- Project room access is verified against database
- Sensitive data is properly handled
- CORS is configured based on environment variables

## Error Handling

All errors are logged using the logger system. Client errors are emitted via the `error` event.

## Best Practices

1. **Always verify permissions** before emitting events
2. **Use rooms** for project-specific events instead of broadcasting to all
3. **Handle disconnections** gracefully on the client side
4. **Use typing indicators** sparingly to avoid spam
5. **Exclude the event originator** when broadcasting to avoid duplicate notifications

