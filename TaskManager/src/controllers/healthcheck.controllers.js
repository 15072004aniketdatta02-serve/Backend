import { APIResponse }from "../APIStatus/APIResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const healthCheck = asyncHandler(async (req, res) => {
    res.status(200).json(new APIResponse(200, "Server is running", "Server is running"));
}
);

export { healthCheck };
