const admin = require('firebase-admin');

// Initialize Firebase Admin (assuming service account is set up via environment variables)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();
const templatesCollection = db.collection('surveyTemplates');

// Get all templates
exports.getTemplates = async (req, res) => {
    try {
        const snapshot = await templatesCollection.get();
        const templates = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(templates);
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
};

// Create a new template
exports.createTemplate = async (req, res) => {
    try {
        const { title, description, questions } = req.body;
        if (!title || !questions || !Array.isArray(questions)) {
            return res.status(400).json({ error: 'Title and questions are required' });
        }

        const newTemplate = {
            title,
            description: description || '',
            questions,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const docRef = await templatesCollection.add(newTemplate);
        res.status(201).json({ id: docRef.id, ...newTemplate });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
};

// Update an existing template
exports.updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, questions } = req.body;
        if (!id || !title || !questions || !Array.isArray(questions)) {
            return res.status(400).json({ error: 'ID, title, and questions are required' });
        }

        const updateData = {
            title,
            description: description || '',
            questions,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await templatesCollection.doc(id).update(updateData);
        res.status(200).json({ id, ...updateData });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: 'Failed to update template' });
    }
};

// Delete a template
exports.deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'Template ID is required' });
        }

        await templatesCollection.doc(id).delete();
        res.status(200).json({ message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
};