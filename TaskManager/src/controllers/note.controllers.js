import mongoose from "mongoose";
import { ProjectNote } from "../models/Note.models.js";
import { Project } from "../models/Project.models.js";
import { ApiError } from "../APIStatus/APIError.js";
import { APIResponse } from "../APIStatus/APIResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
// import { SocketManager } from "../sockets/SocketManager.js";
const getNotes = asyncHandler(async (req, res) => {
  // get all notes
  // get the projectId from the request.params
  const { projectId } = req.params;
  //try to find the project by projectId
  const project = await Project.findById(projectId);
 //If project not found show appropriate errors 
  if (!project) {
    throw new ApiError(404, "Project not found");
  }
  //try to get the projectNote 
  //based on projectId and populate "createdBy" and "username fullName avatar"
  const notes = await ProjectNote.find({
    project: new mongoose.Types.ObjectId(projectId),
  }).populate("createdBy", "username fullName avatar");
  // show notes fetched successfully
  return res
    .status(200)
    .json(new APIResponse(200, notes, "Notes fetched successfully"));
});
// create notes
const createNote = asyncHandler(async (req, res) => {
  // destructure projectId from request parameters 
  const { projectId } = req.params;
  // destructure content from req.body
  //{"content":"todo app"}
  const { content } = req.body;
 // find project by Id from db
  const project = await Project.findById(projectId);
// if project not found show appropriate error
  if (!project) {
    throw new ApiError(404, "Project not found");
  }
// create project on the basis of projectId , content  and created by  
  const note = await ProjectNote.create({
    project: new mongoose.Types.ObjectId(projectId),
    content,
    createdBy: new mongoose.Types.ObjectId(req.user._id),
  });

  // Populate the createdBy field before sending the response
  const populatedNote = await ProjectNote.findById(note._id).populate(
    "createdBy",
    "username fullName avatar",
  );

  // Emit real-time event to project room (best-effort)
  try {
    const socketManager = req.app?.locals?.socketManager;
    if (socketManager) {
      socketManager.emitToProject(
        projectId,
        "note:created",
        { note: populatedNote, projectId, createdBy: req.user._id },
        req.user._id,
      );
    }
  } catch (_) {}

  return res
    .status(201)
    .json(new APIResponse(201, populatedNote, "Note created successfully"));
});

const updateNote = asyncHandler(async (req, res) => {
  // destructure noteId from req.params
  const { noteId } = req.params;
  // destructure content from req.body
  const { content } = req.body;

  // Find the note first to check if it exists
  const existingNote = await ProjectNote.findById(noteId);
  //if note exists show appropriate error
  if (!existingNote) {
    throw new ApiError(404, "Note not found");
  }

  // Update the note and populate the createdBy field
  const note = await ProjectNote.findByIdAndUpdate(
    noteId,
    { content },
    { new: true },
  ).populate("createdBy", "username fullName avatar");

  // Emit real-time update (best-effort)
  try {
    const socketManager = req.app?.locals?.socketManager;
    if (socketManager) {
      socketManager.emitToProject(
        existingNote.project.toString(),
        "note:updated",
        { note, projectId: existingNote.project.toString(), updatedBy: req.user._id },
        req.user._id,
      );
    }
  } catch (_) {}

  return res
    .status(200)
    .json(new APIResponse(200, note, "Note updated successfully"));
});

const deleteNote = asyncHandler(async (req, res) => {
  //destructure the noteId  from the request params
  const { noteId } = req.params;
  // delete on the basis of noteId
  const note = await ProjectNote.findByIdAndDelete(noteId);
// if note is not found show error message
  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  // Emit real-time deletion (best-effort)
  try {
    const socketManager = req.app?.locals?.socketManager;
    if (socketManager && note?.project) {
      socketManager.emitToProject(
        note.project.toString(),
        "note:deleted",
        { noteId: noteId, projectId: note.project.toString(), deletedBy: req.user._id },
        req.user._id,
      );
    }
  } catch (_) {}
 // success message
  return res
    .status(200)
    .json(new APIResponse(200, note, "Note deleted successfully"));
});

const getNoteById = asyncHandler(async (req, res) => {
  // destructure the noteId from req.params
  const { noteId } = req.params;
 // find note from db with the help of noteId , populate with "createdBy" and "username fullName
 // avatar"
  const note = await ProjectNote.findById(noteId).populate(
    "createdBy",
    "username fullName avatar",
  );
//  if note not found , give correct message 
  if (!note) {
    throw new ApiError(404, "Note not found");
  }
 // for success show appropriate APIresponse
  return res
    .status(200)
    .json(new APIResponse(200, note, "Note fetched successfully"));
});

export { createNote, deleteNote, getNoteById, getNotes, updateNote };
