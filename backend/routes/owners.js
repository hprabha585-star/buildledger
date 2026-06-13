const router = require('express').Router();
const { Owner, Site, Payment } = require('../models');
const auth   = require('../middleware/auth');

router.use(auth);

// GET all owners
router.get('/', async (req, res) => {
  try {
    res.json(await Owner.find({ contractorId: req.user.id }).sort({ createdAt: -1 }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single owner with their sites + payment summary
router.get('/:id', async (req, res) => {
  try {
    const owner = await Owner.findOne({ _id: req.params.id, contractorId: req.user.id });
    if (!owner) return res.status(404).json({ error: 'Not found' });

    const sites = await Site.find({ ownerId: req.params.id, contractorId: req.user.id });
    const siteIds = sites.map(s => s._id);
    const payments = await Payment.find({ siteId: { $in: siteIds }, contractorId: req.user.id }).populate('siteId', 'name contractAmount');

    const totalContract = sites.reduce((s, x) => s + (x.contractAmount || 0), 0);
    const totalPaid     = payments.reduce((s, p) => s + p.amount, 0);

    res.json({
      ...owner.toObject(), sites,
      financials: { totalContract, totalPaid, balance: totalContract - totalPaid },
      recentPayments: payments.slice(-10).reverse(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CREATE owner
router.post('/', async (req, res) => {
  try {
    const { name, mobile, whatsapp, email, address, notes } = req.body;
    if (!name || !mobile) return res.status(400).json({ error: 'Name and mobile required' });
    const owner = await Owner.create({ contractorId: req.user.id, name, mobile, whatsapp: whatsapp || '', email: email || '', address: address || '', notes: notes || '' });
    res.status(201).json(owner);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE owner
router.put('/:id', async (req, res) => {
  try {
    const { name, mobile, whatsapp, email, address, notes } = req.body;
    const owner = await Owner.findOneAndUpdate(
      { _id: req.params.id, contractorId: req.user.id },
      { name, mobile, whatsapp, email, address, notes },
      { new: true }
    );
    res.json(owner);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE owner
router.delete('/:id', async (req, res) => {
  try {
    await Owner.findOneAndDelete({ _id: req.params.id, contractorId: req.user.id });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
