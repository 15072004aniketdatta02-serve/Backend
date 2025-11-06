import jwt from "jsonwebtoken";
import { User } from "../models/User.models.js";
import { ApiError } from "../APIStatus/APIError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ProjectMember } from "../models/Projectmember.model.js";
import mongoose from "mongoose";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  //get the token from cookies or request Header "Authorization"which if present , replace with "Bearer",""
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");
//if token is not found , throw API error with message "unauthorized request" 
  if (!token) {
    throw new ApiError(401, "Unauthorized request");
  }
  // try to find the ACCESS_TOKEN in db and then do further work
  try {
    // try to get the jwt verified decoded token of ACCESS_TOKEN_SECRET
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    // search User on the basis of decoded Access Token and select Password , RefreshToken , emailVerificationToken emailVerificationExpiry
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
    );
    // if user is not found on the basis of access token throw error
    if (!user) {
      // Client should make a request to /api/v1/users/refresh-token if they have refreshToken present in their cookie
      // Then they will get a new access token which will allow them to refresh the access token without logging out the user
      throw new ApiError(401, "Invalid access token");
    }
    //if the user's token on the basis of token present in cookies or Authorization header of request is found
    //store the user in request's user
    req.user = user;
    next();
    //move to the next part
  } catch (error) {
    // Client should make a request to /api/v1/users/refresh-token if they have refreshToken present in their cookie
    // Then they will get a new access token which will allow them to refresh the access token without logging out the user
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});

/**
 *
 * @description Middleware to check logged in users for unprotected routes. The function will set the logged in user to the request object and, if no user is logged in, it will silently fail.
 *
 * `NOTE: THIS MIDDLEWARE IS ONLY TO BE USED FOR UNPROTECTED ROUTES IN WHICH THE LOGGED IN USER'S INFORMATION IS NEEDED`
 */
export const getLoggedInUserOrIgnore = asyncHandler(async (req, res, next) => {
  //obtain the access token
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");
// db operation
  try {
    //try to obtain the decodedToken from the Access Token
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    // on the basis of decoded access token select the password refreshToken -emailVerificationToken
    //-emailVerificationExpiry and store that in user  
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
    );
    //the user rquesting is the same user whose access token secret 
    // is present in cookies or request header's "Authorization" "Bearer"
    req.user = user;
    next();
  } catch (error) {
    // Fail silently with req.user being falsy
    next();
  }
});

export const validateProjectPermission = (roles = []) =>
  asyncHandler(async (req, res, next) => {
    //obtain the project id from the request parameters
    const { projectId } = req.params;
  // if projectId not found throw error
    if (!projectId) {
      throw new ApiError(400, "Project id is missing");
    }
    //if the project id is found find the projectMember with the help of project id and user id
    const project = await ProjectMember.findOne({
      project: new mongoose.Types.ObjectId(projectId),
      user: new mongoose.Types.ObjectId(req.user._id),
    });
// if project is not found show appropriate error
    if (!project) {
      throw new ApiError(404, "Project not found");
    }
// store the project role of the user in given role
    const givenRole = project?.role;
// assign the role of the user in the request to thr givenRole 
    req.user.role = givenRole;
// if the roles of the user does not include the givenRole , just throw new Api Error
//with status code 403 and message that states that the user is not having any permission to perform the action 
// because the roles that the user is provided with does not include the role of the user trying to 
// get to the next route and do the further operations 
// here createNotes in a project    
    if (!roles.includes(givenRole)) {
      throw new ApiError(
        403,
        "You do not have permission to perform this action",
      );
    }

    next();
  });
