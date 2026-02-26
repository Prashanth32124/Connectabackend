const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();

app.use(cors());
app.use(express.json());

let cachedClient = null;

async function connectToDB() {
  if (cachedClient) return cachedClient;

  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  cachedClient = client;

  return client;
}

/* =========================
   POST /api/form
========================= */
app.post("/form", async (req, res) => {
  try {
    const client = await connectToDB();
    const db = client.db("Sample");
    const collection = db.collection("form");

    const { fullName, age, email, phone, organization, address, role } = req.body;

    if (!fullName || !age || !email || !phone || !address || !role) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled",
      });
    }

    const existing = await collection.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const result = await collection.insertOne({
      fullName,
      age: parseInt(age),
      email: email.toLowerCase(),
      phone,
      organization: organization || "",
      address,
      role,
      createdAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      id: result.insertedId,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/* =========================
   GET /api/form
========================= */
app.get("/form", async (req, res) => {
  try {
    const client = await connectToDB();
    const db = client.db("Sample");
    const collection = db.collection("form");

    const data = await collection.find().toArray();

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* =========================
   Health
========================= */
app.get("/health", (req, res) => {
  res.json({ success: true, message: "API running 🚀" });
});

module.exports = app;