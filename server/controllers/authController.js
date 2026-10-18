import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';

const googleClient = new OAuth2Client();

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// @desc    Authenticate with Google (login or register)
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ message: 'Google credential is required' });
        }

        // Verify the Google ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        if (!email) {
            return res.status(400).json({ message: 'Google account must have an email address' });
        }

        // Find existing user by googleId or email
        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        if (user) {
            // Link Google account if user exists by email but not yet linked
            if (!user.googleId) {
                user.googleId = googleId;
                user.picture = picture || user.picture;
                // Update name only if user doesn't have one
                if (!user.name || user.name === email) {
                    user.name = name;
                }
                await user.save();
                console.log(`🔗 Linked Google account for existing user: ${email}`);
            }
        } else {
            // Create new user
            user = await User.create({
                email,
                name: name || email.split('@')[0],
                googleId,
                picture
            });
            console.log(`🆕 New user registered via Google: ${email}`);
        }

        const token = generateToken(user._id);

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            picture: user.picture,
            token
        });
    } catch (error) {
        console.error('Google auth error:', error.message);
        if (error.message.includes('Token used too late') || error.message.includes('Invalid token')) {
            return res.status(401).json({ message: 'Google authentication expired. Please try again.' });
        }
        res.status(500).json({ message: 'Authentication failed. Please try again.' });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
    res.json({
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        picture: req.user.picture
    });
};
