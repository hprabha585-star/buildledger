const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const { Site, Payment, Expense } = require('../models');

router.use(auth);

// List sites with computed totalPaid / balance per site
router.get('/', async (req, res) => {
  try {
    const sites = await Site.find({ contractorId: req.user.id }).populate('ownerId', 'name mobile whatsapp').sort({ createdAt: -1 });
    const payments = await Payment.aggregate([
      { $match: { contractorId: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: '$siteId', total: { $sum: '$amount' } } },
    ]);
    const paidMap = {};
    payments.forEach((p) => { paidMap[String(p._id)] = p.total; });
    const out = sites.map((s) => {
      const totalPaid = paidMap[String(s._id)] || 0;
      return { ...s.toObject(), totalPaid, balance: (s.contractAmount || 0) - totalPaid };
    });
    res.json(out);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const site = await Site.findOne({ _id: req.params.id, contractorId: req.user.id }).populate('ownerId', 'name mobile whatsapp');
    if (!site) return res.status(404).json({ error: 'Site not found' });
    const payments = await Payment.find({ siteId: site._id, contractorId: req.user.id }).sort({ date: -1 });
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    res.json({
      ...site.toObject(),
      payments,
      financials: { contractAmount: site.contractAmount || 0, totalPaid, balance: (site.contractAmount || 0) - totalPaid },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, location, ownerId, contractAmount, startDate, expectedEndDate, scope, status } = req.body;
    if (!name || !location) return res.status(400).json({ error: 'Name and location are required' });
    const s = await Site.create({
      name, location, ownerId: ownerId || null, contractAmount: Number(contractAmount) || 0,
      startDate, expectedEndDate, scope, status: status || 'active', contractorId: req.user.id,
    });
    res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, location, ownerId, contractAmount, startDate, expectedEndDate, scope, status } = req.body;
    const s = await Site.findOneAndUpdate(
      { _id: req.params.id, contractorId: req.user.id },
      { name, location, ownerId: ownerId || null, contractAmount: Number(contractAmount) || 0, startDate, expectedEndDate, scope, status },
      { new: true }
    );
    if (!s) return res.status(404).json({ error: 'Site not found' });
    res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const s = await Site.findOneAndDelete({ _id: req.params.id, contractorId: req.user.id });
    if (!s) return res.status(404).json({ error: 'Site not found' });
    await Promise.all([
      Payment.deleteMany({ siteId: req.params.id, contractorId: req.user.id }),
      Expense.deleteMany({ siteId: req.params.id, contractorId: req.user.id }),
    ]);
    res.json({ message: 'Site deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
