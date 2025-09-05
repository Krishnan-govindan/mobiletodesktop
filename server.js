/*
  Simple Express backend for the file‑sharing app. This server exposes
  endpoints to post messages (with optional file uploads) and to list
  existing messages with optional search filtering. It uses the
  firebase‑admin SDK to interact with Cloud Firestore and Cloud
  Storage from a trusted environment. You must provide application
  default credentials or a service account key for firebase‑admin to
  authenticate. See https://firebase.google.com/docs/admin/setup for
  details.
*/
const express = require('express');
const multer = require('multer');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

// Initialize the admin SDK. When running locally you can set the
// GOOGLE_APPLICATION_CREDENTIALS environment variable pointing to a
// service account JSON file, or place a service account JSON at
// /etc/google-cloud/service-account.json. See Firebase docs for more
// details. The storageBucket must match the one from your Firebase
// configuration.
initializeApp({
  credential: applicationDefault(),
  storageBucket: 'mobiletodesktop-23f56.firebasestorage.app',
});

const db = getFirestore();
const bucket = getStorage().bucket();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// POST /messages : upload a message and optional file
app.post('/messages', upload.single('file'), async (req, res) => {
  try {
    const { text } = req.body;
    let fileUrl = null;
    let fileName = null;
    let fileType = null;
    if (req.file) {
      fileName = `${Date.now()}_${req.file.originalname}`;
      fileType = req.file.mimetype;
      const file = bucket.file(`uploads/${fileName}`);
      await file.save(req.file.buffer, {
        metadata: { contentType: fileType },
      });
      // Make the file publicly accessible. You may implement your own
      // authentication and skip this call if you prefer secured access.
      await file.makePublic();
      fileUrl = file.publicUrl();
    }
    const docRef = await db.collection('messages').add({
      text: text || null,
      fileUrl: fileUrl,
      fileName: fileName,
      fileType: fileType,
      timestamp: new Date(),
    });
    res.json({ id: docRef.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload message' });
  }
});

// GET /messages : list messages optionally filtered by a search query
app.get('/messages', async (req, res) => {
  try {
    const search = (req.query.search || '').toLowerCase();
    const snapshot = await db
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .get();
    const messages = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const text = data.text ? data.text.toLowerCase() : '';
      const fileName = data.fileName ? data.fileName.toLowerCase() : '';
      if (!search || text.includes(search) || fileName.includes(search)) {
        messages.push({ id: doc.id, ...data });
      }
    });
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});