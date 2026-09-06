const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { supabase, supabaseAdmin } = require("../config/supabase");
const database = supabaseAdmin || supabase;
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", protect, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No image uploaded" });
    }

    const scanData = {
      user_id: req.user.id,
      image_url: "temp-url",
      plant_name: "Sample Plant",
      health_status: "healthy",
      disease_name: null,
    };

    const { data, error } = await database
      .from("scans")
      .insert([scanData])
      .select();

    if (error) throw error;

    res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/", protect, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await database
      .from("scans")
      .select("*", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
      },
    });
  } catch (error) {
    console.error("Get scans error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/stats/dashboard", protect, async (req, res) => {
  try {
    const { data, error } = await database
      .from("scans")
      .select("health_status, disease_name, created_at")
      .eq("user_id", req.user.id);

    if (error) throw error;

    const scans = data || [];
    const healthyScans = scans.filter(
      (scan) => scan.health_status === "healthy",
    ).length;
    const diseasedScans = scans.filter(
      (scan) => scan.health_status !== "healthy",
    ).length;
    const commonDiseaseCounts = scans.reduce((counts, scan) => {
      if (scan.disease_name) {
        counts[scan.disease_name] = (counts[scan.disease_name] || 0) + 1;
      }
      return counts;
    }, {});
    const last7Days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return {
        date: key,
        count: scans.filter((scan) => scan.created_at?.slice(0, 10) === key)
          .length,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        totalScans: scans.length,
        healthyScans,
        diseasedScans,
        healthyRate: scans.length
          ? `${Math.round((healthyScans / scans.length) * 100)}%`
          : "0%",
        last7Days,
        commonDiseases: Object.entries(commonDiseaseCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((first, second) => second.count - first.count)
          .slice(0, 5),
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to load dashboard statistics" });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const { error } = await database
      .from("scans")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id);

    if (error) throw error;

    res.status(200).json({ success: true, message: "Scan deleted" });
  } catch (error) {
    console.error("Delete scan error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
