const router = require('express').Router();
const { Client, Site } = require('../models');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    res.json(await Client.find({ contractorId: req.user.id }).sort({ createdAt: -1 }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, contractorId: req.user.id });
    if (!client) return res.status(404).json({ error: 'Not found' });
    const sites = await Site.find({ clientId: req.params.id, contractorId: req.user.id });
    res.json({ ...client.toObject(), sites });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, address, propertyType, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });
    const client = await Client.create({ contractorId: req.user.id, name, phone, email, address, propertyType, notes });
    res.status(201).json(client);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, address, propertyType, notes } = req.body;
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, contractorId: req.user.id },
      { name, phone, email, address, propertyType, notes },
      { new: true }
    );
    res.json(client);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Client.findOneAndDelete({ _id: req.params.id, contractorId: req.user.id });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
