const express = require("express");
const router = express.Router();
const { supabase, supabaseAdmin } = require("../config/supabase");

// @route   POST /api/auth/register
// @desc    Register a new user
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Register user with Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split("@")[0],
        },
      },
    });

    if (error) {
      console.error("Supabase signup error:", error);

      if (error.message.includes("already registered")) {
        return res.status(400).json({
          success: false,
          message: "This email is already registered. Please login instead.",
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message || "Registration failed",
      });
    }

    // Create user profile in our users table
    if (data.user) {
      const { error: profileError } = await supabase.from("users").insert([
        {
          id: data.user.id,
          email: data.user.email,
          name: name || data.user.email.split("@")[0],
        },
      ]);

      if (profileError) {
        console.error("Profile creation error:", profileError);
        // User is created but profile failed - we can try again later
        // For now, user can still login
      }
    }

    res.status(201).json({
      success: true,
      message:
        "Registration successful! Please check your email to verify your account.",
      user: {
        id: data.user?.id,
        email: data.user?.email,
        name: data.user?.user_metadata?.name || name,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Login with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Supabase login error:", error);

      if (error.message.includes("Invalid login credentials")) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      return res.status(401).json({
        success: false,
        message: error.message || "Login failed",
      });
    }

    // Get user profile
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (userError) {
      console.error("User fetch error:", userError);
      // User exists in auth but not in our table - create profile
      if (userError.code === "PGRST116") {
        const { error: createError } = await supabase.from("users").insert([
          {
            id: data.user.id,
            email: data.user.email,
            name:
              data.user.user_metadata?.name || data.user.email.split("@")[0],
          },
        ]);

        if (createError) {
          console.error("Profile creation error:", createError);
        }
      }
    }

    res.status(200).json({
      success: true,
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        name:
          data.user.user_metadata?.name ||
          userData?.name ||
          data.user.email.split("@")[0],
        preferences: userData?.preferences || { theme: "light" },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
router.post("/logout", async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      return res.status(400).json({
        success: false,
        message: error.message || "Logout failed",
      });
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    // Get user profile
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (userError && userError.code !== "PGRST116") {
      console.error("User fetch error:", userError);
    }

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name:
          user.user_metadata?.name ||
          userData?.name ||
          user.email.split("@")[0],
        preferences: userData?.preferences || { theme: "light" },
        avatar: userData?.avatar || null,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide your email address",
      });
    }

    // Use Supabase's built-in password reset
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || "http://localhost:3000"}/pages/reset-password.html`,
    });

    if (error) {
      console.error("Password reset error:", error);

      // Don't reveal if email exists or not for security
      if (error.message.includes("not found")) {
        return res.status(200).json({
          success: true,
          message:
            "If an account exists with this email, a reset link has been sent.",
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message || "Failed to send reset email",
      });
    }

    res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your email.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Set the session with the token
    const { data: sessionData, error: sessionError } =
      await supabase.auth.setSession({
        access_token: token,
        refresh_token: token,
      });

    if (sessionError) {
      console.error("Session error:", sessionError);
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token. Please request a new one.",
      });
    }

    // Update password
    const { data: updateData, error: updateError } =
      await supabase.auth.updateUser({
        password: password,
      });

    if (updateError) {
      console.error("Update password error:", updateError);
      return res.status(400).json({
        success: false,
        message: updateError.message || "Failed to reset password",
      });
    }

    // Sign out after reset
    await supabase.auth.signOut();

    res.status(200).json({
      success: true,
      message:
        "Password reset successful! Please login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

module.exports = router;
