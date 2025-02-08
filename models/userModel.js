const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address.']
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['user', 'admin'],  // restrict roles to these values
        default: 'user'           // set default role
    },
    quota: [{
        amount: {
            type: Number,
            required: true
        },
        expiresAt: {
            type: Date,
            required: true
        }
    }],
    passwordResetToken: {
        type: String
    },
    passwordResetExpires: {
        type: Date
    },
    keys: [{
        type: Schema.Types.ObjectId,
        ref: 'key',
    }],
    passwordChangedAt: {
        type: Date,
    },
    activities: [{
        action: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

// Add pre-save middleware to sort quota
userSchema.pre('save', function(next) {
    if (this.quota) {
        // Sort in ascending order (earliest to latest dates)
        this.quota.sort((a, b) => a.expiresAt - b.expiresAt);
    }
    next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
