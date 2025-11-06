import { ApiError } from "../APIStatus/APIError.js";
import { APIResponse }from "../APIStatus/APIResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const healthCheck = asyncHandler(async (req, res) => {
try {
        res.status(200).json(new APIResponse(200, { message: "Server is running" }));   
 } catch (error) {
          res.status(500).json(ApiError);    
 }   
}
);

export { healthCheck };
