const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });

    if (error) throw error;

    res.status(201).json({
      success: true,
      user: { id: user.id, email: user.email, name: user.user_metadata?.name }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: { user, session }, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    res.status(200).json({
      success: true,
      token: session.access_token,
      user: { id: user.id, email: user.email, name: user.user_metadata?.name }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ success: false, message: error.message });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
