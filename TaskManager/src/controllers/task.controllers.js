import mongoose from "mongoose";
import { Project } from "../models/Project.models.js";
import { Subtask } from "../models/Subtask.models.js";
import { Task } from "../models/Task.models.js";
import { ApiError } from "../APIStatus/APIError.js";
import { APIResponse } from "../APIStatus/APIResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { UserRolesEnum } from "../constants/constants.js";

const getTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }
  const tasks = await Task.find({
    project: new mongoose.Types.ObjectId(projectId),
  }).populate("assignedTo", "username fullName avatar");

  return res
    .status(200)
    .json(new APIResponse(200, tasks, "Tasks fetched successfully"));
});

const createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, status } = req.body;
  const { projectId } = req.params;
  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  // Ensure req.files is an array or empty array if undefined
  const files = req.files || [];

  const attachments = files.map((file) => {
    return {
      url: `${process.env.SERVER_URL}/images/${file.originalname}`,
      mimetype: file.mimetype,
      size: file.size,
    };
  });

  const task = await Task.create({
    title,
    description,
    project: new mongoose.Types.ObjectId(projectId),
    assignedTo: assignedTo
      ? new mongoose.Types.ObjectId(assignedTo)
      : undefined,
    status,
    assignedBy: new mongoose.Types.ObjectId(req.user._id),
    attachments,
  });

  return res
    .status(201)
    .json(new APIResponse(201, task, "Task created successfully"));
});

const getTaskById = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const task = await Task.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(taskId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "assignedTo",
        foreignField: "_id",
        as: "assignedTo",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "subtasks",
        localField: "_id",
        foreignField: "task",
        as: "subtasks",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "createdBy",
              foreignField: "_id",
              as: "createdBy",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              createdBy: {
                $arrayElemAt: ["$createdBy", 0],
              },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        assignedTo: {
          $arrayElemAt: ["$assignedTo", 0],
        },
      },
    },
  ]);

  if (!task || task.length === 0) {
    throw new ApiError(404, "Task not found");
  }

  return res
    .status(200)
    .json(new APIResponse(200, task[0], "Task fetched successfully"));
});

const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title, description, status, assignedTo } = req.body;

  console.log("Update task request body:", req.body);

  const existingTask = await Task.findById(taskId);

  if (!existingTask) {
    throw new ApiError(404, "Task not found");
  }

  // Get existing attachments
  const existingAttachments = existingTask.attachments || [];

  // Ensure req.files is an array or empty array if undefined
  const files = req.files || [];

  // Create new attachments array from uploaded files
  const newAttachments = files.map((file) => {
    return {
      url: `${process.env.SERVER_URL}/images/${file.originalname}`,
      mimetype: file.mimetype,
      size: file.size,
    };
  });

  // Combine existing and new attachments
  const allAttachments = [...existingAttachments, ...newAttachments];

  // Create update object with only the fields that are provided
  const updateFields = {
    attachments: allAttachments,
    assignedBy: new mongoose.Types.ObjectId(req.user._id),
  };

  // Only update fields that are provided in the request
  if (title !== undefined) updateFields.title = title;
  if (description !== undefined) updateFields.description = description;
  if (status !== undefined) updateFields.status = status;

  // Handle assignedTo field carefully
  if (assignedTo !== undefined) {
    updateFields.assignedTo = assignedTo
      ? new mongoose.Types.ObjectId(assignedTo)
      : undefined;
  } else if (existingTask.assignedTo) {
    // Keep the existing assignedTo if not provided in the request
    updateFields.assignedTo = existingTask.assignedTo;
  }

  console.log("Update fields:", updateFields);

  // Update the task and populate the assignedTo field in the response
  const task = await Task.findByIdAndUpdate(taskId, updateFields, {
    new: true,
  }).populate("assignedTo", "username fullName avatar");

  console.log("Updated task:", task);

  return res
    .status(200)
    .json(new APIResponse(200, task, "Task updated successfully"));
});

const deleteTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const task = await Task.findByIdAndDelete(taskId);

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return res
    .status(200)
    .json(new APIResponse(200, task, "Task deleted successfully"));
});

const createSubTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title } = req.body;

  if (!title) {
    throw new ApiError(400, "Title is required");
  }

  const task = await Task.findById(taskId);

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const subTask = await Subtask.create({
    title,
    task: new mongoose.Types.ObjectId(taskId),
    createdBy: new mongoose.Types.ObjectId(req.user._id),
  });

  return res
    .status(201)
    .json(new APIResponse(201, subTask, "Sub task created successfully"));
});

const updateSubTask = asyncHandler(async (req, res) => {
  const { subTaskId } = req.params;
  const { title, isCompleted } = req.body;

  let subTask = await Subtask.findById(subTaskId);

  if (!subTask) {
    throw new ApiError(404, "Sub task not found");
  }

  subTask = await Subtask.findByIdAndUpdate(
    subTaskId,
    {
      title: [UserRolesEnum.ADMIN, UserRolesEnum.PROJECT_ADMIN].includes(
        req?.user?.role,
      )
        ? title
        : undefined, // only allow admins and project admins to update the title
      isCompleted,
    },
    { new: true },
  );

  return res
    .status(200)
    .json(new APIResponse(200, subTask, "Sub task updated successfully"));
});

const deleteSubTask = asyncHandler(async (req, res) => {
  const { subTaskId } = req.params;
  const subTask = await Subtask.findByIdAndDelete(subTaskId);

  if (!subTask) {
    throw new ApiError(404, "Sub task not found");
  }

  return res
    .status(200)
    .json(new APIResponse(200, subTask, "Sub task deleted successfully"));
});

export {
  createSubTask,
  createTask,
  deleteSubTask,
  deleteTask,
  getTaskById,
  getTasks,
  updateSubTask,
  updateTask,
};
