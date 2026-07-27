import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { sendVerificationEmail } from '../services/emailService.js';

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// @desc    Register new user (requires email verification)
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Generate email verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create user (not yet verified)
        const user = await User.create({
            email,
            password,
            name,
            emailVerified: false,
            emailVerificationToken: verificationToken,
            emailVerificationExpires: verificationExpires
        });

        if (user) {
            // Send verification email
            let emailResult;
            try {
                emailResult = await sendVerificationEmail(email, name, verificationToken);
            } catch (emailError) {
                await User.deleteOne({ _id: user._id });
                return res.status(500).json({ 
                    message: `Failed to send verification email: ${emailError.message}` 
                });
            }

            res.status(201).json({
                message: 'Registration successful! Please check your email to verify your account.',
                requiresVerification: true
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify email address
// @route   GET /api/auth/verify-email?token=xxx
// @access  Public
export const verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ message: 'Verification token is required' });
        }

        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ 
                message: 'Invalid or expired verification link. Please register again.' 
            });
        }

        // Mark as verified
        user.emailVerified = true;
        user.emailVerificationToken = null;
        user.emailVerificationExpires = null;
        await user.save();

        console.log(`✅ Email verified for user: ${user.email}`);

        // Return token so user is automatically logged in
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id),
            message: 'Email verified successfully! Welcome to FinTechPro.'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for user
        const user = await User.findOne({ email });

        if (user && (await user.comparePassword(password))) {
            // Migration for legacy users (created before email verification feature)
            // They have emailVerified=false but DO NOT have an emailVerificationToken
            if (user.emailVerified === false && !user.emailVerificationToken) {
                user.emailVerified = true;
                await user.save();
            }

            // Block login if email not verified
            if (!user.emailVerified) {
                return res.status(403).json({ 
                    message: 'Please verify your email address before logging in. Check your inbox.',
                    requiresVerification: true
                });
            }

            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
    res.json({
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email
    });
};
