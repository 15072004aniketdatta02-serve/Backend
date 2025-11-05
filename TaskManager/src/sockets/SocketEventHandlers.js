import { ApiError } from '../APIStatus/APIError.js';
import { ProjectMember } from '../models/Projectmember.model.js';
import mongoose from 'mongoose';

/**
 * Socket Event Handlers - Handles socket events and business logic
 */
export class SocketEventHandlers {
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Handles joining a project room
   */
  async handleJoinProject(socket, data) {
    try {
      const { projectId } = data;
      const { userId } = socket.data;

      if (!projectId) {
        socket.emit('error', { message: 'Project ID is required' });
        return;
      }

      // Verify user has access to the project
      const projectMember = await ProjectMember.findOne({
        project: new mongoose.Types.ObjectId(projectId),
        user: new mongoose.Types.ObjectId(userId),
      });

      if (!projectMember) {
        socket.emit('error', {
          message: 'You do not have access to this project',
        });
        return;
      }

      // Join project room
      const room = `project:${projectId}`;
      await socket.join(room);

      this.#logger?.info('User joined project room', {
        socketId: socket.id,
        userId,
        projectId,
        room,
      });

      socket.emit('joined:project', {
        projectId,
        message: 'Successfully joined project room',
      });

      // Notify others in the project
      socket.to(room).emit('user:joined', {
        userId,
        projectId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.#logger?.error('Error joining project room', {
        socketId: socket.id,
        error: error.message,
      });
      socket.emit('error', { message: 'Failed to join project room' });
    }
  }

  /**
   * Handles leaving a project room
   */
  async handleLeaveProject(socket, data) {
    try {
      const { projectId } = data;
      const { userId } = socket.data;

      if (!projectId) {
        return;
      }

      const room = `project:${projectId}`;
      await socket.leave(room);

      this.#logger?.info('User left project room', {
        socketId: socket.id,
        userId,
        projectId,
      });

      socket.emit('left:project', { projectId });

      // Notify others in the project
      socket.to(room).emit('user:left', {
        userId,
        projectId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.#logger?.error('Error leaving project room', {
        socketId: socket.id,
        error: error.message,
      });
    }
  }

  /**
   * Handles task created event
   */
  async handleTaskCreated(socket, data) {
    try {
      const { projectId, task } = data;
      const { userId } = socket.data;

      if (!projectId || !task) {
        socket.emit('error', { message: 'Invalid task data' });
        return;
      }

      // Verify user has access
      const projectMember = await ProjectMember.findOne({
        project: new mongoose.Types.ObjectId(projectId),
        user: new mongoose.Types.ObjectId(userId),
      });

      if (!projectMember) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      const room = `project:${projectId}`;
      socket.to(room).emit('task:created', {
        task,
        createdBy: userId,
        timestamp: new Date().toISOString(),
      });

      this.#logger?.info('Task created event', {
        socketId: socket.id,
        userId,
        projectId,
        taskId: task._id,
      });
    } catch (error) {
      this.#logger?.error('Error handling task created', {
        socketId: socket.id,
        error: error.message,
      });
      socket.emit('error', { message: 'Failed to broadcast task creation' });
    }
  }

  /**
   * Handles task updated event
   */
  async handleTaskUpdated(socket, data) {
    try {
      const { projectId, task } = data;
      const { userId } = socket.data;

      if (!projectId || !task) {
        return;
      }

      const projectMember = await ProjectMember.findOne({
        project: new mongoose.Types.ObjectId(projectId),
        user: new mongoose.Types.ObjectId(userId),
      });

      if (!projectMember) {
        return;
      }

      const room = `project:${projectId}`;
      socket.to(room).emit('task:updated', {
        task,
        updatedBy: userId,
        timestamp: new Date().toISOString(),
      });

      this.#logger?.debug('Task updated event', {
        socketId: socket.id,
        userId,
        projectId,
        taskId: task._id,
      });
    } catch (error) {
      this.#logger?.error('Error handling task updated', {
        socketId: socket.id,
        error: error.message,
      });
    }
  }

  /**
   * Handles task deleted event
   */
  async handleTaskDeleted(socket, data) {
    try {
      const { projectId, taskId } = data;
      const { userId } = socket.data;

      if (!projectId || !taskId) {
        return;
      }

      const projectMember = await ProjectMember.findOne({
        project: new mongoose.Types.ObjectId(projectId),
        user: new mongoose.Types.ObjectId(userId),
      });

      if (!projectMember) {
        return;
      }

      const room = `project:${projectId}`;
      socket.to(room).emit('task:deleted', {
        taskId,
        deletedBy: userId,
        timestamp: new Date().toISOString(),
      });

      this.#logger?.info('Task deleted event', {
        socketId: socket.id,
        userId,
        projectId,
        taskId,
      });
    } catch (error) {
      this.#logger?.error('Error handling task deleted', {
        socketId: socket.id,
        error: error.message,
      });
    }
  }

  /**
   * Handles project created event
   */
  async handleProjectCreated(socket, data) {
    try {
      const { project } = data;
      const { userId } = socket.data;

      if (!project) {
        return;
      }

      // Notify the creator
      socket.emit('project:created', {
        project,
        timestamp: new Date().toISOString(),
      });

      this.#logger?.info('Project created event', {
        socketId: socket.id,
        userId,
        projectId: project._id,
      });
    } catch (error) {
      this.#logger?.error('Error handling project created', {
        socketId: socket.id,
        error: error.message,
      });
    }
  }

  /**
   * Handles project updated event
   */
  async handleProjectUpdated(socket, data) {
    try {
      const { projectId, project } = data;
      const { userId } = socket.data;

      if (!projectId || !project) {
        return;
      }

      const projectMember = await ProjectMember.findOne({
        project: new mongoose.Types.ObjectId(projectId),
        user: new mongoose.Types.ObjectId(userId),
      });

      if (!projectMember) {
        return;
      }

      const room = `project:${projectId}`;
      socket.to(room).emit('project:updated', {
        project,
        updatedBy: userId,
        timestamp: new Date().toISOString(),
      });

      this.#logger?.debug('Project updated event', {
        socketId: socket.id,
        userId,
        projectId,
      });
    } catch (error) {
      this.#logger?.error('Error handling project updated', {
        socketId: socket.id,
        error: error.message,
      });
    }
  }

  /**
   * Handles note created event
   */
  async handleNoteCreated(socket, data) {
    try {
      const { projectId, note } = data;
      const { userId } = socket.data;

      if (!projectId || !note) {
        return;
      }

      const projectMember = await ProjectMember.findOne({
        project: new mongoose.Types.ObjectId(projectId),
        user: new mongoose.Types.ObjectId(userId),
      });

      if (!projectMember) {
        return;
      }

      const room = `project:${projectId}`;
      socket.to(room).emit('note:created', {
        note,
        createdBy: userId,
        timestamp: new Date().toISOString(),
      });

      this.#logger?.debug('Note created event', {
        socketId: socket.id,
        userId,
        projectId,
        noteId: note._id,
      });
    } catch (error) {
      this.#logger?.error('Error handling note created', {
        socketId: socket.id,
        error: error.message,
      });
    }
  }

  /**
   * Handles typing start event
   */
  async handleTypingStart(socket, data) {
    try {
      const { projectId } = data;
      const { userId } = socket.data;

      if (!projectId) {
        return;
      }

      const room = `project:${projectId}`;
      socket.to(room).emit('typing:start', {
        userId,
        projectId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.#logger?.error('Error handling typing start', {
        socketId: socket.id,
        error: error.message,
      });
    }
  }

  /**
   * Handles typing stop event
   */
  async handleTypingStop(socket, data) {
    try {
      const { projectId } = data;
      const { userId } = socket.data;

      if (!projectId) {
        return;
      }

      const room = `project:${projectId}`;
      socket.to(room).emit('typing:stop', {
        userId,
        projectId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.#logger?.error('Error handling typing stop', {
        socketId: socket.id,
        error: error.message,
      });
    }
  }
}

