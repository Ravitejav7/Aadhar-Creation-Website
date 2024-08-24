if(process.env.NODE_ENV !="production"){
    require("dotenv").config();
}

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const MURL=process.env.MONGO_URL;
const app = express();
//console.log(process.env.MONGO_URL);
// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Connect to MongoDB
mongoose.connect(MURL, {
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Error connecting to MongoDB', err);
});

// Define Mongoose schemas and models
const UserSchema = new mongoose.Schema({
    userid: String,
    password: String
});

const AadhaarSchema = new mongoose.Schema({
    userid: String,
    adharnumber: String,
    firstname: String,
    middlename: String,
    lastname: String,
    phn: String,
    emailid: String,
    dob: Date,
    dno: String,
    street: String,
    village: String,
    district: String,
    pincode: String,
    state: String,
    photo: String
});

const User = mongoose.model('User', UserSchema);
const Aadhaar = mongoose.model('Aadhaar', AadhaarSchema);

// Session setup
app.use(session({
    store: MongoStore.create({ mongoUrl: MURL }),
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to check authentication
function ensureAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next(); // User is authenticated, proceed to the next middleware or route
    }
    res.redirect('/login'); // User is not authenticated, redirect to login page
}

// Route for Login Page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/profile', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// Route to get Aadhaar details for the authenticated user
app.get('/getaadhaar', ensureAuthenticated, async (req, res) => {
    try {
        const aadhaar = await Aadhaar.findOne({ userid: req.session.userId });
        if (!aadhaar) {
            return res.json({ success: false, message: 'No Aadhaar data found' });
        }

        res.json({
            success: true,
            aadhaarNumber: aadhaar.adharnumber,
            firstName: aadhaar.firstname,
            middleName: aadhaar.middlename,
            lastName: aadhaar.lastname,
            phone: aadhaar.phn,
            email: aadhaar.emailid,
            dob: aadhaar.dob,
            address: {
                houseNo: aadhaar.dno,
                streetName: aadhaar.street,
                villageName: aadhaar.village,
                district: aadhaar.district,
                pincode: aadhaar.pincode,
                state: aadhaar.state
            },
            photo: aadhaar.photo
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Route to update Aadhaar details
app.post('/updateaadhaar', ensureAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const { photo, address, phone, email } = req.body;

    const updateData = {};
    if (photo) updateData.photo = photo;
    if (address) {
        updateData.dno = address.houseNo || '';
        updateData.street = address.streetName || '';
        updateData.village = address.villageName || '';
        updateData.district = address.district || '';
        updateData.state = address.state || '';
        updateData.pincode = address.pincode || '';
    }
    if (phone) updateData.phn = phone;
    if (email) updateData.emailid = email;

    try {
        await Aadhaar.updateOne({ userid: userId }, { $set: updateData });
        res.json({ success: true, message: 'Aadhaar details updated successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Login Handler
app.post('/login', async (req, res) => {
    const { userid, password } = req.body;

    try {
        const user = await User.findOne({ userid });
        if (!user || user.password !== password) {
            return res.status(401).send('Invalid credentials');
        }

        req.session.userId = userid; // Store user ID in session
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Route for Signup Page
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.post('/signup', async (req, res) => {
    const { userid, password } = req.body;

    try {
        const newUser = new User({ userid, password });
        await newUser.save();
        res.status(200).send("Successfully registered");
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Route for Create Aadhaar Page
app.post('/createaadhaar', ensureAuthenticated, async (req, res) => {
    const userId = req.session.userId;

    const {
        aadhaarNumber,
        firstName,
        middleName,
        lastName,
        phone,
        email,
        dob,
        address: { houseNo, streetName, villageName, district, pincode, state },
        photo
    } = req.body;

    const newAadhaar = new Aadhaar({
        userid: userId,
        adharnumber: aadhaarNumber,
        firstname: firstName,
        middlename: middleName,
        lastname: lastName,
        phn: phone,
        emailid: email,
        dob: dob,
        dno: houseNo,
        street: streetName,
        village: villageName,
        district: district,
        pincode: pincode,
        state: state,
        photo: photo
    });

    try {
        await newAadhaar.save();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Route to delete Aadhaar details
app.post('/deleteaadhaar', ensureAuthenticated, async (req, res) => {
    const userId = req.session.userId;

    try {
        await Aadhaar.deleteOne({ userid: userId });
        res.json({ success: true, message: 'Aadhaar details deleted successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.redirect('/login');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});