const express   = require("express");
const cors      = require("cors");
const dotenv    = require("dotenv");
const { MongoClient } = require("mongodb");

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Validate env ──────────────────────────────────────────────
const mongoURL = process.env.MONGO_URL;
if (!mongoURL) {
  console.error("❌  MONGO_URL is missing in .env file");
  process.exit(1);
}

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "15mb" }));

// ── Connect to MongoDB then mount routes ──────────────────────
MongoClient.connect(mongoURL)
  .then((client) => {
    console.log("✅  Database connected successfully");

    const db         = client.db("Sample");
    const collection = db.collection("form");

    // ── Graceful shutdown ─────────────────────────────────────
    process.on("SIGINT",  () => { client.close(); process.exit(0); });
    process.on("SIGTERM", () => { client.close(); process.exit(0); });

    // ─────────────────────────────────────────────────────────
    //  POST /form  — Save registration
    // ─────────────────────────────────────────────────────────
    app.post("/form", async (req, res) => {
      try {
        const {
          fullName,
          age,
          email,
          phone,
          organization,
          address,
          role,
        } = req.body;

        // Required field validation
        if (!fullName || !age || !email || !phone || !address || !role) {
          return res.status(400).json({
            success: false,
            message: "All required fields must be filled (fullName, age, email, phone, address, role)",
          });
        }

        // Basic email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            message: "Please provide a valid email address",
          });
        }

        // Age range check
        const parsedAge = parseInt(age, 10);
        if (isNaN(parsedAge) || parsedAge < 16 || parsedAge > 100) {
          return res.status(400).json({
            success: false,
            message: "Age must be between 16 and 100",
          });
        }

        // Check for duplicate email
        const existing = await collection.findOne({ email });
        if (existing) {
          return res.status(409).json({
            success: false,
            message: "This email is already registered",
          });
        }

        const result = await collection.insertOne({
          fullName,
          age:          parsedAge,
          email:        email.toLowerCase().trim(),
          phone,
          organization: organization || "",
          address,
          role,
          createdAt:    new Date(),
        });

        if (result.insertedId) {
          return res.status(201).json({
            success: true,
            message: "Registration successful! Welcome to Connecta.",
            id:      result.insertedId,
          });
        }

        return res.status(500).json({
          success: false,
          message: "Failed to save data. Please try again.",
        });

      } catch (error) {
        console.error("❌  Error saving form:", error);
        return res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    });

    // ─────────────────────────────────────────────────────────
    //  GET /form  — Fetch all registrations
    // ─────────────────────────────────────────────────────────
    app.get("/form", async (req, res) => {
      try {
        const data = await collection
          .find({})
          .sort({ createdAt: -1 })   // newest first
          .toArray();

        return res.status(200).json({
          success: true,
          count:   data.length,
          data,
        });
      } catch (error) {
        console.error("❌  Error fetching form data:", error);
        return res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    });

    // ─────────────────────────────────────────────────────────
    //  GET /form/:id  — Fetch single registration by id
    // ─────────────────────────────────────────────────────────
    app.get("/form/:id", async (req, res) => {
      try {
        const { ObjectId } = require("mongodb");
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, message: "Invalid ID format" });
        }

        const record = await collection.findOne({ _id: new ObjectId(id) });
        if (!record) {
          return res.status(404).json({ success: false, message: "Record not found" });
        }

        return res.status(200).json({ success: true, data: record });
      } catch (error) {
        console.error("❌  Error fetching record:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
      }
    });

    // ─────────────────────────────────────────────────────────
    //  DELETE /form/:id  — Delete a registration
    // ─────────────────────────────────────────────────────────
    app.delete("/form/:id", async (req, res) => {
      try {
        const { ObjectId } = require("mongodb");
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, message: "Invalid ID format" });
        }

        const result = await collection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {
          return res.status(200).json({ success: true, message: "Record deleted successfully" });
        }

        return res.status(404).json({ success: false, message: "Record not found" });
      } catch (error) {
        console.error("❌  Error deleting record:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
      }
    });

    // ─────────────────────────────────────────────────────────
    //  Health check
    // ─────────────────────────────────────────────────────────
    app.get("/health", (_req, res) => {
      res.status(200).json({ success: true, message: "Connecta API is running 🚀" });
    });

    // ── 404 fallback ──────────────────────────────────────────
    app.use((_req, res) => {
      res.status(404).json({ success: false, message: "Route not found" });
    });

    // ── Start server ──────────────────────────────────────────
    app.listen(PORT, () => {
      console.log(`🚀  Server running on http://localhost:${PORT}`);
      console.log(`📋  Endpoints:`);
      console.log(`    POST   http://localhost:${PORT}/form`);
      console.log(`    GET    http://localhost:${PORT}/form`);
      console.log(`    GET    http://localhost:${PORT}/form/:id`);
      console.log(`    DELETE http://localhost:${PORT}/form/:id`);
      console.log(`    GET    http://localhost:${PORT}/health`);
    });
  })
  .catch((err) => {
    console.error("❌  Database connection failed:", err.message);
    process.exit(1);
  });