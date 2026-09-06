const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { supabase, supabaseAdmin } = require("../config/supabase");

const database = supabaseAdmin || supabase;
const DEFAULT_COLLECTION_NAME = "Saved scans";

async function getOrCreateDefaultCollection(userId) {
  const { data: existing, error: lookupError } = await database
    .from("collections")
    .select("id, name, description, created_at")
    .eq("user_id", userId)
    .eq("name", DEFAULT_COLLECTION_NAME)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing) return existing;

  const { data: created, error: createError } = await database
    .from("collections")
    .insert({
      user_id: userId,
      name: DEFAULT_COLLECTION_NAME,
      description: "Saved scan records",
      is_public: false,
    })
    .select("id, name, description, created_at")
    .single();

  if (createError) {
    if (createError.code === "23505") {
      return getOrCreateDefaultCollection(userId);
    }
    throw createError;
  }

  return created;
}

router.get("/", protect, async (req, res) => {
  try {
    const collection = await getOrCreateDefaultCollection(req.user.id);
    const { data, error } = await database
      .from("collection_scans")
      .select("collection_id, scan_id, added_at, scans(*)")
      .eq("collection_id", collection.id)
      .order("added_at", { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      collection,
      data: data || [],
    });
  } catch (error) {
    console.error("Get collections error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to load collections" });
  }
});

router.post("/", protect, async (req, res) => {
  try {
    const { scan_id: scanId } = req.body;
    if (!scanId || typeof scanId !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "A scan_id is required" });
    }

    const { data: scan, error: scanError } = await database
      .from("scans")
      .select("id")
      .eq("id", scanId)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (scanError) throw scanError;
    if (!scan) {
      return res
        .status(404)
        .json({ success: false, message: "Scan not found" });
    }

    const collection = await getOrCreateDefaultCollection(req.user.id);
    const { data, error } = await database
      .from("collection_scans")
      .insert({ collection_id: collection.id, scan_id: scanId })
      .select("collection_id, scan_id, added_at, scans(*)")
      .single();

    if (error?.code === "23505") {
      return res
        .status(409)
        .json({ success: false, message: "Scan is already saved" });
    }
    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("Save collection error:", error);
    res.status(500).json({ success: false, message: "Unable to save scan" });
  }
});

router.delete("/:scanId", protect, async (req, res) => {
  try {
    const collection = await getOrCreateDefaultCollection(req.user.id);
    const { error } = await database
      .from("collection_scans")
      .delete()
      .eq("collection_id", collection.id)
      .eq("scan_id", req.params.scanId);

    if (error) throw error;
    res
      .status(200)
      .json({ success: true, message: "Scan removed from collections" });
  } catch (error) {
    console.error("Remove collection error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to remove saved scan" });
  }
});

module.exports = router;
