import { Router } from "express";
import {
  createNote,
  deleteNote,
  getNoteById,
  getNotes,
  updateNote,
} from "../controllers/note.controllers.js";
import {
  validateProjectPermission,
  verifyJWT,
} from "../middlewares/auth.middlewares.js";
import { validate } from "../middlewares/validator.middlewares.js";
import { AvailableUserRoles, UserRolesEnum } from "../constants/constants.js";
import { notesValidator } from "../validators/index.js";

const router = Router();

router.use(verifyJWT);

router
  .route("/:projectId")
  .get(validateProjectPermission(AvailableUserRoles), getNotes)
  .post(
    validateProjectPermission([UserRolesEnum.ADMIN]),
    notesValidator(),
    validate,
    createNote,
  );

router
  .route("/:projectId/n/:noteId")
  .get(validateProjectPermission(AvailableUserRoles), getNoteById)
  .put(
    validateProjectPermission([UserRolesEnum.ADMIN]),
    notesValidator(),
    validate,
    updateNote,
  )
  .delete(validateProjectPermission([UserRolesEnum.ADMIN]), deleteNote);

export default router;
//file-uploader: app.post('/upload', function(req,res){console.log(req.files.foo);})
