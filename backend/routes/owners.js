const router = require('express').Router();
const auth = require('../middleware/auth');
const { Owner, Site, Payment } = require('../models');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const owners = await Owner.find({ contractorId: req.user.id }).sort({ createdAt: -1 });
    res.json(owners);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const owner = await Owner.findOne({ _id: req.params.id, contractorId: req.user.id });
    if (!owner) return res.status(404).json({ error: 'Owner not found' });
    const sites = await Site.find({ ownerId: owner._id, contractorId: req.user.id });
    const siteIds = sites.map((s) => s._id);
    const payments = await Payment.find({ siteId: { $in: siteIds } }).populate('siteId', 'name').sort({ date: -1 });
    const totalContract = sites.reduce((s, x) => s + (x.contractAmount || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    res.json({
      ...owner.toObject(),
      sites,
      recentPayments: payments.slice(0, 10),
      financials: { totalContract, totalPaid, balance: totalContract - totalPaid },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, mobile, whatsapp, email, address, notes } = req.body;
    if (!name || !mobile) return res.status(400).json({ error: 'Name and mobile are required' });
    const o = await Owner.create({ name, mobile, whatsapp, email, address, notes, contractorId: req.user.id });
    res.json(o);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, mobile, whatsapp, email, address, notes } = req.body;
    const o = await Owner.findOneAndUpdate(
      { _id: req.params.id, contractorId: req.user.id },
      { name, mobile, whatsapp, email, address, notes },
      { new: true }
    );
    if (!o) return res.status(404).json({ error: 'Owner not found' });
    res.json(o);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const o = await Owner.findOneAndDelete({ _id: req.params.id, contractorId: req.user.id });
    if (!o) return res.status(404).json({ error: 'Owner not found' });
    res.json({ message: 'Owner deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
