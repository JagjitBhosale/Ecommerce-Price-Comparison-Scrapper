// routes/unifyRoutes.js
import express from "express";
import { unifyname } from "../controllers/unifyname.js"; // <-- correct relative path

const router = express.Router();

router.post("/unify-name", unifyname);

export default router;
