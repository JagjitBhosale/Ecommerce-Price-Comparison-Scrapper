import express from "express";
import dotenv from "dotenv";
import unifyRoutes from "./routes/unifyRoutes.js";
import amazonScrapperRoutes from "./routes/amazonScrapper.js";
import myntraScrapperRoutes from "./routes/myntraScrapper.js";
import flipkartScrapperRoutes from "./routes/flipkartScrapper.js";

dotenv.config(); // ✅ loads your .env file

const app = express();
app.use(express.json());

// Test whether GOOGLE_API_KEY is loaded
console.log("GOOGLE_API_KEY:", process.env.GOOGLE_API_KEY ? "Loaded ✅" : "Missing ❌");

app.use("/api", unifyRoutes);
app.use("/api", amazonScrapperRoutes);
app.use("/api", myntraScrapperRoutes);
app.use("/api", flipkartScrapperRoutes);

app.listen(5000, () => console.log("Server running on port 5000"));
