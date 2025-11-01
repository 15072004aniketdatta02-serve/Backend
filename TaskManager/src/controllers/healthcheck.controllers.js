import { APIResponse }from "../APIStatus/APIResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const healthCheck = asyncHandler(async (req, res) => {
    res.status(200).json(new APIResponse(200, { message: "Server is running" }));
}
);

export { healthCheck };
