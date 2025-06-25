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
const packagesCollection = db.collection('packages');

// Get all packages and calculate KPIs
exports.getPackages = async (req, res) => {
  try {
    const snapshot = await packagesCollection.get();
    const packages = [];
    let totalSubscribers = 0;
    let totalRevenue = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      packages.push({ id: doc.id, ...data });
      if (data.price > 0) {
        totalSubscribers += data.subscriberCount || 0;
        totalRevenue += (data.price * (data.subscriberCount || 0));
      }
    });

    // Find most popular package (highest subscriber count among paid packages)
    const popularPackage = packages
      .filter(p => p.price > 0)
      .reduce((max, pkg) => (max.subscriberCount || 0) > (pkg.subscriberCount || 0) ? max : pkg, { subscriberCount: -1 });
    const mostPopularPackage = popularPackage.name || 'N/A';

    res.status(200).json({
      packages,
      kpi: {
        totalSubscribers,
        mostPopularPackage,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
};

// Create a new package
exports.createPackage = async (req, res) => {
  try {
    const { name, price, description, features } = req.body;
    if (!name || !price || !description || !features || !Array.isArray(features)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newPackage = {
      name,
      price: parseInt(price),
      description,
      features,
      subscriberCount: 0, // Default to 0 for new packages
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await packagesCollection.add(newPackage);
    res.status(201).json({ id: docRef.id, ...newPackage });
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ error: 'Failed to create package' });
  }
};

// Update an existing package
exports.updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description, features } = req.body;
    if (!id || !name || !price || !description || !features || !Array.isArray(features)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const updateData = {
      name,
      price: parseInt(price),
      description,
      features,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await packagesCollection.doc(id).update(updateData);
    res.status(200).json({ id, ...updateData });
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({ error: 'Failed to update package' });
  }
};

// Delete a package
exports.deletePackage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Package ID is required' });
    }

    await packagesCollection.doc(id).delete();
    res.status(200).json({ message: 'Package deleted successfully' });
  } catch (error) {
    console.error('Error deleting package:', error);
    res.status(500).json({ error: 'Failed to delete package' });
  }
};